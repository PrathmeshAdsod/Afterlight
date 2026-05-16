"""Pending memories, capsules, and settings routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.database import get_db
from app.models.models import PendingMemory, LegacyCapsule, Setting

router = APIRouter(prefix="/api/memory-spaces", tags=["misc"])


# ─── Pending Memories ─────────────────────────────────────────────────────────

class PendingMemoryRequest(BaseModel):
    title: str
    description: str
    contributor: Optional[str] = None
    people: Optional[list[str]] = None
    place: Optional[str] = None
    date_hint: Optional[str] = None


@router.post("/{space_id}/pending-memories")
async def create_pending_memory(
    space_id: str, req: PendingMemoryRequest, db: AsyncSession = Depends(get_db)
):
    pm = PendingMemory(
        space_id=space_id,
        title=req.title,
        description=req.description,
        contributor=req.contributor,
        people=req.people or [],
        place=req.place,
        date_hint=req.date_hint,
    )
    db.add(pm)
    await db.commit()
    await db.refresh(pm)
    return {"id": pm.id, "title": pm.title, "status": pm.status, "created_at": pm.created_at.isoformat()}


@router.get("/{space_id}/pending-memories")
async def list_pending_memories(space_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PendingMemory).where(PendingMemory.space_id == space_id)
        .order_by(PendingMemory.created_at.desc())
    )
    items = result.scalars().all()
    return [
        {"id": p.id, "title": p.title, "description": p.description,
         "contributor": p.contributor, "people": p.people, "place": p.place,
         "date_hint": p.date_hint, "status": p.status,
         "created_at": p.created_at.isoformat()}
        for p in items
    ]


# ─── Legacy Capsules ──────────────────────────────────────────────────────────

class CapsuleRequest(BaseModel):
    title: str
    description: Optional[str] = None
    unlock_date: Optional[str] = None
    recipients: Optional[list[str]] = None
    memory_card_ids: Optional[list[str]] = None
    content: Optional[str] = None


@router.get("/{space_id}/capsules")
async def list_capsules(space_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LegacyCapsule).where(LegacyCapsule.space_id == space_id)
    )
    capsules = result.scalars().all()
    return [
        {"id": c.id, "title": c.title, "description": c.description,
         "unlock_date": c.unlock_date.isoformat() if c.unlock_date else None,
         "recipients": c.recipients, "is_sealed": c.is_sealed,
         "created_at": c.created_at.isoformat()}
        for c in capsules
    ]


@router.post("/{space_id}/capsules")
async def create_capsule(space_id: str, req: CapsuleRequest, db: AsyncSession = Depends(get_db)):
    unlock = None
    if req.unlock_date:
        try:
            unlock = datetime.fromisoformat(req.unlock_date)
        except ValueError:
            pass

    capsule = LegacyCapsule(
        space_id=space_id,
        title=req.title,
        description=req.description,
        unlock_date=unlock,
        recipients=req.recipients or [],
        memory_card_ids=req.memory_card_ids or [],
        content=req.content,
    )
    db.add(capsule)
    await db.commit()
    await db.refresh(capsule)
    return {"id": capsule.id, "title": capsule.title, "created_at": capsule.created_at.isoformat()}


# ─── Settings ─────────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    settings: dict[str, str]


@router.get("/{space_id}/settings")
async def get_settings(space_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).where(Setting.space_id == space_id))
    settings_list = result.scalars().all()
    return {s.key: s.value for s in settings_list}


@router.patch("/{space_id}/settings")
async def update_settings(space_id: str, req: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    for key, value in req.settings.items():
        result = await db.execute(
            select(Setting).where(Setting.space_id == space_id, Setting.key == key)
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            db.add(Setting(space_id=space_id, key=key, value=value))
    await db.commit()
    return {"status": "updated"}
