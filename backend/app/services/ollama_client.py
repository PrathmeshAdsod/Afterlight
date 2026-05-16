"""
Real Ollama client for Gemma 4 E2B.
NO fake responses. If Ollama is not running or model is missing,
raises OllamaNotConnectedError — never returns fabricated output.
"""
import httpx
import json
from typing import AsyncGenerator
from app.core.config import settings


class OllamaNotConnectedError(Exception):
    """Raised when Ollama is unreachable or the model is not available."""
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class OllamaClient:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL
        self.timeout = httpx.Timeout(120.0, connect=10.0)

    async def check_connection(self) -> dict:
        """
        Check if Ollama is running and the configured model is available.
        Returns a status dict — never pretends to be connected if it isn't.
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.get(f"{self.base_url}/api/tags")
                r.raise_for_status()
                data = r.json()
                models = [m["name"] for m in data.get("models", [])]

                # Check if configured model is present
                model_available = any(
                    self.model in m or m.startswith(self.model.split(":")[0])
                    for m in models
                )

                return {
                    "status": "connected" if model_available else "model_missing",
                    "ollama_running": True,
                    "model_requested": self.model,
                    "models_available": models,
                    "model_available": model_available,
                    "setup_instruction": (
                        None if model_available
                        else f"Run: ollama pull {self.model}"
                    ),
                }
        except httpx.ConnectError:
            return {
                "status": "not_connected",
                "ollama_running": False,
                "model_requested": self.model,
                "models_available": [],
                "model_available": False,
                "setup_instruction": (
                    "Ollama is not running. Start it with: ollama serve\n"
                    f"Then pull the model: ollama pull {self.model}"
                ),
            }
        except Exception as e:
            return {
                "status": "error",
                "ollama_running": False,
                "model_requested": self.model,
                "models_available": [],
                "model_available": False,
                "error": str(e),
                "setup_instruction": f"Unexpected error: {e}",
            }

    async def _assert_connected(self):
        """Raise OllamaNotConnectedError if model is not ready."""
        status = await self.check_connection()
        if status["status"] != "connected":
            raise OllamaNotConnectedError(
                status.get("setup_instruction", "Ollama or Gemma 4 model is not available.")
            )

    async def generate(self, prompt: str, system: str = "", temperature: float = 0.7) -> str:
        """
        Generate a completion from Gemma 4 via Ollama.
        Raises OllamaNotConnectedError if not available — no fake output.
        """
        await self._assert_connected()
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": 2048,
            },
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(f"{self.base_url}/api/generate", json=payload)
            r.raise_for_status()
            return r.json()["response"]

    async def chat(
        self,
        messages: list[dict],
        system: str = "",
        temperature: float = 0.7,
    ) -> str:
        """
        Chat completion via Ollama chat endpoint.
        Raises OllamaNotConnectedError if not available.
        """
        await self._assert_connected()
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": 1024,
            },
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(f"{self.base_url}/api/chat", json=payload)
            r.raise_for_status()
            return r.json()["message"]["content"]

    async def generate_json(self, prompt: str, system: str = "") -> dict:
        """
        Generate and parse JSON output from Gemma 4.
        Returns parsed dict or raises ValueError on bad JSON.
        """
        raw = await self.generate(prompt, system=system, temperature=0.3)
        # Extract JSON from code block if present
        raw = raw.strip()
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"Gemma returned invalid JSON: {e}\nRaw: {raw[:500]}")


# Singleton for use across services
ollama_client = OllamaClient()
