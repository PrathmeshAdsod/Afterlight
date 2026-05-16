"""Training data generation and adapter job routes."""
import os
import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.database import get_db, AsyncSessionLocal
from app.core.config import settings
from app.models.models import (
    MemorySpace, MemoryCard, PersonaCapsule, TrainingExample,
    TrainingValidationResult, AdapterJob, AdapterJobStatus,
    ProcessingJob, JobStatus, MemoryStatus
)
from app.services.training_data_generator import (
    generate_training_examples, validate_training_examples, save_training_jsonl
)

router = APIRouter(prefix="/api/memory-spaces", tags=["training"])


@router.post("/{space_id}/generate-training-data")
async def generate_training_data(
    space_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Generate synthetic training JSONL from approved memory cards using Gemma 4."""
    background_tasks.add_task(_run_training_data_generation, space_id)
    return {"status": "started", "space_id": space_id}


async def _run_training_data_generation(space_id: str):
    async with AsyncSessionLocal() as db:
        # Update step 8 to running
        await _update_step(db, space_id, 8, JobStatus.running)

        # Load approved memory cards
        cards_result = await db.execute(
            select(MemoryCard).where(
                MemoryCard.space_id == space_id,
                MemoryCard.status == MemoryStatus.approved,
            )
        )
        approved_cards = cards_result.scalars().all()

        if not approved_cards:
            await _update_step(db, space_id, 8, JobStatus.error,
                               error="No approved memory cards. Please review and approve memories first.")
            return

        # Load persona capsule
        capsule_result = await db.execute(
            select(PersonaCapsule).where(PersonaCapsule.space_id == space_id)
        )
        capsule = capsule_result.scalar_one_or_none()
        capsule_dict = {}
        if capsule:
            capsule_dict = {
                "tone": capsule.tone or "",
                "top_phrases": capsule.top_phrases or [],
                "top_values": capsule.top_values or [],
                "language_mix": capsule.language_mix or "English",
            }

        # Load space name
        space_result = await db.execute(select(MemorySpace).where(MemorySpace.id == space_id))
        space = space_result.scalar_one_or_none()

        approved_cards_dicts = [
            {"title": c.title, "summary": c.summary, "source_quote": c.source_quote,
             "themes": c.themes, "values": c.values, "tone_signals": c.tone_signals}
            for c in approved_cards
        ]

        try:
            examples = await generate_training_examples(
                space_id=space_id,
                presence_name=space.presence_name,
                approved_memory_cards=approved_cards_dicts,
                persona_capsule=capsule_dict,
                target_count=60,
            )
        except Exception as e:
            await _update_step(db, space_id, 8, JobStatus.error, error=str(e))
            return

        # Step 9: Validate
        await _update_step(db, space_id, 9, JobStatus.running)
        valid, invalid = validate_training_examples(examples)

        # Save valid examples to DB
        for ex in valid:
            msgs = ex.get("messages", [])
            te = TrainingExample(
                space_id=space_id,
                example_type=ex.get("type", "unknown"),
                user_message=msgs[0]["content"] if msgs else "",
                assistant_response=msgs[1]["content"] if len(msgs) > 1 else "",
                is_valid=True,
            )
            db.add(te)

        for ex in invalid:
            msgs = ex.get("messages", [])
            te = TrainingExample(
                space_id=space_id,
                example_type=ex.get("type", "unknown"),
                user_message=msgs[0]["content"] if msgs else "",
                assistant_response=msgs[1]["content"] if len(msgs) > 1 else "",
                is_valid=False,
                rejection_reason=ex.get("rejection_reason"),
            )
            db.add(te)

        # Save JSONL
        jsonl_path = save_training_jsonl(space_id, valid, space.presence_name)

        # Save validation result
        vr = TrainingValidationResult(
            space_id=space_id,
            total_generated=len(examples),
            total_valid=len(valid),
            total_invalid=len(invalid),
            jsonl_path=jsonl_path,
        )
        db.add(vr)
        await db.commit()

        await _update_step(db, space_id, 9, JobStatus.done, metrics={
            "total_generated": len(examples),
            "total_valid": len(valid),
            "total_invalid": len(invalid),
            "jsonl_path": jsonl_path,
        })
        await _update_step(db, space_id, 8, JobStatus.done, metrics={
            "training_pairs_generated": len(valid),
        })


async def _update_step(db, space_id, step_index, status, error=None, metrics=None):
    result = await db.execute(
        select(ProcessingJob).where(
            ProcessingJob.space_id == space_id,
            ProcessingJob.step_index == step_index,
        )
    )
    job = result.scalar_one_or_none()
    if job is None:
        from app.services.pipeline import PIPELINE_STEPS
        job = ProcessingJob(
            space_id=space_id,
            step_index=step_index,
            step_name=PIPELINE_STEPS[step_index][1],
        )
        db.add(job)
    job.status = status
    job.error_message = error
    if metrics:
        job.metrics = metrics
    if status == JobStatus.running:
        job.started_at = datetime.utcnow()
    elif status in (JobStatus.done, JobStatus.error):
        job.completed_at = datetime.utcnow()
    await db.commit()


@router.get("/{space_id}/training-data")
async def get_training_data(space_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TrainingValidationResult).where(TrainingValidationResult.space_id == space_id)
        .order_by(TrainingValidationResult.validated_at.desc()).limit(1)
    )
    vr = result.scalar_one_or_none()

    examples_result = await db.execute(
        select(TrainingExample).where(
            TrainingExample.space_id == space_id,
            TrainingExample.is_valid == True
        ).limit(20)
    )
    examples = examples_result.scalars().all()

    return {
        "validation_result": {
            "total_generated": vr.total_generated if vr else 0,
            "total_valid": vr.total_valid if vr else 0,
            "total_invalid": vr.total_invalid if vr else 0,
            "jsonl_path": vr.jsonl_path if vr else None,
            "validated_at": vr.validated_at.isoformat() if vr else None,
        } if vr else None,
        "examples_preview": [
            {
                "type": e.example_type,
                "user": e.user_message,
                "assistant": e.assistant_response,
            }
            for e in examples
        ],
    }


@router.post("/{space_id}/train-adapter")
async def create_adapter_job(space_id: str, db: AsyncSession = Depends(get_db)):
    """
    Create an AdapterJob record and return the training command.
    Actual training runs via CLI: python scripts/train_persona_adapter.py ...
    UI must NOT show "trained" until artifact exists on disk.
    """
    vr_result = await db.execute(
        select(TrainingValidationResult).where(TrainingValidationResult.space_id == space_id)
        .order_by(TrainingValidationResult.validated_at.desc()).limit(1)
    )
    vr = vr_result.scalar_one_or_none()
    if not vr or not vr.jsonl_path:
        raise HTTPException(400, "Generate training data first before creating adapter job.")

    adapter_output = os.path.join(settings.adapters_dir, space_id)
    training_cmd = (
        f"python backend/scripts/train_persona_adapter.py "
        f"--space_id {space_id} "
        f"--dataset_path \"{vr.jsonl_path}\" "
        f"--base_model {settings.HF_GEMMA4_MODEL} "
        f"--output_dir \"{adapter_output}\""
    )

    job = AdapterJob(
        space_id=space_id,
        status=AdapterJobStatus.not_started,
        base_model=settings.HF_GEMMA4_MODEL,
        dataset_path=vr.jsonl_path,
        output_adapter_path=adapter_output,
        training_command=training_cmd,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    return {
        "job_id": job.id,
        "status": job.status.value,
        "training_command": training_cmd,
        "base_model": job.base_model,
        "dataset_path": vr.jsonl_path,
        "output_dir": adapter_output,
        "note": "Run the training_command in your terminal to start fine-tuning. The UI will show 'Adapter ready' only when the artifact exists on disk.",
    }


@router.get("/{space_id}/adapter-job")
async def get_adapter_job(space_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns real adapter job status.
    Checks if adapter artifact actually exists on disk.
    """
    result = await db.execute(
        select(AdapterJob).where(AdapterJob.space_id == space_id)
        .order_by(AdapterJob.created_at.desc()).limit(1)
    )
    job = result.scalar_one_or_none()

    if not job:
        return {"status": "not_started", "message": "No adapter job created yet."}

    # Check if artifact actually exists on disk
    artifact_exists = False
    if job.output_adapter_path:
        adapter_config = os.path.join(job.output_adapter_path, "adapter_config.json")
        artifact_exists = os.path.exists(adapter_config)

    # Read metrics from file if they exist
    metrics = job.metrics
    if artifact_exists and job.output_adapter_path:
        metrics_path = os.path.join(job.output_adapter_path, "training_metrics.json")
        if os.path.exists(metrics_path):
            import json
            with open(metrics_path) as f:
                metrics = json.load(f)

    return {
        "job_id": job.id,
        "status": job.status.value,
        "artifact_exists": artifact_exists,
        "adapter_ready": artifact_exists and job.status == AdapterJobStatus.completed,
        "base_model": job.base_model,
        "dataset_path": job.dataset_path,
        "output_adapter_path": job.output_adapter_path,
        "training_command": job.training_command,
        "metrics": metrics,
        "error": job.error_message,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }
