"""Asset upload and listing."""
import os
import shutil
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pathlib import Path
from app.core.database import get_db
from app.core.config import settings
from app.models.models import Asset, AssetType

router = APIRouter(prefix="/api/memory-spaces", tags=["assets"])

ALLOWED_EXTENSIONS = {
    "audio": {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"},
    "video": {".mp4", ".mov", ".avi", ".mkv", ".webm"},
    "image": {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"},
    "document": {".pdf", ".txt", ".doc", ".docx"},
    "text": {".txt"},
}


def detect_asset_type(filename: str) -> AssetType:
    ext = Path(filename).suffix.lower()
    for atype, exts in ALLOWED_EXTENSIONS.items():
        if ext in exts:
            if atype == "text":
                return AssetType.text
            return AssetType[atype]
    raise HTTPException(400, f"Unsupported file type: {ext}")


@router.post("/{space_id}/assets")
async def upload_asset(
    space_id: str,
    file: UploadFile = File(...),
    language: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
):
    asset_type = detect_asset_type(file.filename)

    # Save file
    space_dir = os.path.join(settings.assets_dir, space_id)
    os.makedirs(space_dir, exist_ok=True)

    import uuid
    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix
    file_path = os.path.join(space_dir, f"{file_id}{ext}")

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    file_size = os.path.getsize(file_path)

    asset = Asset(
        space_id=space_id,
        original_filename=file.filename,
        asset_type=asset_type,
        file_path=file_path,
        file_size_bytes=file_size,
        language=language or None,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    return {
        "id": asset.id,
        "original_filename": asset.original_filename,
        "asset_type": asset.asset_type.value,
        "file_size_bytes": asset.file_size_bytes,
        "uploaded_at": asset.uploaded_at.isoformat(),
        "processing_status": asset.processing_status.value,
    }


@router.get("/{space_id}/assets")
async def list_assets(space_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Asset).where(Asset.space_id == space_id).order_by(Asset.uploaded_at.desc())
    )
    assets = result.scalars().all()
    return [
        {
            "id": a.id,
            "original_filename": a.original_filename,
            "asset_type": a.asset_type.value,
            "file_size_bytes": a.file_size_bytes,
            "duration_seconds": a.duration_seconds,
            "processing_status": a.processing_status.value,
            "uploaded_at": a.uploaded_at.isoformat(),
        }
        for a in assets
    ]
