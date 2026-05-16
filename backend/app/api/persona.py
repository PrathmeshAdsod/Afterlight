"""Persona capsule and timeline endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import PersonaCapsule, MemoryCard, EventEntity

router = APIRouter(prefix="/api/memory-spaces", tags=["persona"])


@router.get("/{space_id}/persona-capsule")
async def get_persona_capsule(space_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PersonaCapsule).where(PersonaCapsule.space_id == space_id))
    capsule = result.scalar_one_or_none()
    if not capsule:
        return {"exists": False, "message": "Persona capsule not yet created. Run the processing pipeline first."}

    return {
        "exists": True,
        "tone": capsule.tone,
        "advice_style": capsule.advice_style,
        "humor_style": capsule.humor_style,
        "language_mix": capsule.language_mix,
        "relationship_style": capsule.relationship_style,
        "top_phrases": capsule.top_phrases or [],
        "top_values": capsule.top_values or [],
        "top_themes": capsule.top_themes or [],
        "memory_card_count": capsule.memory_card_count,
        "created_at": capsule.created_at.isoformat(),
        "updated_at": capsule.updated_at.isoformat(),
    }


@router.get("/{space_id}/timeline")
async def get_timeline(space_id: str, db: AsyncSession = Depends(get_db)):
    """Return timeline events extracted from memory cards, sorted by year."""
    events_result = await db.execute(
        select(EventEntity).where(EventEntity.space_id == space_id)
        .order_by(EventEntity.year)
    )
    events = events_result.scalars().all()

    # If no explicit events, derive from memory cards with place/date signals
    if not events:
        cards_result = await db.execute(
            select(MemoryCard).where(MemoryCard.space_id == space_id)
            .order_by(MemoryCard.created_at)
        )
        cards = cards_result.scalars().all()
        return {
            "events": [],
            "memory_cards": [
                {
                    "id": c.id,
                    "title": c.title,
                    "summary": c.summary,
                    "places": c.places_mentioned or [],
                    "people": c.people_mentioned or [],
                    "themes": c.themes or [],
                }
                for c in cards[:50]
            ],
        }

    return {
        "events": [
            {
                "id": e.id,
                "title": e.title,
                "year": e.year,
                "date_hint": e.date_hint,
                "description": e.description,
                "people": e.people or [],
                "place": e.place,
            }
            for e in events
        ],
    }
