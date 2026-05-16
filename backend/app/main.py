"""
Afterlight FastAPI Application
"""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db

logging.basicConfig(level=logging.INFO if not settings.DEBUG else logging.DEBUG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Afterlight backend...")
    os.makedirs(settings.STORAGE_BASE, exist_ok=True)
    os.makedirs(settings.assets_dir, exist_ok=True)
    os.makedirs(settings.training_dir, exist_ok=True)
    os.makedirs(settings.adapters_dir, exist_ok=True)
    os.makedirs(settings.chroma_dir, exist_ok=True)
    os.makedirs(settings.transcripts_dir, exist_ok=True)
    await init_db()
    logger.info(f"Database initialized. Ollama target: {settings.OLLAMA_BASE_URL} / {settings.OLLAMA_MODEL}")
    yield
    # Shutdown
    logger.info("Shutting down Afterlight backend.")


app = FastAPI(
    title="Afterlight API",
    description="Private local-first Presence Engine — powered by Gemma 4",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
from app.api.health import router as health_router
from app.api.memory_spaces import router as spaces_router
from app.api.assets import router as assets_router
from app.api.processing import router as processing_router
from app.api.memories import router as memories_router
from app.api.training import router as training_router
from app.api.talk import router as talk_router
from app.api.persona import router as persona_router
from app.api.misc import router as misc_router

from app.api.app_settings import router as app_settings_router

app.include_router(health_router)
app.include_router(spaces_router)
app.include_router(assets_router)
app.include_router(processing_router)
app.include_router(memories_router)
app.include_router(training_router)
app.include_router(talk_router)
app.include_router(persona_router)
app.include_router(misc_router)
app.include_router(app_settings_router)


@app.get("/")
async def root():
    return {
        "product": "Afterlight",
        "tagline": "Preserve the stories before they fade.",
        "version": "1.0.0",
        "ai_model": settings.OLLAMA_MODEL,
        "docs": "/docs",
    }
