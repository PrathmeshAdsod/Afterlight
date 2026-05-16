"""
Afterlight Sample Pipeline Runner
Processes sample_data/ files through the full Afterlight pipeline.
Requires: backend running, Ollama with gemma4:e2b, and tool dependencies.

Usage:
    python backend/scripts/run_sample_pipeline.py

Or with an existing space:
    python backend/scripts/run_sample_pipeline.py --space_id <id>
"""
import asyncio
import argparse
import httpx
import json
import os
import sys
from pathlib import Path

BASE_URL = os.getenv("AFTERLIGHT_API_URL", "http://localhost:8000")
SAMPLE_DIR = Path(__file__).parent.parent.parent / "sample_data"


async def run(space_id: str | None = None):
    async with httpx.AsyncClient(timeout=300.0) as client:
        print("=" * 60)
        print("AFTERLIGHT SAMPLE PIPELINE")
        print("=" * 60)

        # ── 1. Health check ──────────────────────────────────────────
        print("\n[1/6] Checking backend and Ollama...")
        try:
            r = await client.get(f"{BASE_URL}/api/health")
            health = r.json()
        except httpx.ConnectError:
            print(f"\n❌ Cannot connect to backend at {BASE_URL}")
            print("   Start the backend first:")
            print("   cd backend && uvicorn app.main:app --reload")
            sys.exit(1)

        ollama = health.get("ollama", {})
        if ollama.get("status") != "connected":
            print(f"\n⚠ Ollama not connected: {ollama.get('setup_instruction', 'Start Ollama and pull gemma4:e2b')}")
            print("   Memory extraction steps will show 'tool_missing'.")
        else:
            print(f"   ✓ Ollama connected. Model: {ollama.get('model_requested')}")

        tools = health.get("tools", {})
        for name, ts in tools.items():
            status = "✓" if ts.get("available") else "⚠"
            print(f"   {status} {name}: {'available' if ts.get('available') else ts.get('setup_instruction', 'not installed')}")

        # ── 2. Create memory space ────────────────────────────────────
        if not space_id:
            print("\n[2/6] Creating sample memory space...")
            r = await client.post(f"{BASE_URL}/api/memory-spaces", json={
                "presence_name": "Eleanor Vasquez",
                "relationship_type": "Grandmother",
                "birth_year": 1938,
                "death_year": 2019,
                "still_living": False,
                "primary_language": "English / Hinglish",
                "description": "A warm, resilient woman who cooked love into every meal.",
            })
            space = r.json()
            space_id = space["id"]
            print(f"   ✓ Space created: {space_id}")
        else:
            print(f"\n[2/6] Using existing space: {space_id}")

        # ── 3. Sign agreement ─────────────────────────────────────────
        print("\n[3/6] Signing steward agreement...")
        r = await client.post(f"{BASE_URL}/api/memory-spaces/{space_id}/agreement", json={
            "is_authorized_steward": True,
            "has_upload_rights": True,
            "understands_preserved_presence": True,
            "understands_unsupported_facts": True,
            "understands_sensitive_topics": True,
            "allows_persona_adapter": True,
        })
        if r.status_code in (200, 409):
            print("   ✓ Agreement signed (or already signed)")
        else:
            print(f"   ⚠ Agreement error: {r.text}")

        # ── 4. Upload sample files ────────────────────────────────────
        print("\n[4/6] Uploading sample files...")
        sample_files = list(SAMPLE_DIR.glob("*.txt")) + list(SAMPLE_DIR.glob("*.mp3"))

        if not sample_files:
            print(f"   ⚠ No sample files found in {SAMPLE_DIR}")
        else:
            for f in sample_files:
                with open(f, "rb") as fh:
                    r = await client.post(
                        f"{BASE_URL}/api/memory-spaces/{space_id}/assets",
                        files={"file": (f.name, fh, "text/plain" if f.suffix == ".txt" else "audio/mpeg")},
                    )
                if r.status_code == 200:
                    print(f"   ✓ Uploaded: {f.name}")
                else:
                    print(f"   ⚠ Failed: {f.name}: {r.text[:100]}")

        # ── 5. Trigger processing ─────────────────────────────────────
        print("\n[5/6] Triggering processing pipeline...")
        r = await client.post(f"{BASE_URL}/api/memory-spaces/{space_id}/process")
        print("   ✓ Pipeline started. Polling status...")

        # Poll status
        for attempt in range(30):
            await asyncio.sleep(5)
            r = await client.get(f"{BASE_URL}/api/memory-spaces/{space_id}/setup-status")
            status = r.json()
            done = status["summary"]["completed_steps"]
            total = status["summary"]["total_steps"]
            cards = status["summary"]["memory_cards_created"]
            print(f"   ... {done}/{total} steps done | {cards} memory cards", end="\r")

            # Check if pipeline finished or got stuck
            running_steps = [s for s in status["steps"] if s["status"] == "running"]
            if not running_steps and done >= 7:
                break

        print()
        print(f"\n   Pipeline summary:")
        print(f"   - Completed steps: {status['summary']['completed_steps']}/{status['summary']['total_steps']}")
        print(f"   - Memory cards created: {status['summary']['memory_cards_created']}")
        print(f"   - Persona capsule: {'ready' if status['summary']['has_persona_capsule'] else 'not yet'}")

        for step in status["steps"][:9]:
            icon = "✓" if step["status"] == "done" else ("⚠" if step["status"] == "tool_missing" else ("✗" if step["status"] == "error" else "○"))
            print(f"   {icon} Step {step['step_index']}: {step['step_name']} — {step['status']}")

        # ── 6. Final output ───────────────────────────────────────────
        print("\n[6/6] Done!")
        print(f"\n   Space ID: {space_id}")
        print(f"   Frontend: http://localhost:3000/spaces/{space_id}")
        print(f"   Talk:     http://localhost:3000/spaces/{space_id}/talk")
        print()
        print("   Next steps:")
        print(f"   1. Review memories: http://localhost:3000/spaces/{space_id}/review")
        print(f"   2. Approve memory cards")
        print(f"   3. Generate training data: POST /api/memory-spaces/{space_id}/generate-training-data")
        print(f"   4. Run adapter training: see backend/scripts/train_persona_adapter.py")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--space_id", default=None)
    args = parser.parse_args()
    asyncio.run(run(args.space_id))
