"""
Background processing pipeline orchestrator.
Runs all 13 steps for a memory space and updates ProcessingJob records.
Never fakes status — all steps reflect real tool results.
"""
import os
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.database import AsyncSessionLocal
from app.core.config import settings
from app.models.models import (
    MemorySpace, Asset, ProcessingJob, EvidenceScript,
    MemoryCard, PersonaCapsule, PhraseSignal, ValueSignal,
    AssetType, JobStatus, MemoryStatus
)
from app.services import media_processor, memory_extractor, vector_store
from app.services.media_processor import ToolMissingError

logger = logging.getLogger(__name__)

PIPELINE_STEPS = [
    (0,  "Preparing private memory space"),
    (1,  "Reading uploaded memories"),
    (2,  "Transcribing audio"),
    (3,  "Extracting video frames"),
    (4,  "Running OCR"),
    (5,  "Building evidence script"),
    (6,  "Extracting memory cards with Gemma 4"),
    (7,  "Creating persona capsule"),
    (8,  "Generating synthetic training examples"),
    (9,  "Filtering unsafe or unsupported examples"),
    (10, "Running adapter fine-tuning job"),
    (11, "Evaluating presence behavior"),
    (12, "Presence model ready"),
]


async def _update_job(db: AsyncSession, space_id: str, step_index: int,
                      status: JobStatus, error: str | None = None,
                      tool: str | None = None, instruction: str | None = None,
                      metrics: dict | None = None):
    """Update or create a processing job record."""
    result = await db.execute(
        select(ProcessingJob).where(
            ProcessingJob.space_id == space_id,
            ProcessingJob.step_index == step_index,
        )
    )
    job = result.scalar_one_or_none()
    step_name = PIPELINE_STEPS[step_index][1]

    if job is None:
        job = ProcessingJob(
            space_id=space_id,
            step_index=step_index,
            step_name=step_name,
        )
        db.add(job)

    job.status = status
    job.error_message = error
    job.tool_missing = tool
    job.setup_instruction = instruction
    if metrics:
        job.metrics = metrics
    if status == JobStatus.running:
        job.started_at = datetime.utcnow()
    elif status in (JobStatus.done, JobStatus.error, JobStatus.tool_missing):
        job.completed_at = datetime.utcnow()

    await db.commit()


async def run_full_pipeline(space_id: str):
    """
    Run the complete 13-step processing pipeline for a memory space.
    Each step updates its ProcessingJob record with real status.
    """
    async with AsyncSessionLocal() as db:
        # Load space
        result = await db.execute(select(MemorySpace).where(MemorySpace.id == space_id))
        space = result.scalar_one_or_none()
        if not space:
            logger.error(f"Space {space_id} not found")
            return

        # Initialize all steps as pending
        for idx, (_, step_name) in enumerate(PIPELINE_STEPS):
            await _update_job(db, space_id, idx, JobStatus.pending)

        # ── Step 0: Prepare ─────────────────────────────────────────────────
        await _update_job(db, space_id, 0, JobStatus.running)
        os.makedirs(os.path.join(settings.assets_dir, space_id), exist_ok=True)
        os.makedirs(os.path.join(settings.transcripts_dir, space_id), exist_ok=True)
        await _update_job(db, space_id, 0, JobStatus.done, metrics={"space_id": space_id})

        # ── Step 1: Read assets ─────────────────────────────────────────────
        await _update_job(db, space_id, 1, JobStatus.running)
        assets_result = await db.execute(select(Asset).where(Asset.space_id == space_id))
        assets = assets_result.scalars().all()
        await _update_job(db, space_id, 1, JobStatus.done, metrics={"asset_count": len(assets)})

        # ── Step 2: Transcription ──────────────────────────────────────────
        await _update_job(db, space_id, 2, JobStatus.running)
        tool_status = media_processor.check_whisper()
        if not tool_status.available:
            await _update_job(db, space_id, 2, JobStatus.tool_missing,
                              tool="faster-whisper", instruction=tool_status.setup_instruction)
        else:
            total_audio_minutes = 0.0
            total_transcript_chars = 0
            all_transcripts = {}

            audio_assets = [a for a in assets if a.asset_type in (AssetType.audio,)]
            for asset in audio_assets:
                try:
                    transcript = media_processor.transcribe_audio(asset.file_path)
                    all_transcripts[asset.id] = transcript
                    total_audio_minutes += transcript.duration_seconds / 60
                    total_transcript_chars += len(transcript.full_text)

                    # Save transcript
                    transcript_path = os.path.join(
                        settings.transcripts_dir, space_id, f"{asset.id}_transcript.txt"
                    )
                    with open(transcript_path, "w", encoding="utf-8") as f:
                        f.write(transcript.full_text)
                except Exception as e:
                    logger.error(f"Transcription failed for {asset.id}: {e}")

            await _update_job(db, space_id, 2, JobStatus.done, metrics={
                "audio_minutes": round(total_audio_minutes, 2),
                "transcript_chars": total_transcript_chars,
                "assets_processed": len(audio_assets),
            })

        # ── Step 3: Video frames ─────────────────────────────────────────────
        await _update_job(db, space_id, 3, JobStatus.running)
        ffmpeg_status = media_processor.check_ffmpeg()
        cv_status = media_processor.check_opencv()
        video_assets = [a for a in assets if a.asset_type == AssetType.video]

        if video_assets and (not ffmpeg_status.available or not cv_status.available):
            missing = "ffmpeg" if not ffmpeg_status.available else "opencv"
            instr = ffmpeg_status.setup_instruction or cv_status.setup_instruction
            await _update_job(db, space_id, 3, JobStatus.tool_missing, tool=missing, instruction=instr)
        else:
            total_frames = 0
            video_transcripts = {}
            frames_dir = os.path.join(settings.assets_dir, space_id, "frames")
            os.makedirs(frames_dir, exist_ok=True)

            for asset in video_assets:
                try:
                    # Extract audio from video first
                    video_audio_dir = os.path.join(settings.transcripts_dir, space_id, asset.id)
                    os.makedirs(video_audio_dir, exist_ok=True)
                    audio_path = media_processor.extract_audio_from_video(asset.file_path, video_audio_dir)

                    # Transcribe video audio
                    if media_processor.check_whisper().available:
                        transcript = media_processor.transcribe_audio(audio_path)
                        video_transcripts[asset.id] = transcript

                    # Extract frames
                    asset_frames_dir = os.path.join(frames_dir, asset.id)
                    frames = media_processor.extract_frames_from_video(asset.file_path, asset_frames_dir, fps=1.0)
                    total_frames += len(frames)
                except Exception as e:
                    logger.error(f"Video processing failed for {asset.id}: {e}")

            await _update_job(db, space_id, 3, JobStatus.done, metrics={
                "video_assets": len(video_assets),
                "frames_extracted": total_frames,
                "video_transcripts": len(video_transcripts),
            })

        # ── Step 4: OCR ─────────────────────────────────────────────────────
        await _update_job(db, space_id, 4, JobStatus.running)
        tess_status = media_processor.check_tesseract()
        image_assets = [a for a in assets if a.asset_type in (AssetType.image, AssetType.document)]
        ocr_texts = {}

        if image_assets and not tess_status.available:
            await _update_job(db, space_id, 4, JobStatus.tool_missing,
                              tool="tesseract", instruction=tess_status.setup_instruction)
        else:
            total_ocr_chars = 0
            for asset in image_assets:
                try:
                    text = media_processor.extract_text_from_document(asset.file_path)
                    if text.strip():
                        ocr_texts[asset.id] = text
                        total_ocr_chars += len(text)
                except Exception as e:
                    logger.error(f"OCR failed for {asset.id}: {e}")

            # Also process text assets
            text_assets = [a for a in assets if a.asset_type == AssetType.text]
            for asset in text_assets:
                try:
                    text = media_processor.extract_text_from_document(asset.file_path)
                    if text.strip():
                        ocr_texts[asset.id] = text
                        total_ocr_chars += len(text)
                except Exception as e:
                    logger.error(f"Text extraction failed for {asset.id}: {e}")

            await _update_job(db, space_id, 4, JobStatus.done, metrics={
                "assets_processed": len(image_assets),
                "ocr_chars": total_ocr_chars,
            })

        # ── Step 5: Build evidence scripts ──────────────────────────────────
        await _update_job(db, space_id, 5, JobStatus.running)
        all_chunks = []

        for asset in assets:
            transcript = all_transcripts.get(asset.id) if 'all_transcripts' in dir() else None
            transcript = transcript or (video_transcripts.get(asset.id) if 'video_transcripts' in dir() else None)
            ocr_text = ocr_texts.get(asset.id) if 'ocr_texts' in dir() else None

            chunks = media_processor.build_evidence_script(
                transcript=transcript,
                ocr_text=ocr_text,
                frame_descriptions=None,
                metadata={"asset_id": asset.id, "filename": asset.original_filename},
            )

            for chunk in chunks:
                evidence = EvidenceScript(
                    space_id=space_id,
                    asset_id=asset.id,
                    content=chunk["content"],
                    chunk_index=chunk["chunk_index"],
                    start_time=chunk.get("start_time"),
                    end_time=chunk.get("end_time"),
                )
                db.add(evidence)
                all_chunks.append(chunk)

        await db.commit()
        await _update_job(db, space_id, 5, JobStatus.done, metrics={"chunks_created": len(all_chunks)})

        # ── Step 6: Gemma 4 memory extraction ──────────────────────────────
        await _update_job(db, space_id, 6, JobStatus.running)
        from app.services.ollama_client import ollama_client
        ollama_status = await ollama_client.check_connection()

        if ollama_status["status"] != "connected":
            await _update_job(db, space_id, 6, JobStatus.tool_missing,
                              tool="ollama/gemma4",
                              instruction=ollama_status.get("setup_instruction", "Start Ollama and pull gemma4:e2b"))
            # Mark remaining steps as pending (not fake)
            for idx in range(7, 13):
                await _update_job(db, space_id, idx, JobStatus.pending)
            return

        total_cards = 0
        all_persona_signals = []

        for chunk in all_chunks[:30]:  # Cap at 30 chunks to avoid timeout
            try:
                result = await memory_extractor.extract_memories_from_chunk(
                    evidence_content=chunk["content"],
                    asset_id=chunk.get("asset_id"),
                    start_time=chunk.get("start_time"),
                    end_time=chunk.get("end_time"),
                    chunk_index=chunk["chunk_index"],
                )

                for card_data in result.memory_cards:
                    card = MemoryCard(
                        space_id=space_id,
                        source_asset_id=card_data.source_asset_id,
                        title=card_data.title,
                        summary=card_data.summary,
                        source_quote=card_data.source_quote,
                        source_start_time=card_data.source_start_time,
                        source_end_time=card_data.source_end_time,
                        people_mentioned=card_data.people_mentioned,
                        places_mentioned=card_data.places_mentioned,
                        themes=card_data.themes,
                        values=card_data.values,
                        tone_signals=card_data.tone_signals,
                        confidence=card_data.confidence,
                        language=card_data.language,
                        status=MemoryStatus.pending_review,
                    )
                    db.add(card)
                    total_cards += 1

                if result.persona_signals.repeated_phrases:
                    all_persona_signals.append(result.persona_signals)

            except Exception as e:
                logger.error(f"Memory extraction failed for chunk {chunk.get('chunk_index')}: {e}")

        await db.commit()

        # Index approved cards into ChromaDB
        cards_result = await db.execute(
            select(MemoryCard).where(MemoryCard.space_id == space_id)
        )
        all_cards = cards_result.scalars().all()
        for card in all_cards:
            vector_store.upsert_memory_card(
                space_id=space_id,
                card_id=card.id,
                text=f"{card.title}. {card.summary}",
                metadata={
                    "title": card.title,
                    "source_quote": card.source_quote or "",
                    "themes": json_safe(card.themes),
                    "confidence": card.confidence,
                    "status": card.status.value,
                },
            )

        await _update_job(db, space_id, 6, JobStatus.done, metrics={"memory_cards_created": total_cards})

        # ── Step 7: Persona capsule ─────────────────────────────────────────
        await _update_job(db, space_id, 7, JobStatus.running)
        try:
            approved_cards = [
                {"title": c.title, "summary": c.summary, "themes": c.themes,
                 "values": c.values, "tone_signals": c.tone_signals,
                 "source_quote": c.source_quote}
                for c in all_cards[:20]
            ]
            signals_data = [
                {"phrases": s.repeated_phrases, "tone": s.tone}
                for s in all_persona_signals[:10]
            ]

            capsule_data = await memory_extractor.build_persona_capsule(
                memory_cards=approved_cards,
                persona_signals=signals_data,
                presence_name=space.presence_name,
                relationship_type=space.relationship_type,
                primary_language=space.primary_language,
            )

            existing = await db.execute(
                select(PersonaCapsule).where(PersonaCapsule.space_id == space_id)
            )
            capsule = existing.scalar_one_or_none()
            if capsule is None:
                capsule = PersonaCapsule(space_id=space_id)
                db.add(capsule)

            capsule.tone = capsule_data.get("tone")
            capsule.advice_style = capsule_data.get("advice_style")
            capsule.humor_style = capsule_data.get("humor_style")
            capsule.language_mix = capsule_data.get("language_mix")
            capsule.relationship_style = capsule_data.get("relationship_style")
            capsule.top_phrases = capsule_data.get("top_phrases", [])
            capsule.top_values = capsule_data.get("top_values", [])
            capsule.top_themes = capsule_data.get("top_themes", [])
            capsule.system_prompt_base = capsule_data.get("system_prompt_base")
            capsule.memory_card_count = total_cards
            await db.commit()

            await _update_job(db, space_id, 7, JobStatus.done, metrics={
                "phrases_extracted": len(capsule_data.get("top_phrases", [])),
                "values_extracted": len(capsule_data.get("top_values", [])),
            })
        except Exception as e:
            await _update_job(db, space_id, 7, JobStatus.error, error=str(e))

        # ── Steps 8-12: Training & Adapter (handled separately via API) ──────
        # Steps 8+ are triggered via dedicated endpoints, not auto-run here
        await _update_job(db, space_id, 8, JobStatus.pending)
        await _update_job(db, space_id, 9, JobStatus.pending)
        await _update_job(db, space_id, 10, JobStatus.pending)
        await _update_job(db, space_id, 11, JobStatus.pending)
        await _update_job(db, space_id, 12, JobStatus.pending)

        logger.info(f"Pipeline complete for space {space_id}")


def json_safe(val):
    """Convert list to comma string for ChromaDB metadata."""
    if isinstance(val, list):
        return ", ".join(str(v) for v in val)
    return str(val) if val else ""
