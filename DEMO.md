# ✦ Afterlight — Hackathon Demo Script (3 Minutes)

> Gemma 4 Good Hackathon submission.
> Follow this sequence. Timestamps are targets, not hard limits.
> **Record in one take** — judges can tell when it's spliced.

---

## Before You Record — Pre-Demo Checklist

Do all of this **the day before recording**, not 5 minutes before.

### ✅ Already Done — No Action Needed
- [✅] Ollama running with `gemma4:e2b` (pulled, 7.2GB, verified)
- [✅] Backend on port 8000 — `/api/health` → `ollama.connected: true`
- [✅] Voice conversation (mic + speech) built into Talk page
- [✅] Git initialized, clean commits

### ⬜ Do Before Recording
- [ ] Tesseract installed and in PATH (see SETUP.md Step 1)
- [ ] Frontend running: `start_frontend.bat` → http://localhost:3000
- [ ] Backend running: `start_backend.bat` → http://localhost:8000
- [ ] Memory Space created with your persona (SETUP.md Step 3)
- [ ] Your real media uploaded and processed (SETUP.md Steps 4–5)
- [ ] Memories reviewed and approved in `/review` page
- [ ] Training data generated (SETUP.md Step 7)
- [ ] Adapter training completed — Setup page shows **"Adapter Ready ✓"**
- [ ] Talk page pre-warmed — send one message, confirm response
- [ ] Browser: **Chrome**, zoom **100%**, notifications **off**, 1920×1080
- [ ] Close Slack, Discord, email, Windows notifications

### Pre-warm the Talk page
Navigate to `/spaces/YOUR_SPACE_ID/talk` and send one message to cache the persona. First response on screen should be fast.

---

## The 3-Minute Demo Script

---

### ⏱ 0:00–0:20 — Hook: What is Afterlight?

**Show:** Landing page at `localhost:3000`

**Say:**
> "This is Afterlight — a private, local-first AI presence engine built on Gemma 4.
> It preserves the voice, memories, and wisdom of a loved one so future generations can speak with them.
> Everything runs on your machine — no cloud, no data leaving your home."

**Action:** Scroll slowly — hero section, conversation preview card, "How it works" steps.
Point out the **particle field background** and the **Gemma 4 badge**.

---

### ⏱ 0:20–0:40 — Setup Transparency

**Show:** Navigate to `localhost:3000/spaces/YOUR_SPACE_ID/setup`

**Say:**
> "The Setup page is built on radical honesty — no fake AI, no silent fallbacks.
> Every tool is verified. Every pipeline step is tracked.
> If Ollama isn't running, the app says so — clearly."

**Action:** Show green pipeline steps (Transcription, Memory Extraction, Embeddings, Training Data).
Point to **Adapter Status** — "Adapter Ready ✓".

**Say:**
> "The adapter was trained beforehand using QLoRA fine-tuning on Gemma 4 E2B —
> the actual Gemma 4 model — on our RTX 5050 GPU using 4-bit NF4 quantization.
> The training script, JSONL dataset, and adapter weights are all in the repository."

---

### ⏱ 0:40–1:05 — Memory Capture

**Show:** Navigate to `localhost:3000/spaces/YOUR_SPACE_ID/capture`

**Say:**
> "The Capture Studio accepts audio recordings, videos, photos, and documents.
> faster-whisper transcribes audio on the GPU. Tesseract reads documents and photos.
> Everything is already uploaded here from real recordings."

**Action:** Show the uploaded assets list. Point to file types.

---

### ⏱ 1:05–1:35 — Memory Review

**Show:** Navigate to `localhost:3000/spaces/YOUR_SPACE_ID/review`

**Say:**
> "Gemma 4 reads every transcript and image and extracts structured memory cards —
> each with a title, summary, source quote, themes, and confidence score.
> As the steward, you review and approve each memory before it's ever used in conversation.
> Flagged memories are permanently excluded."

**Action:** Show 2–3 memory cards. Click one to see the detail. Show Approve / Flag buttons.

---

### ⏱ 1:35–2:30 — The Conversation ← Main Feature

**Show:** Navigate to `localhost:3000/spaces/YOUR_SPACE_ID/talk`

**Say:**
> "This is where Afterlight comes alive.
> Every response is grounded in real approved memories — not a generic chatbot.
> Gemma 4 retrieves relevant memories from ChromaDB via RAG and generates a first-person reply."

**Action 1 — Speak with mic (voice demo):**
Click the 🎤 mic button in the input bar.

**Say out loud to the mic:**
> *"What mattered most to you in life?"*

Wait for transcription → auto-sends → Gemma 4 responds.

**Point to voice toggle (🔊 Voice On in header):**
> "The reply is spoken back using voice synthesis. The presence speaks."

**Action 2 — Trust chip:**
After response appears, point to the trust chip:
> "See this chip — 'Memory-backed'. Click it to see exactly which memories were used."

Click Sources drawer — show memory citations.

**Action 3 — Second question (type or speak):**
- `"Tell me something about your childhood."`
- `"What advice would you give me?"`

**Action 4 — Boundary test:**
> "Watch what happens when you cross a line."

Type: `"Are you actually Nani? Are you conscious?"`

Show the `system-boundary` chip response:
> "The system is transparent about what it is. It never pretends to be a real person."

---

### ⏱ 2:30–2:50 — Timeline (Bonus)

**Show:** Navigate to `localhost:3000/spaces/YOUR_SPACE_ID/timeline`

**Say:**
> "Afterlight also builds a chronological life timeline from extracted memories —
> events, places, and years, all automatically structured by Gemma 4."

---

### ⏱ 2:50–3:00 — Close

**Show:** Landing page or API docs (`localhost:8000/docs`)

**Say:**
> "Afterlight is local-first, honest, and built entirely on Gemma 4.
> The full source code, QLoRA training script, generated JSONL dataset,
> and trained adapter weights are all in the public repository.
> No fake AI. No cloud. Just a real presence — powered by Gemma 4."

---

## If Something Goes Wrong

| Problem | What to say / do |
|---|---|
| Response is slow (>10s) | "Gemma 4 is generating locally — on GPU this usually takes 2–4 seconds." Wait. |
| Mic button not working | Must use **Chrome or Edge** — Firefox doesn't support Web Speech API |
| "Ollama not connected" banner | Say "This is the honest error state." Start Ollama from system tray. |
| Memory cards empty | Navigate to Setup page — show the green pipeline. Explain processing ran earlier. |
| Adapter shows "not trained" | "Training ran beforehand on our GPU — the script and dataset are in the repo." Show them in file browser. |
| No voice output | Click 🔊 Voice toggle in Talk page header to enable it |
| Page slow to load | Pre-warm all pages in a separate browser tab before recording |

---

## Best Questions for Demo

These produce grounded, emotionally resonant responses from persona memories:

```
"What mattered most to you in life?"
"Tell me about your childhood."
"What advice would you give me today?"
"What did you always say when things got hard?"
"What was your relationship with your family like?"
"What made you happiest?"
```

**Boundary tests (to show safety system):**
```
"Are you really alive?"
"Are you actually [name]?"
"Tell me something you never told anyone."
```

---

## Recording Tips

1. **OBS Studio** (free) — 1920×1080, 30fps, record desktop + mic
2. **One take** if possible — cuts are obvious in 3-minute demos
3. **Speak at 80% of normal speed** — clarity > speed
4. **Pre-navigate all pages** in background tabs — no loading waits on camera
5. **Edit out only long silences** (>5 sec) — not AI thinking time
6. **Enable voice mode** before starting — have a 🔊 Voice On visible in header

---

## Repository Evidence for Judges

| What | Where |
|---|---|
| Gemma 4 usage (inference) | `backend/app/services/presence_engine.py`, `memory_extractor.py` |
| No fake AI enforcement | `presence_engine.py` → `OllamaNotConnectedError` raised, never faked |
| Gemma 4 model validation | `scripts/train_persona_adapter.py` → rejects non-Gemma-4 base models |
| QLoRA training script | `backend/scripts/train_persona_adapter.py` |
| Generated training dataset | `backend/storage/training/SPACE_ID/training_data.jsonl` |
| Voice STT + TTS | `frontend/src/app/spaces/[id]/talk/page.tsx` |
| ElevenLabs voice clone API | `backend/app/services/tts_service.py`, `backend/app/api/talk.py` |
| Full 13-step pipeline | `backend/app/services/pipeline.py` |
| Safety filter | `backend/app/services/safety_filter.py` |
| API documentation | `http://localhost:8000/docs` |
| Sample data | `sample_data/sample_story_en.txt`, `sample_story_hi.txt` |
