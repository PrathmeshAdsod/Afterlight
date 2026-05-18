"""Memory spaces CRUD and steward agreement."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.models.models import MemorySpace, StewardAgreement, AuditLog

router = APIRouter(prefix="/api/memory-spaces", tags=["memory-spaces"])


class CreateSpaceRequest(BaseModel):
    presence_name: str
    relationship_type: str
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    still_living: bool = False
    primary_language: str = "English"
    description: Optional[str] = None


class UpdateSpaceRequest(BaseModel):
    presence_name: Optional[str] = None
    relationship_type: Optional[str] = None
    primary_language: Optional[str] = None
    description: Optional[str] = None


class AgreementRequest(BaseModel):
    is_authorized_steward: bool
    has_upload_rights: bool
    understands_preserved_presence: bool
    understands_unsupported_facts: bool
    understands_sensitive_topics: bool
    allows_persona_adapter: bool


from sqlalchemy import inspect

def space_to_dict(space: MemorySpace) -> dict:
    # Safely check if agreement relationship is loaded without triggering lazy load
    try:
        insp = inspect(space)
        if "agreement" not in insp.unloaded:
            has_agreement = space.agreement is not None
        else:
            has_agreement = False
    except Exception:
        has_agreement = False

    return {
        "id": space.id,
        "presence_name": space.presence_name,
        "relationship_type": space.relationship_type,
        "birth_year": space.birth_year,
        "death_year": space.death_year,
        "still_living": space.still_living,
        "primary_language": space.primary_language,
        "description": space.description,
        "created_at": space.created_at.isoformat(),
        "has_agreement": has_agreement,
    }


@router.post("")
async def create_space(req: CreateSpaceRequest, db: AsyncSession = Depends(get_db)):
    space = MemorySpace(
        presence_name=req.presence_name,
        relationship_type=req.relationship_type,
        birth_year=req.birth_year,
        death_year=req.death_year,
        still_living=req.still_living,
        primary_language=req.primary_language,
        description=req.description,
    )
    db.add(space)
    await db.commit()
    await db.refresh(space)
    log = AuditLog(space_id=space.id, action="create_space", detail=f"Created: {space.presence_name}")
    db.add(log)
    await db.commit()
    return space_to_dict(space)


from sqlalchemy.orm import selectinload

@router.get("")
async def list_spaces(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MemorySpace)
        .options(selectinload(MemorySpace.agreement))
        .order_by(MemorySpace.created_at.desc())
    )
    spaces = result.scalars().all()
    return [space_to_dict(s) for s in spaces]


@router.get("/{space_id}")
async def get_space(space_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MemorySpace).where(MemorySpace.id == space_id))
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(404, "Memory space not found")
    return space_to_dict(space)


@router.patch("/{space_id}")
async def update_space(space_id: str, req: UpdateSpaceRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MemorySpace).where(MemorySpace.id == space_id))
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(404, "Memory space not found")
    if req.presence_name is not None:
        space.presence_name = req.presence_name
    if req.relationship_type is not None:
        space.relationship_type = req.relationship_type
    if req.primary_language is not None:
        space.primary_language = req.primary_language
    if req.description is not None:
        space.description = req.description
    await db.commit()
    await db.refresh(space)
    return space_to_dict(space)


@router.post("/{space_id}/agreement")
async def submit_agreement(space_id: str, req: AgreementRequest, db: AsyncSession = Depends(get_db)):
    # Validate all boxes are checked
    all_checked = all([
        req.is_authorized_steward,
        req.has_upload_rights,
        req.understands_preserved_presence,
        req.understands_unsupported_facts,
        req.understands_sensitive_topics,
        req.allows_persona_adapter,
    ])
    if not all_checked:
        raise HTTPException(400, "All agreement items must be accepted")

    # Check existing
    existing = await db.execute(
        select(StewardAgreement).where(StewardAgreement.space_id == space_id)
    )
    agreement = existing.scalar_one_or_none()
    if agreement:
        raise HTTPException(409, "Agreement already signed for this space")

    agreement = StewardAgreement(
        space_id=space_id,
        is_authorized_steward=req.is_authorized_steward,
        has_upload_rights=req.has_upload_rights,
        understands_preserved_presence=req.understands_preserved_presence,
        understands_unsupported_facts=req.understands_unsupported_facts,
        understands_sensitive_topics=req.understands_sensitive_topics,
        allows_persona_adapter=req.allows_persona_adapter,
    )
    db.add(agreement)
    log = AuditLog(space_id=space_id, action="sign_agreement")
    db.add(log)
    await db.commit()
    return {"status": "signed", "space_id": space_id}
