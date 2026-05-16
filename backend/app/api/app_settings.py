"""
App-level settings API — stores user-configurable keys like ElevenLabs.
Keys are stored in the SQLite DB (not .env), so users can manage them from the UI.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from app.core.database import get_db
from app.models.models import AppSetting

router = APIRouter(prefix="/api/app-settings", tags=["app-settings"])


class ElevenLabsKeyRequest(BaseModel):
    api_key: str


@router.get("/elevenlabs")
async def get_elevenlabs_status(db: AsyncSession = Depends(get_db)):
    """Returns whether an ElevenLabs API key is configured. Never returns the key itself."""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "elevenlabs_api_key")
    )
    row = result.scalar_one_or_none()
    voice_id_result = await db.execute(
        select(AppSetting).where(AppSetting.key == "elevenlabs_voice_id")
    )
    voice_row = voice_id_result.scalar_one_or_none()

    return {
        "configured": bool(row and row.value),
        "voice_id_set": bool(voice_row and voice_row.value),
        "voice_id": voice_row.value if voice_row else None,
        "key_preview": f"...{row.value[-4:]}" if row and row.value else None,
    }


@router.post("/elevenlabs")
async def save_elevenlabs_key(req: ElevenLabsKeyRequest, db: AsyncSession = Depends(get_db)):
    """Save or update ElevenLabs API key in DB. Validates format."""
    key = req.api_key.strip()
    if not key:
        return {"error": "API key cannot be empty"}
    if not key.startswith("sk_") and len(key) < 20:
        return {"error": "Invalid ElevenLabs API key format (should start with sk_...)"}

    # Upsert
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "elevenlabs_api_key")
    )
    row = result.scalar_one_or_none()
    if row:
        row.value = key
    else:
        db.add(AppSetting(key="elevenlabs_api_key", value=key))

    await db.commit()
    return {"configured": True, "key_preview": f"...{key[-4:]}"}


@router.delete("/elevenlabs")
async def delete_elevenlabs_key(db: AsyncSession = Depends(get_db)):
    """Remove ElevenLabs API key. Voice mode reverts to browser Web Speech."""
    await db.execute(
        delete(AppSetting).where(AppSetting.key == "elevenlabs_api_key")
    )
    await db.execute(
        delete(AppSetting).where(AppSetting.key == "elevenlabs_voice_id")
    )
    await db.commit()
    return {"configured": False, "message": "API key removed. Voice mode now uses browser Web Speech."}
