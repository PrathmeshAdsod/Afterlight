"""
Local multimodal media processor.
Uses real tools: faster-whisper, pytesseract, opencv, ffmpeg.
If a tool is missing, reports ToolMissingError with setup instructions.
Never fakes output.
"""
import os
import subprocess
import shutil
import logging
import tempfile
from pathlib import Path
from dataclasses import dataclass, field
from app.core.config import settings

logger = logging.getLogger(__name__)


# ─── Tool Detection ────────────────────────────────────────────────────────────

@dataclass
class ToolStatus:
    name: str
    available: bool
    version: str | None = None
    setup_instruction: str | None = None


def check_ffmpeg() -> ToolStatus:
    try:
        r = subprocess.run(
            [settings.FFMPEG_BIN, "-version"],
            capture_output=True, text=True, timeout=5
        )
        if r.returncode == 0:
            version = r.stdout.split("\n")[0]
            return ToolStatus("ffmpeg", True, version)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return ToolStatus(
        "ffmpeg", False,
        setup_instruction="Install FFmpeg: https://ffmpeg.org/download.html and add to PATH"
    )


def check_tesseract() -> ToolStatus:
    try:
        import pytesseract
        cmd = settings.TESSERACT_CMD or "tesseract"
        if settings.TESSERACT_CMD:
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
        r = subprocess.run([cmd, "--version"], capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            version = r.stdout.split("\n")[0]
            return ToolStatus("tesseract", True, version)
    except (FileNotFoundError, subprocess.TimeoutExpired, ImportError):
        pass
    return ToolStatus(
        "tesseract", False,
        setup_instruction=(
            "Install Tesseract: https://github.com/UB-Mannheim/tesseract/wiki\n"
            "Then pip install pytesseract"
        )
    )


def check_whisper() -> ToolStatus:
    try:
        from faster_whisper import WhisperModel  # noqa
        return ToolStatus("faster-whisper", True)
    except ImportError:
        return ToolStatus(
            "faster-whisper", False,
            setup_instruction="pip install faster-whisper"
        )


def check_opencv() -> ToolStatus:
    try:
        import cv2  # noqa
        return ToolStatus("opencv", True, cv2.__version__)
    except ImportError:
        return ToolStatus(
            "opencv", False,
            setup_instruction="pip install opencv-python-headless"
        )


def get_all_tool_statuses() -> dict[str, ToolStatus]:
    return {
        "ffmpeg": check_ffmpeg(),
        "tesseract": check_tesseract(),
        "faster_whisper": check_whisper(),
        "opencv": check_opencv(),
    }


class ToolMissingError(Exception):
    def __init__(self, tool: str, instruction: str):
        super().__init__(f"Tool '{tool}' is not installed.")
        self.tool = tool
        self.instruction = instruction


# ─── Transcript Dataclass ──────────────────────────────────────────────────────

@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str
    language: str = "en"


@dataclass
class TranscriptResult:
    segments: list[TranscriptSegment] = field(default_factory=list)
    full_text: str = ""
    language: str = "en"
    duration_seconds: float = 0.0
    word_count: int = 0


# ─── Audio Transcription ──────────────────────────────────────────────────────

def transcribe_audio(audio_path: str, language: str | None = None) -> TranscriptResult:
    """
    Transcribe audio using faster-whisper.
    Runs on GPU (float16) if CUDA is available, else CPU (int8).
    Real transcription — no faking. Raises ToolMissingError if not installed.
    """
    status = check_whisper()
    if not status.available:
        raise ToolMissingError("faster-whisper", status.setup_instruction)

    from faster_whisper import WhisperModel

    device = settings.whisper_device_auto
    compute_type = settings.whisper_compute_type_auto
    model_size = settings.WHISPER_MODEL

    logger.info(f"Transcribing: {audio_path} | device={device} compute={compute_type} model={model_size}")
    model = WhisperModel(model_size, device=device, compute_type=compute_type)

    kwargs = {"beam_size": 5, "vad_filter": True}
    if language:
        kwargs["language"] = language

    segments_iter, info = model.transcribe(audio_path, **kwargs)

    segments = []
    full_text_parts = []

    for seg in segments_iter:
        segments.append(TranscriptSegment(
            start=seg.start,
            end=seg.end,
            text=seg.text.strip(),
            language=info.language,
        ))
        full_text_parts.append(seg.text.strip())

    full_text = " ".join(full_text_parts)
    return TranscriptResult(
        segments=segments,
        full_text=full_text,
        language=info.language,
        duration_seconds=info.duration,
        word_count=len(full_text.split()),
    )


# ─── Video Processing ─────────────────────────────────────────────────────────

def extract_audio_from_video(video_path: str, output_dir: str) -> str:
    """Extract audio track from video using ffmpeg."""
    ffmpeg_status = check_ffmpeg()
    if not ffmpeg_status.available:
        raise ToolMissingError("ffmpeg", ffmpeg_status.setup_instruction)

    os.makedirs(output_dir, exist_ok=True)
    audio_path = os.path.join(output_dir, "extracted_audio.wav")

    cmd = [
        settings.FFMPEG_BIN, "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        audio_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg audio extraction failed: {result.stderr}")

    return audio_path


def extract_frames_from_video(
    video_path: str,
    output_dir: str,
    fps: float = 1.0,
    chunk_seconds: int = 60,
) -> list[dict]:
    """
    Extract frames from video at given FPS per chunk.
    Returns list of {path, timestamp_seconds} dicts.
    Real extraction via OpenCV. Raises ToolMissingError if opencv missing.
    """
    cv_status = check_opencv()
    if not cv_status.available:
        raise ToolMissingError("opencv", cv_status.setup_instruction)

    import cv2
    os.makedirs(output_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / video_fps if video_fps > 0 else 0

    frame_interval = int(video_fps / fps) if fps > 0 else int(video_fps)
    frame_interval = max(1, frame_interval)

    extracted = []
    frame_idx = 0
    saved_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            timestamp = frame_idx / video_fps
            frame_path = os.path.join(output_dir, f"frame_{saved_count:06d}_{timestamp:.2f}s.jpg")
            cv2.imwrite(frame_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            extracted.append({"path": frame_path, "timestamp_seconds": timestamp})
            saved_count += 1

        frame_idx += 1

    cap.release()
    logger.info(f"Extracted {saved_count} frames from {video_path} (duration={duration:.1f}s)")
    return extracted


# ─── OCR ──────────────────────────────────────────────────────────────────────

def run_ocr_on_image(image_path: str, language: str = "eng") -> str:
    """
    Run Tesseract OCR on an image file.
    Raises ToolMissingError if tesseract is not installed.
    """
    tess_status = check_tesseract()
    if not tess_status.available:
        raise ToolMissingError("tesseract", tess_status.setup_instruction)

    import pytesseract
    from PIL import Image

    if settings.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

    img = Image.open(image_path)
    text = pytesseract.image_to_string(img, lang=language)
    return text.strip()


def run_ocr_on_pdf(pdf_path: str) -> str:
    """Extract text from PDF using pytesseract page-by-page."""
    try:
        from pdf2image import convert_from_path
        pages = convert_from_path(pdf_path, dpi=200)
        all_text = []
        for i, page in enumerate(pages):
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                page.save(tmp.name, "PNG")
                text = run_ocr_on_image(tmp.name)
                all_text.append(f"[Page {i+1}]\n{text}")
                os.unlink(tmp.name)
        return "\n\n".join(all_text)
    except ImportError:
        # Fallback: try pdfminer
        try:
            from pdfminer.high_level import extract_text
            return extract_text(pdf_path)
        except ImportError:
            return ""


def extract_text_from_document(file_path: str) -> str:
    """Extract text from document (txt, pdf, etc.)"""
    ext = Path(file_path).suffix.lower()
    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    elif ext == ".pdf":
        return run_ocr_on_pdf(file_path)
    elif ext in (".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"):
        return run_ocr_on_image(file_path)
    else:
        # Try reading as text
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception:
            return ""


# ─── Evidence Script Builder ──────────────────────────────────────────────────

def build_evidence_script(
    transcript: TranscriptResult | None,
    ocr_text: str | None,
    frame_descriptions: list[str] | None,
    metadata: dict | None,
    chunk_size_seconds: int = 120,
) -> list[dict]:
    """
    Build time-coded evidence chunks from all modalities.
    Returns list of {chunk_index, start_time, end_time, content} dicts.
    """
    chunks = []

    if transcript and transcript.segments:
        # Group segments into chunks
        current_chunk: list[TranscriptSegment] = []
        chunk_start = transcript.segments[0].start
        chunk_idx = 0

        for seg in transcript.segments:
            current_chunk.append(seg)
            chunk_duration = seg.end - chunk_start

            if chunk_duration >= chunk_size_seconds:
                text = " ".join(s.text for s in current_chunk)
                chunks.append({
                    "chunk_index": chunk_idx,
                    "start_time": chunk_start,
                    "end_time": seg.end,
                    "content": f"[Audio transcript {chunk_start:.0f}s-{seg.end:.0f}s]\n{text}",
                    "type": "transcript",
                })
                chunk_idx += 1
                current_chunk = []
                chunk_start = seg.end

        if current_chunk:
            text = " ".join(s.text for s in current_chunk)
            chunks.append({
                "chunk_index": chunk_idx,
                "start_time": chunk_start,
                "end_time": current_chunk[-1].end,
                "content": f"[Audio transcript {chunk_start:.0f}s-{current_chunk[-1].end:.0f}s]\n{text}",
                "type": "transcript",
            })

    if ocr_text and ocr_text.strip():
        # Split long OCR into chunks of ~2000 chars
        chunk_size = 2000
        for i in range(0, len(ocr_text), chunk_size):
            chunk = ocr_text[i:i+chunk_size]
            chunks.append({
                "chunk_index": len(chunks),
                "start_time": None,
                "end_time": None,
                "content": f"[Document text]\n{chunk}",
                "type": "ocr",
            })

    if frame_descriptions:
        for i, desc in enumerate(frame_descriptions):
            chunks.append({
                "chunk_index": len(chunks),
                "start_time": None,
                "end_time": None,
                "content": f"[Visual frame {i}]\n{desc}",
                "type": "frame",
            })

    return chunks
