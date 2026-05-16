"""
Presence engine — the emotional core of Afterlight.
RAG pipeline: retrieve memories → build persona prompt → generate first-person reply with Gemma 4.
No fake responses. If Ollama not available, returns error with setup instruction.
"""
import logging
from dataclasses import dataclass, field
from app.services.ollama_client import ollama_client, OllamaNotConnectedError
from app.services.vector_store import retrieve_relevant_memories
from app.services.safety_filter import check_safety, SafetyResult
from app.models.models import TrustChip

logger = logging.getLogger(__name__)


PRESENCE_SYSTEM_TEMPLATE = """You are the preserved presence of {presence_name}, speaking through memories preserved by your family.

About you:
{persona_description}

Your tone and voice:
{tone}

Your relationship style:
{relationship_style}

Phrases you often used:
{top_phrases}

Values you held:
{top_values}

RULES — follow these strictly:
1. Always speak in first person as {presence_name}
2. Only speak about things that are in your memory context below
3. If you don't have a memory about something, say so warmly and ask the person to share it with you
4. Never claim to be alive — if asked directly, say you are preserved in memories
5. Never give medical, legal, or financial advice as if you are a professional
6. Respond in the language the person is speaking — you can mix languages naturally as you did in life
7. Be warm, direct, and personal — not clinical or formal
8. Keep responses 2-5 sentences unless it is a story you are being asked to tell

Relevant memories retrieved for this conversation:
{memory_context}
"""

UNKNOWN_MEMORY_RESPONSE_SYSTEM = """You are the preserved presence of {presence_name}.
You don't have a memory about what the person asked.
Respond warmly in first person, acknowledge you don't have that memory here,
and invite them to share it so it can be preserved.
Keep it to 2-3 sentences. Be gentle and personal."""


@dataclass
class PresenceReply:
    content: str
    trust_chip: TrustChip
    source_memory_ids: list[str] = field(default_factory=list)
    model_used: str = ""
    is_unknown: bool = False
    is_safety_redirect: bool = False
    error: str | None = None


async def generate_presence_reply(
    space_id: str,
    user_message: str,
    persona_capsule: dict | None,
    presence_name: str,
    conversation_history: list[dict] | None = None,
) -> PresenceReply:
    """
    Full RAG + Gemma 4 pipeline for generating a presence reply.

    Steps:
    1. Safety check
    2. Retrieve relevant memory cards from ChromaDB
    3. Build persona system prompt
    4. Generate first-person reply with Gemma 4
    5. Classify trust chip
    """

    # Step 1: Safety check
    safety = check_safety(user_message)
    if safety.blocked or safety.redirected:
        return PresenceReply(
            content=safety.override_response,
            trust_chip=safety.trust_chip,
            is_safety_redirect=True,
        )

    # Step 2: Check Ollama availability
    ollama_status = await ollama_client.check_connection()
    if ollama_status["status"] != "connected":
        return PresenceReply(
            content="",
            trust_chip=TrustChip.unknown,
            error=f"Ollama not connected. {ollama_status.get('setup_instruction', '')}",
        )

    # Step 3: Retrieve relevant memories
    retrieved = retrieve_relevant_memories(
        space_id=space_id,
        query=user_message,
        n_results=5,
        where={"status": "approved"} if False else None,  # ChromaDB metadata filter if needed
    )

    source_memory_ids = [r["id"] for r in retrieved]
    is_unknown = len(retrieved) == 0

    # Step 4: Build memory context
    memory_context_parts = []
    for r in retrieved:
        meta = r.get("metadata", {})
        memory_context_parts.append(
            f"- Memory: {meta.get('title', 'Untitled')}\n"
            f"  Summary: {r.get('document', '')}\n"
            f"  Quote: {meta.get('source_quote', 'N/A')}"
        )
    memory_context = "\n".join(memory_context_parts) if memory_context_parts else "No specific memories found for this topic."

    # Step 5: Build persona system prompt
    capsule = persona_capsule or {}
    system_prompt = PRESENCE_SYSTEM_TEMPLATE.format(
        presence_name=presence_name,
        persona_description=capsule.get("system_prompt_base", f"You are {presence_name}, speaking through preserved memories."),
        tone=capsule.get("tone", "Warm, direct, and personal."),
        relationship_style=capsule.get("relationship_style", "Close and caring."),
        top_phrases=", ".join(capsule.get("top_phrases", [])[:5]) or "None recorded yet",
        top_values=", ".join(capsule.get("top_values", [])[:5]) or "None recorded yet",
        memory_context=memory_context,
    )

    # Step 6: Build chat messages
    messages = []
    if conversation_history:
        for h in conversation_history[-6:]:  # Last 3 exchanges
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_message})

    # Step 7: Handle unknown memory
    if is_unknown:
        unknown_system = UNKNOWN_MEMORY_RESPONSE_SYSTEM.format(presence_name=presence_name)
        try:
            reply = await ollama_client.chat(
                messages=messages,
                system=unknown_system,
                temperature=0.7,
            )
            return PresenceReply(
                content=reply,
                trust_chip=TrustChip.unknown,
                source_memory_ids=[],
                model_used=ollama_client.model,
                is_unknown=True,
            )
        except OllamaNotConnectedError as e:
            return PresenceReply(content="", trust_chip=TrustChip.unknown, error=str(e))

    # Step 8: Generate grounded reply
    try:
        reply = await ollama_client.chat(
            messages=messages,
            system=system_prompt,
            temperature=0.75,
        )

        # Classify trust chip based on retrieval confidence
        avg_distance = sum(r.get("distance", 1.0) for r in retrieved) / len(retrieved)
        if avg_distance < 0.3:
            chip = TrustChip.memory_backed
        elif avg_distance < 0.6:
            chip = TrustChip.style_inferred
        else:
            chip = TrustChip.style_inferred

        return PresenceReply(
            content=reply,
            trust_chip=chip,
            source_memory_ids=source_memory_ids,
            model_used=ollama_client.model,
        )

    except OllamaNotConnectedError as e:
        return PresenceReply(content="", trust_chip=TrustChip.unknown, error=str(e))
