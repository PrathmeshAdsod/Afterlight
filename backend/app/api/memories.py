"""Memory cards list and review."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.models.models import MemoryCard, MemoryStatus
from app.services.vector_store import upsert_memory_card

router = APIRouter(tags=["memories"])


class UpdateMemoryRequest(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None


def card_to_dict(c: MemoryCard) -> dict:
    return {
        "id": c.id,
        "space_id": c.space_id,
        "title": c.title,
        "summary": c.summary,
        "source_quote": c.source_quote,
        "source_start_time": c.source_start_time,
        "source_end_time": c.source_end_time,
        "people_mentioned": c.people_mentioned or [],
        "places_mentioned": c.places_mentioned or [],
        "themes": c.themes or [],
        "values": c.values or [],
        "tone_signals": c.tone_signals or [],
        "confidence": c.confidence,
        "status": c.status.value,
        "language": c.language,
        "created_at": c.created_at.isoformat(),
    }


@router.get("/api/memory-spaces/{space_id}/memories")
async def list_memories(
    space_id: str,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(MemoryCard).where(MemoryCard.space_id == space_id)
    if status:
        query = query.where(MemoryCard.status == MemoryStatus(status))
    query = query.order_by(MemoryCard.created_at.desc())
    result = await db.execute(query)
    cards = result.scalars().all()
    return [card_to_dict(c) for c in cards]


@router.patch("/api/memories/{memory_id}")
async def update_memory(
    memory_id: str,
    req: UpdateMemoryRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MemoryCard).where(MemoryCard.id == memory_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(404, "Memory card not found")

    if req.status:
        card.status = MemoryStatus(req.status)
    if req.title:
        card.title = req.title
    if req.summary:
        card.summary = req.summary

    await db.commit()
    await db.refresh(card)

    # Re-index in ChromaDB if approved
    if card.status == MemoryStatus.approved:
        upsert_memory_card(
            space_id=card.space_id,
            card_id=card.id,
            text=f"{card.title}. {card.summary}",
            metadata={
                "title": card.title,
                "source_quote": card.source_quote or "",
                "confidence": card.confidence,
                "status": card.status.value,
            },
        )

    return card_to_dict(card)
