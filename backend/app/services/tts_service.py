"""
Afterlight TTS Service — Text-to-Speech for Persona Voice
Uses ElevenLabs API if configured, otherwise signals frontend to use Web Speech.
Never fakes voice — if ElevenLabs is not configured, returns a clear status.
"""
import logging
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger("afterlight.tts")


async def _get_elevenlabs_key() -> str:
    """Read ElevenLabs API key from DB (user-entered via UI). Falls back to .env."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.models import AppSetting
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(AppSetting).where(AppSetting.key == "elevenlabs_api_key")
            )
            row = result.scalar_one_or_none()
            if row and row.value:
                return row.value
    except Exception:
        pass
    return settings.ELEVENLABS_API_KEY.strip()


async def _get_elevenlabs_voice_id() -> str:
    """Read voice_id from DB. Falls back to .env."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.models import AppSetting
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(AppSetting).where(AppSetting.key == "elevenlabs_voice_id")
            )
            row = result.scalar_one_or_none()
            if row and row.value:
                return row.value
    except Exception:
        pass
    return settings.ELEVENLABS_VOICE_ID.strip()



class TTSResult:
    def __init__(
        self,
        audio_bytes: bytes | None = None,
        content_type: str = "audio/mpeg",
        provider: str = "none",
        error: str | None = None,
        use_browser_tts: bool = False,
    ):
        self.audio_bytes = audio_bytes
        self.content_type = content_type
        self.provider = provider
        self.error = error
        self.use_browser_tts = use_browser_tts


async def synthesize_speech(
    text: str,
    voice_id: str | None = None,
    stability: float = 0.5,
    similarity_boost: float = 0.75,
    speed: float = 1.0,
) -> TTSResult:
    """
    Convert text to speech.
    - If ELEVENLABS_API_KEY is set: use ElevenLabs (real cloned voice).
    - If not: return use_browser_tts=True, frontend handles via Web Speech API.
    Never silently fake audio.
    """
    api_key = await _get_elevenlabs_key()

    if not api_key:
        logger.info("ElevenLabs not configured — frontend will use Web Speech Synthesis")
        return TTSResult(
            use_browser_tts=True,
            provider="browser",
        )

    # Use voice_id from space settings, or fall back to DB/config default
    vid = voice_id or await _get_elevenlabs_voice_id()

    if not vid:
        logger.warning("ElevenLabs API key set but no voice_id configured — using default voice")
        vid = "21m00Tcm4TlvDq8ikWAM"  # ElevenLabs default "Rachel" voice

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text[:5000],  # ElevenLabs max ~5000 chars
        "model_id": "eleven_multilingual_v2",  # supports Hindi, English, multilingual
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity_boost,
            "speed": speed,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)

        if resp.status_code == 200:
            logger.info(f"ElevenLabs TTS: {len(text)} chars → {len(resp.content)} bytes audio")
            return TTSResult(
                audio_bytes=resp.content,
                content_type="audio/mpeg",
                provider="elevenlabs",
            )
        elif resp.status_code == 401:
            return TTSResult(
                error="ElevenLabs API key invalid",
                use_browser_tts=True,
                provider="browser",
            )
        elif resp.status_code == 422:
            return TTSResult(
                error=f"ElevenLabs voice_id '{vid}' not found",
                use_browser_tts=True,
                provider="browser",
            )
        else:
            error_msg = f"ElevenLabs error {resp.status_code}: {resp.text[:200]}"
            logger.error(error_msg)
            return TTSResult(error=error_msg, use_browser_tts=True, provider="browser")

    except httpx.TimeoutException:
        logger.warning("ElevenLabs TTS timeout — falling back to browser TTS")
        return TTSResult(use_browser_tts=True, provider="browser", error="ElevenLabs timeout")
    except Exception as e:
        logger.error(f"ElevenLabs TTS error: {e}")
        return TTSResult(use_browser_tts=True, provider="browser", error=str(e))


async def clone_voice(
    name: str,
    audio_file_paths: list[str],
    description: str = "",
) -> dict:
    """
    Clone a voice from audio samples using ElevenLabs Voice Clone API.
    Requires ELEVENLABS_API_KEY. Returns {'voice_id': '...', 'error': None}.
    Needs at least 1 minute of clean audio. More samples = better quality.
    """
    api_key = settings.ELEVENLABS_API_KEY.strip()
    if not api_key:
        return {"voice_id": None, "error": "ELEVENLABS_API_KEY not configured"}

    url = "https://api.elevenlabs.io/v1/voices/add"
    headers = {"xi-api-key": api_key}

    try:
        files = []
        opened = []
        for path in audio_file_paths[:25]:  # ElevenLabs max 25 samples
            f = open(path, "rb")
            opened.append(f)
            files.append(("files", (path.split("/")[-1], f, "audio/mpeg")))

        data = {"name": name, "description": description}

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, headers=headers, data=data, files=files)

        for f in opened:
            f.close()

        if resp.status_code == 200:
            voice_id = resp.json().get("voice_id")
            logger.info(f"Voice cloned: {name} → voice_id={voice_id}")
            return {"voice_id": voice_id, "error": None}
        else:
            return {"voice_id": None, "error": f"ElevenLabs {resp.status_code}: {resp.text[:200]}"}

    except Exception as e:
        return {"voice_id": None, "error": str(e)}
