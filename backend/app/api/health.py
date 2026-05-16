"""Health check endpoint — shows Ollama and tool status honestly."""
from fastapi import APIRouter
from app.services.ollama_client import ollama_client
from app.services.media_processor import get_all_tool_statuses

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health():
    ollama_status = await ollama_client.check_connection()
    tools = get_all_tool_statuses()
    return {
        "status": "ok",
        "ollama": ollama_status,
        "tools": {
            name: {
                "available": ts.available,
                "version": ts.version,
                "setup_instruction": ts.setup_instruction,
            }
            for name, ts in tools.items()
        },
    }
