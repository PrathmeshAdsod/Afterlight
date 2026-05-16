"""
Memory extractor using real Gemma 4 via Ollama.
Sends evidence chunks to Gemma and parses structured MemoryCard JSON.
No fake output — raises OllamaNotConnectedError if model unavailable.
"""
import json
import logging
from dataclasses import dataclass, field
from app.services.ollama_client import ollama_client, OllamaNotConnectedError

logger = logging.getLogger(__name__)

MEMORY_EXTRACTION_SYSTEM = """You are a memory archivist helping preserve a loved one's presence.
Your job is to extract meaningful memory cards from the evidence provided.
You must ONLY extract information that is explicitly present in the evidence.
Do NOT invent, hallucinate, or infer facts not in the text.
Respond ONLY with valid JSON. No explanation before or after.
"""

MEMORY_EXTRACTION_PROMPT = """
Extract memory cards from this evidence chunk.

Evidence:
{evidence}

Source asset: {asset_id}
Chunk time range: {start_time} - {end_time}
Language hint: {language}

Return a JSON object with this exact schema:
{{
  "memory_cards": [
    {{
      "title": "short descriptive title (max 100 chars)",
      "summary": "2-4 sentence summary of the memory",
      "source_quote": "verbatim quote from the evidence if present, else null",
      "source_start_time": float or null,
      "source_end_time": float or null,
      "people_mentioned": ["name1", "name2"],
      "places_mentioned": ["place1"],
      "themes": ["family", "cooking", "resilience"],
      "values": ["patience", "generosity"],
      "tone_signals": ["warm", "humorous", "nostalgic"],
      "confidence": 0.0-1.0
    }}
  ],
  "persona_signals": {{
    "repeated_phrases": ["phrase1", "phrase2"],
    "tone": "description of overall tone",
    "advice_style": "description or null",
    "humor_style": "description or null",
    "language_mix": "e.g. Hindi-English, pure English, etc.",
    "relationship_style": "description of how they relate to others"
  }}
}}

Rules:
- Extract only what is in the evidence
- confidence should reflect how clearly the memory is stated
- If nothing meaningful is found, return {{"memory_cards": [], "persona_signals": {{}}}}
- Preserve original language phrases in source_quote if multilingual
"""


@dataclass
class ExtractedMemoryCard:
    title: str
    summary: str
    source_asset_id: str | None = None
    source_quote: str | None = None
    source_start_time: float | None = None
    source_end_time: float | None = None
    people_mentioned: list[str] = field(default_factory=list)
    places_mentioned: list[str] = field(default_factory=list)
    themes: list[str] = field(default_factory=list)
    values: list[str] = field(default_factory=list)
    tone_signals: list[str] = field(default_factory=list)
    confidence: float = 0.8
    language: str = "en"


@dataclass
class PersonaSignals:
    repeated_phrases: list[str] = field(default_factory=list)
    tone: str | None = None
    advice_style: str | None = None
    humor_style: str | None = None
    language_mix: str | None = None
    relationship_style: str | None = None


@dataclass
class ExtractionResult:
    memory_cards: list[ExtractedMemoryCard] = field(default_factory=list)
    persona_signals: PersonaSignals = field(default_factory=PersonaSignals)
    raw_evidence_chunk: str = ""
    chunk_index: int = 0


async def extract_memories_from_chunk(
    evidence_content: str,
    asset_id: str | None,
    start_time: float | None,
    end_time: float | None,
    chunk_index: int,
    language: str = "en",
) -> ExtractionResult:
    """
    Send one evidence chunk to Gemma 4 and extract memory cards.
    Raises OllamaNotConnectedError if Ollama not available.
    """
    prompt = MEMORY_EXTRACTION_PROMPT.format(
        evidence=evidence_content[:4000],  # Keep within context
        asset_id=asset_id or "unknown",
        start_time=f"{start_time:.1f}s" if start_time is not None else "N/A",
        end_time=f"{end_time:.1f}s" if end_time is not None else "N/A",
        language=language,
    )

    logger.info(f"Extracting memories from chunk {chunk_index} (asset={asset_id})")

    try:
        raw_json = await ollama_client.generate_json(
            prompt=prompt,
            system=MEMORY_EXTRACTION_SYSTEM,
        )
    except ValueError as e:
        logger.warning(f"JSON parse error on chunk {chunk_index}: {e}")
        return ExtractionResult(chunk_index=chunk_index, raw_evidence_chunk=evidence_content)

    cards = []
    for c in raw_json.get("memory_cards", []):
        cards.append(ExtractedMemoryCard(
            title=c.get("title", "Untitled Memory")[:500],
            summary=c.get("summary", ""),
            source_asset_id=asset_id,
            source_quote=c.get("source_quote"),
            source_start_time=c.get("source_start_time"),
            source_end_time=c.get("source_end_time"),
            people_mentioned=c.get("people_mentioned", []),
            places_mentioned=c.get("places_mentioned", []),
            themes=c.get("themes", []),
            values=c.get("values", []),
            tone_signals=c.get("tone_signals", []),
            confidence=float(c.get("confidence", 0.8)),
            language=language,
        ))

    ps_raw = raw_json.get("persona_signals", {})
    persona = PersonaSignals(
        repeated_phrases=ps_raw.get("repeated_phrases", []),
        tone=ps_raw.get("tone"),
        advice_style=ps_raw.get("advice_style"),
        humor_style=ps_raw.get("humor_style"),
        language_mix=ps_raw.get("language_mix"),
        relationship_style=ps_raw.get("relationship_style"),
    )

    logger.info(f"Chunk {chunk_index}: extracted {len(cards)} memory cards")
    return ExtractionResult(
        memory_cards=cards,
        persona_signals=persona,
        raw_evidence_chunk=evidence_content,
        chunk_index=chunk_index,
    )


CAPSULE_SYSTEM = """You are synthesizing a persona capsule from approved memory cards.
Create a concise, accurate description of how this person communicated.
Only use information from the provided memory cards. Do not invent.
Respond with valid JSON only."""

CAPSULE_PROMPT = """
Based on these approved memory cards, create a persona capsule.

Memory cards (JSON):
{cards_json}

Persona signals collected:
{signals_json}

Create a JSON persona capsule:
{{
  "tone": "2-3 sentence description of their overall communication tone",
  "advice_style": "how they gave advice (or null if not evident)",
  "humor_style": "how they used humor (or null if not evident)",
  "language_mix": "languages/dialects they mixed",
  "relationship_style": "how they related to people emotionally",
  "top_phrases": ["phrase1", "phrase2", "phrase3"],
  "top_values": ["value1", "value2", "value3"],
  "top_themes": ["theme1", "theme2"],
  "system_prompt_base": "A 3-4 sentence paragraph that will be used as a system prompt to guide first-person responses. Should capture their voice, terms of address, warmth style. Do NOT claim they are alive. Example: 'You are the preserved presence of [Name]. Speak in first person, warmly and directly...'"
}}
"""


async def build_persona_capsule(
    memory_cards: list[dict],
    persona_signals: list[dict],
    presence_name: str,
    relationship_type: str,
    primary_language: str,
) -> dict:
    """Build a persona capsule from approved memory cards using Gemma 4."""
    cards_json = json.dumps(memory_cards[:30], ensure_ascii=False, indent=2)
    signals_json = json.dumps(persona_signals[:20], ensure_ascii=False, indent=2)

    prompt = CAPSULE_PROMPT.format(
        cards_json=cards_json[:6000],
        signals_json=signals_json[:2000],
    )

    result = await ollama_client.generate_json(prompt, system=CAPSULE_SYSTEM)

    # Ensure system_prompt_base mentions first-person and name
    if not result.get("system_prompt_base"):
        result["system_prompt_base"] = (
            f"You are the preserved presence of {presence_name}, "
            f"speaking through memories preserved by your family. "
            f"Speak in first person, warmly and directly as {presence_name} would. "
            f"You are not alive, but your memories, values, and voice live here."
        )

    return result
