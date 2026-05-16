"""
Afterlight Backend Configuration
Loads from .env — all AI settings configurable, no hardcoded model names.
GPU-aware: RTX 5050 Blackwell (sm_120) via PyTorch nightly + Ollama.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── App ──────────────────────────────────────────────────────
    APP_NAME: str = "Afterlight"
    DEBUG: bool = False
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ─── Ollama / Gemma 4 ─────────────────────────────────────────
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma4:e2b"

    # ─── Adapter Fine-Tuning ──────────────────────────────────────
    HF_GEMMA4_MODEL: str = "google/gemma-4-e2b-it"
    HF_TOKEN: str = ""

    # ─── Embedding Model ──────────────────────────────────────────
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # ─── Storage ──────────────────────────────────────────────────
    STORAGE_BASE: str = "./storage"

    # ─── GPU / Whisper ────────────────────────────────────────────
    WHISPER_DEVICE: str = "cuda"         # "cuda" or "cpu"
    WHISPER_MODEL: str = "small"        # 0.24GB VRAM, ~4-8s per min audio on GPU
    WHISPER_COMPUTE_TYPE: str = "float16"  # float16 on GPU, int8 on CPU

    # ─── TTS — ElevenLabs (optional, for real voice cloning) ──────
    # Leave empty to use browser Web Speech Synthesis (free, no account needed)
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = ""   # set after cloning voice via /clone-voice

    # ─── QLoRA Training ───────────────────────────────────────────
    TRAIN_LORA_RANK: int = 16
    TRAIN_LORA_ALPHA: int = 32
    TRAIN_BATCH_SIZE: int = 1
    TRAIN_GRAD_ACCUM: int = 4
    TRAIN_EPOCHS: int = 3
    TRAIN_LR: float = 2e-4
    TRAIN_MAX_LENGTH: int = 256

    # ─── System Tools ─────────────────────────────────────────────
    TESSERACT_CMD: str = ""
    FFMPEG_BIN: str = "ffmpeg"
    FFPROBE_BIN: str = "ffprobe"

    # ─── Derived Paths ────────────────────────────────────────────
    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def assets_dir(self) -> str:
        return os.path.join(self.STORAGE_BASE, "assets")

    @property
    def training_dir(self) -> str:
        return os.path.join(self.STORAGE_BASE, "training")

    @property
    def adapters_dir(self) -> str:
        return os.path.join(self.STORAGE_BASE, "adapters")

    @property
    def chroma_dir(self) -> str:
        return os.path.join(self.STORAGE_BASE, "chroma")

    @property
    def transcripts_dir(self) -> str:
        return os.path.join(self.STORAGE_BASE, "transcripts")

    @property
    def whisper_compute_type_auto(self) -> str:
        """Auto-select compute type: float16 on GPU, int8 on CPU."""
        try:
            import torch
            if torch.cuda.is_available():
                return self.WHISPER_COMPUTE_TYPE
        except ImportError:
            pass
        return "int8"

    @property
    def whisper_device_auto(self) -> str:
        """Auto-select device: cuda if available, else cpu."""
        try:
            import torch
            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"


settings = Settings()
