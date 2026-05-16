"""Processing pipeline trigger and status endpoint."""
import asyncio
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import ProcessingJob, MemoryCard, PersonaCapsule
from app.services.pipeline import run_full_pipeline, PIPELINE_STEPS

router = APIRouter(prefix="/api/memory-spaces", tags=["processing"])


@router.post("/{space_id}/process")
async def trigger_processing(
    space_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Trigger the full 13-step processing pipeline in the background."""
    background_tasks.add_task(run_full_pipeline, space_id)
    return {"status": "started", "space_id": space_id, "total_steps": len(PIPELINE_STEPS)}


@router.get("/{space_id}/setup-status")
async def get_setup_status(space_id: str, db: AsyncSession = Depends(get_db)):
    """
    Return real pipeline step statuses from database.
    Shows actual tool errors and missing tools — never fake success.
    """
    jobs_result = await db.execute(
        select(ProcessingJob).where(ProcessingJob.space_id == space_id).order_by(ProcessingJob.step_index)
    )
    jobs = jobs_result.scalars().all()

    # Build complete step list (fill gaps with pending)
    step_statuses = []
    jobs_by_index = {j.step_index: j for j in jobs}

    for idx, (_, step_name) in enumerate(PIPELINE_STEPS):
        job = jobs_by_index.get(idx)
        step_statuses.append({
            "step_index": idx,
            "step_name": step_name,
            "status": job.status.value if job else "not_started",
            "error": job.error_message if job else None,
            "tool_missing": job.tool_missing if job else None,
            "setup_instruction": job.setup_instruction if job else None,
            "metrics": job.metrics if job else None,
            "started_at": job.started_at.isoformat() if job and job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job and job.completed_at else None,
        })

    # Summary metrics from real DB
    cards_result = await db.execute(
        select(MemoryCard).where(MemoryCard.space_id == space_id)
    )
    cards = cards_result.scalars().all()

    capsule_result = await db.execute(
        select(PersonaCapsule).where(PersonaCapsule.space_id == space_id)
    )
    capsule = capsule_result.scalar_one_or_none()

    return {
        "space_id": space_id,
        "steps": step_statuses,
        "summary": {
            "total_steps": len(PIPELINE_STEPS),
            "completed_steps": sum(1 for s in step_statuses if s["status"] == "done"),
            "memory_cards_created": len(cards),
            "approved_cards": sum(1 for c in cards if c.status.value == "approved"),
            "has_persona_capsule": capsule is not None,
        },
    }
