# AFTERLIGHT
### *Preserve the stories before they fade.*

A private, local-first **Presence Engine** — powered by **Gemma 4 E2B** via Ollama.

Built for the **Gemma 4 Good Hackathon**.

---

## What is Afterlight?

Afterlight lets families speak with the preserved presence of a loved one, shaped by their real memories, voice, values, stories, phrases, and relationship style — using **real local AI**, not mocked responses.

- **Local-first**: All processing runs on your machine. Nothing leaves your device.
- **Gemma 4 E2B**: Memory extraction, conversation, training data generation — all via `gemma4:e2b` through Ollama.
- **Honest AI**: If Ollama is not running, the app shows a clear error. No fake AI output.

---

## How Gemma 4 is Used

| Feature | How Gemma 4 is Used |
|---|---|
| Memory extraction | Gemma 4 reads evidence chunks and returns structured `MemoryCard` JSON |
| Persona capsule | Gemma 4 synthesises tone, phrases, values from approved memory cards |
| Training data generation | Gemma 4 generates 60+ synthetic conversation pairs in JSONL format |
| Presence conversation | Gemma 4 generates first-person replies grounded in retrieved memories (RAG) |
| Adapter fine-tuning | QLoRA training on `google/gemma-4-e2b-it` via PEFT/TRL |

---

## Setup

### Prerequisites

| Tool | Install |
|---|---|
| Python 3.10+ | [python.org](https://python.org) |
| Node.js 18+ | [nodejs.org](https://nodejs.org) |
| Ollama | [ollama.com](https://ollama.com) |
| FFmpeg (optional, for video/audio) | [ffmpeg.org/download.html](https://ffmpeg.org/download.html) |
| Tesseract OCR (optional, for images/PDFs) | [github.com/UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki) |

### 1. Clone the repo

```bash
git clone https://github.com/your-org/afterlight.git
cd afterlight
```

### 2. Start Ollama and pull Gemma 4

```bash
# Install Ollama from https://ollama.com
ollama serve

# In a new terminal:
ollama pull gemma4:e2b
```

### 3. Set up the backend

```bash
cd backend
cp .env.example .env
# Edit .env if needed (defaults work for local setup)

pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

### 4. Set up the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

---

## Running the Sample Pipeline

Process the included sample data files end-to-end:

```bash
cd backend
python scripts/run_sample_pipeline.py
```

This will:
1. Create a sample memory space (Eleanor Vasquez)
2. Upload `sample_data/sample_story_en.txt` and `sample_data/sample_story_hi.txt`
3. Run the full 13-step pipeline
4. Extract memory cards with Gemma 4
5. Build a persona capsule

Output:
- Memory cards in the database
- ChromaDB vector index for RAG
- Persona capsule

---

## Generating Training Data

After approving memory cards in the Review page:

```bash
# Via API
curl -X POST http://localhost:8000/api/memory-spaces/<space_id>/generate-training-data

# This generates: backend/storage/training/<space_id>/presence_training.jsonl
```

---

## Running Adapter Fine-Tuning

> Requires GPU with ≥8GB VRAM. CPU training is very slow.
> Must use `google/gemma-4-e2b-it` — the script REFUSES other model families.

```bash
python backend/scripts/train_persona_adapter.py \
  --space_id <space_id> \
  --dataset_path ./backend/storage/training/<space_id>/presence_training.jsonl \
  --base_model google/gemma-4-e2b-it \
  --output_dir ./backend/storage/adapters/<space_id>
```

Output saved to:
- `backend/storage/adapters/<space_id>/adapter_config.json` — LoRA adapter
- `backend/storage/adapters/<space_id>/training_metrics.json` — Loss, runtime
- `backend/storage/adapters/<space_id>/training_logs.json` — Step-by-step logs

The UI shows **"Adapter ready"** only if `adapter_config.json` exists on disk.

---

## Verification

```bash
# Check Ollama status
curl http://localhost:8000/api/health

# Should return:
# { "ollama": { "status": "connected", "model_available": true, ... } }
```

---

## Architecture

```
User uploads audio/video/images/text
    ↓
FFmpeg (audio extraction) + faster-whisper (transcription)
    ↓
Tesseract OCR (images/documents)
    ↓
Evidence script chunks (time-coded)
    ↓
Gemma 4 E2B via Ollama → MemoryCards (JSON)
    ↓
ChromaDB vector store (sentence-transformers embeddings)
    ↓
Persona capsule (tone, phrases, values, system prompt)
    ↓
Gemma 4 → Synthetic training JSONL (60+ pairs)
    ↓
PEFT QLoRA fine-tuning on google/gemma-4-e2b-it
    ↓
Talk endpoint: RAG (ChromaDB) + Gemma 4 → first-person reply
```

---

## Project Structure

```
/frontend          Next.js 14 TypeScript app
/backend           FastAPI Python app
  /app/services    ollama_client, media_processor, memory_extractor,
                   presence_engine, training_data_generator, vector_store
  /scripts         train_persona_adapter.py, run_sample_pipeline.py
  /storage         DB, assets, transcripts, training JSONL, adapters
/sample_data       Demo-safe sample text files (English + Hindi/Hinglish)
/docs              Architecture, pipeline, fine-tuning guides
```

---

## Honest States

The app never fakes AI output. These states are shown clearly:

| State | What the UI shows |
|---|---|
| Ollama not running | "Ollama not connected. Start with: ollama serve" |
| Model not pulled | "Run: ollama pull gemma4:e2b" |
| Tool missing (FFmpeg) | "Tool missing: ffmpeg — Install from ffmpeg.org" |
| Adapter not trained | "Adapter not trained yet" |
| No memories | Unknown memory response + "Help preserve this" |

---

## Privacy

- No cloud. No external API calls. No telemetry.
- ChromaDB, SQLite, and all files are stored in `backend/storage/`.
- Ollama runs entirely locally.

---

*Built for the Gemma 4 Good Hackathon · Light their story. Keep it alive.*
