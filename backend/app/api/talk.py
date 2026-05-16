"""Talk endpoint — presence conversation with Gemma 4 + voice (STT/TTS)."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.config import settings
from app.models.models import (
    MemorySpace, PersonaCapsule, Conversation, Message,
    TrustChip, PendingMemory
)
from app.services.presence_engine import generate_presence_reply
from app.services.tts_service import synthesize_speech, clone_voice

router = APIRouter(prefix="/api/memory-spaces", tags=["talk"])


class TalkRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    tts: bool = False          # if True, backend will synthesize speech
    voice_id: Optional[str] = None  # ElevenLabs voice_id override


class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None
    stability: float = 0.5
    similarity_boost: float = 0.75
    speed: float = 1.0


class CloneVoiceRequest(BaseModel):
    name: str
    audio_asset_ids: list[str] = []   # asset IDs whose files will be used
    description: str = ""


@router.post("/{space_id}/talk")
async def talk(space_id: str, req: TalkRequest, db: AsyncSession = Depends(get_db)):
    """
    Send a message and receive a first-person presence reply from Gemma 4.
    Returns error details if Ollama is not connected — never fake output.
    """
    # Load space
    space_result = await db.execute(select(MemorySpace).where(MemorySpace.id == space_id))
    space = space_result.scalar_one_or_none()
    if not space:
        raise HTTPException(404, "Memory space not found")

    # Load or create conversation
    if req.conversation_id:
        conv_result = await db.execute(
            select(Conversation).where(Conversation.id == req.conversation_id)
        )
        conversation = conv_result.scalar_one_or_none()
    else:
        conversation = None

    if conversation is None:
        conversation = Conversation(space_id=space_id)
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

    # Load conversation history
    history_result = await db.execute(
        select(Message).where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc()).limit(12)
    )
    history_raw = history_result.scalars().all()
    history = [
        {"role": m.role, "content": m.content}
        for m in reversed(history_raw)
    ]

    # Load persona capsule
    capsule_result = await db.execute(
        select(PersonaCapsule).where(PersonaCapsule.space_id == space_id)
    )
    capsule = capsule_result.scalar_one_or_none()
    capsule_dict = None
    if capsule:
        capsule_dict = {
            "tone": capsule.tone,
            "advice_style": capsule.advice_style,
            "relationship_style": capsule.relationship_style,
            "top_phrases": capsule.top_phrases or [],
            "top_values": capsule.top_values or [],
            "system_prompt_base": capsule.system_prompt_base,
        }

    # Generate reply
    reply = await generate_presence_reply(
        space_id=space_id,
        user_message=req.message,
        persona_capsule=capsule_dict,
        presence_name=space.presence_name,
        conversation_history=history,
    )

    # Store user message
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)

    # If error (Ollama not connected), return error without fake output
    if reply.error:
        await db.commit()
        return {
            "error": reply.error,
            "ollama_not_connected": True,
            "setup_instruction": reply.error,
            "conversation_id": conversation.id,
        }

    # Store presence message
    presence_msg = Message(
        conversation_id=conversation.id,
        role="presence",
        content=reply.content,
        trust_chip=reply.trust_chip,
        source_memory_ids=reply.source_memory_ids,
        model_used=reply.model_used,
    )
    db.add(presence_msg)

    # If unknown memory, create pending memory record
    pending_memory_id = None
    if reply.is_unknown:
        pending = PendingMemory(
            space_id=space_id,
            title=f"Memory about: {req.message[:100]}",
            description=f"User asked about this but no memory was found: {req.message}",
            triggered_by_message_id=None,  # will update after commit
            status="pending_verification",
        )
        db.add(pending)

    await db.commit()

    # Optional: synthesize TTS for the reply
    tts_provider = "none"
    tts_audio_url = None
    use_browser_tts = False

    if req.tts and not reply.error:
        tts_result = await synthesize_speech(
            text=reply.content,
            voice_id=req.voice_id,
        )
        tts_provider = tts_result.provider
        use_browser_tts = tts_result.use_browser_tts
        # If ElevenLabs audio available, it's served via /tts endpoint instead

    return {
        "conversation_id": conversation.id,
        "reply": {
            "content": reply.content,
            "trust_chip": reply.trust_chip.value,
            "source_memory_ids": reply.source_memory_ids,
            "model_used": reply.model_used,
            "is_unknown": reply.is_unknown,
            "is_safety_redirect": reply.is_safety_redirect,
        },
        "tts": {
            "provider": tts_provider,
            "use_browser_tts": use_browser_tts,
            "elevenlabs_configured": bool(settings.ELEVENLABS_API_KEY),
        },
    }


@router.get("/{space_id}/conversations")
async def list_conversations(space_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(Conversation.space_id == space_id)
        .order_by(Conversation.started_at.desc())
    )
    convs = result.scalars().all()
    return [{"id": c.id, "started_at": c.started_at.isoformat()} for c in convs]


@router.get("/{space_id}/conversations/{conv_id}/messages")
async def get_messages(space_id: str, conv_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message).where(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "trust_chip": m.trust_chip.value if m.trust_chip else None,
            "source_memory_ids": m.source_memory_ids or [],
            "model_used": m.model_used,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]
