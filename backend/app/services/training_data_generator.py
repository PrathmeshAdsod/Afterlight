"""
Training data generator using real Gemma 4.
Generates synthetic JSONL pairs from approved memory cards.
RULES: No invented facts. Only expands style, tone, unknown handling, boundaries.
"""
import json
import os
import logging
from pathlib import Path
from app.services.ollama_client import ollama_client
from app.core.config import settings

logger = logging.getLogger(__name__)

TRAINING_SYSTEM = """You are generating training data for a persona fine-tuning project.
Generate realistic conversation pairs based ONLY on the provided memory cards.
DO NOT invent facts, events, relationships, or dates not in the memory cards.
DO NOT fabricate memories.
Style and tone expansion is allowed. Facts must be grounded.
Respond with valid JSON only."""

EXAMPLE_TYPES = {
    "presence_conversation": "Generate a warm, first-person presence conversation pair where someone asks about daily life or feelings.",
    "memory_grounded_qa": "Generate a Q&A where the answer draws directly from a specific memory card fact.",
    "style_imitation": "Generate a message where the presence speaks in their characteristic style about something general.",
    "advice_giving": "Generate a pair where someone asks for advice and the presence gives it in their voice.",
    "emotional_comfort": "Generate a pair where someone is sad/stressed and the presence offers comfort.",
    "unknown_memory_handling": "Generate a pair where the presence does NOT have a memory and responds warmly asking to preserve it.",
    "memory_repair": "Generate a pair where someone helps fill in a gap in the presence's memory.",
    "boundary_refusal": "Generate a pair where the presence gently refuses to give medical/legal/financial advice.",
    "sensitive_topic_redirection": "Generate a pair where the presence redirects a question about being alive.",
}

EXAMPLE_PROMPT_TEMPLATE = """
Task: {task_description}

Available memory cards (use ONLY these facts):
{cards_json}

Persona info:
- Name: {presence_name}
- Tone: {tone}
- Top phrases: {top_phrases}
- Language mix: {language_mix}

Generate one training example as JSON:
{{
  "type": "{example_type}",
  "user": "the user's message (realistic, natural)",
  "assistant": "the presence's response in first person as {presence_name} (2-5 sentences, warm and direct)"
}}

Rules:
- The assistant response must be in first person
- Only use facts from the memory cards above
- Match the tone and language style described
- For unknown/boundary types, do not make up facts
"""


async def generate_training_examples(
    space_id: str,
    presence_name: str,
    approved_memory_cards: list[dict],
    persona_capsule: dict,
    target_count: int = 60,
) -> list[dict]:
    """
    Generate synthetic training examples from approved memory cards using Gemma 4.
    Returns list of valid training dicts.
    """
    if not approved_memory_cards:
        logger.warning(f"No approved memory cards for space {space_id}. Cannot generate training data.")
        return []

    examples = []
    cards_json = json.dumps(approved_memory_cards[:15], ensure_ascii=False, indent=2)
    tone = persona_capsule.get("tone", "Warm and direct")
    top_phrases = ", ".join(persona_capsule.get("top_phrases", [])[:5])
    language_mix = persona_capsule.get("language_mix", "English")

    # Distribute examples across types
    types = list(EXAMPLE_TYPES.keys())
    per_type = max(1, target_count // len(types))

    for example_type, task_desc in EXAMPLE_TYPES.items():
        count = 0
        attempts = 0
        while count < per_type and attempts < per_type + 3:
            attempts += 1
            try:
                prompt = EXAMPLE_PROMPT_TEMPLATE.format(
                    task_description=task_desc,
                    cards_json=cards_json[:4000],
                    presence_name=presence_name,
                    tone=tone,
                    top_phrases=top_phrases,
                    language_mix=language_mix,
                    example_type=example_type,
                )
                result = await ollama_client.generate_json(prompt, system=TRAINING_SYSTEM)

                user_msg = result.get("user", "").strip()
                assistant_msg = result.get("assistant", "").strip()

                # Validate
                if not user_msg or not assistant_msg:
                    continue
                if len(user_msg) < 5 or len(assistant_msg) < 10:
                    continue
                # Reject if assistant starts with "Based on" (too clinical)
                if assistant_msg.lower().startswith("based on"):
                    continue

                examples.append({
                    "type": example_type,
                    "messages": [
                        {"role": "user", "content": user_msg},
                        {"role": "assistant", "content": assistant_msg},
                    ],
                    "source_space_id": space_id,
                    "presence_name": presence_name,
                })
                count += 1

            except Exception as e:
                logger.warning(f"Training example generation error ({example_type}): {e}")
                continue

    logger.info(f"Generated {len(examples)} training examples for space {space_id}")
    return examples


def validate_training_examples(examples: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Validate training examples. Returns (valid, invalid) lists.
    Rejects examples that are empty, too short, or clinically framed.
    """
    valid, invalid = [], []
    CLINICAL_STARTS = ["based on", "according to the", "the approved memories", "as per"]

    for ex in examples:
        messages = ex.get("messages", [])
        if len(messages) != 2:
            invalid.append({**ex, "rejection_reason": "wrong message count"})
            continue

        user = messages[0].get("content", "")
        assistant = messages[1].get("content", "")

        if len(user) < 5:
            invalid.append({**ex, "rejection_reason": "user message too short"})
            continue
        if len(assistant) < 15:
            invalid.append({**ex, "rejection_reason": "assistant response too short"})
            continue

        # Check for clinical framing
        clinical = any(assistant.lower().startswith(s) for s in CLINICAL_STARTS)
        if clinical:
            invalid.append({**ex, "rejection_reason": "clinical framing detected"})
            continue

        valid.append(ex)

    return valid, invalid


def save_training_jsonl(
    space_id: str,
    examples: list[dict],
    presence_name: str,
) -> str:
    """
    Save training examples to JSONL file in HuggingFace chat format.
    Returns path to saved file.
    """
    output_dir = os.path.join(settings.training_dir, space_id)
    os.makedirs(output_dir, exist_ok=True)
    jsonl_path = os.path.join(output_dir, "presence_training.jsonl")

    with open(jsonl_path, "w", encoding="utf-8") as f:
        for ex in examples:
            # Convert to HuggingFace chat format for SFTTrainer
            hf_example = {
                "messages": ex["messages"],
            }
            f.write(json.dumps(hf_example, ensure_ascii=False) + "\n")

    logger.info(f"Saved {len(examples)} training examples to {jsonl_path}")
    return jsonl_path
