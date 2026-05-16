# ✦ Afterlight — Complete Setup Guide
# RTX 5050 Laptop GPU (Blackwell sm_120) + Ollama + Gemma 4

> Follow this guide **top to bottom, once**. Everything is GPU-accelerated.
> Your system: Python 3.12 ✅ | RTX 5050 8GB ✅ | Ollama installed ✅

---

## System Overview

| Component | Your Setup | Notes |
|---|---|---|
| **Python** | 3.12.11 ✅ | Already installed |
| **Node.js** | Need to verify | For Next.js frontend |
| **Ollama** | Installed ✅ | Need to pull `gemma4:e2b` |
| **GPU** | RTX 5050 8GB (sm_120) ✅ | Blackwell — needs PyTorch nightly |
| **PyTorch** | Install (nightly cu128) | Only nightly supports sm_120 |
| **FFmpeg** | Install | For audio/video processing |
| **Tesseract** | Install | For OCR on photos/documents |

---

## Step 1 — Pull Gemma 4 E2B via Ollama

```bash
ollama pull gemma4:e2b
```

> Downloads ~7.2 GB. Q4_K_M quantization — runs fully on your GPU VRAM.
> This will take ~15-20 min on a typical connection.

Verify when done:
```bash
ollama list
# Should show: gemma4:e2b
```

Test it's working on GPU:
```bash
ollama run gemma4:e2b "Say hello in one sentence."
```
In `nvidia-smi` during this, GPU memory usage should jump to ~3-4 GB.

---

## Step 2 — FFmpeg (audio/video processing)

1. Download: https://www.gyan.dev/ffmpeg/builds/ → **ffmpeg-release-essentials.zip**
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to Windows PATH:
   - Search "Environment Variables" → System Variables → `Path` → Edit → New → `C:\ffmpeg\bin`
4. Open **new** terminal, verify:
```bash
ffmpeg -version
ffprobe -version
```

---

## Step 3 — Tesseract OCR (photos, documents, screenshots)

1. Download installer: https://github.com/UB-Mannheim/tesseract/wiki
   - Get: `tesseract-ocr-w64-setup-5.5.0.exe` (64-bit)
2. Run installer
   - During install, expand **Additional language data** → select **Hindi** if needed
   - Install path: `C:\Program Files\Tesseract-OCR\` (default)
3. Add to PATH: `C:\Program Files\Tesseract-OCR\`
4. Verify:
```bash
tesseract --version
```

If it's NOT in PATH, set it in `.env` instead:
```env
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

---

## Step 4 — Backend Python Environment

The project uses a **Python 3.12 venv** inside `backend/`. All packages go here — isolated from system Python.

### 4a. Create the venv (already done if you see `backend/venv/`)
```bash
cd C:\Users\prath\OneDrive\Desktop\Afterlight\backend
py -3.12 -m venv venv
```

### 4b. Activate it
```bash
venv\Scripts\activate
# Prompt will show: (venv)
```

### 4c. Install PyTorch Nightly (CUDA 12.8 — required for RTX 5050 Blackwell sm_120)

> ⚠️ **IMPORTANT**: The RTX 5050 Laptop is Blackwell architecture (compute capability sm_120).
> PyTorch 2.6 stable only supports up to sm_90 (Ada). You MUST use the nightly build.

```bash
pip install --pre torch torchvision torchaudio --index-url https://download.pytorch.org/whl/nightly/cu128
```

Verify CUDA is working:
```bash
python -c "import torch; print(torch.__version__, torch.cuda.get_device_name(0))"
# Expected: 2.12.0.dev... NVIDIA GeForce RTX 5050 Laptop GPU
# NO warnings about sm_120 incompatibility
```

### 4d. Install core server packages
```bash
pip install fastapi "uvicorn[standard]" python-multipart "sqlalchemy>=2.0.40" aiosqlite pydantic-settings python-dotenv httpx aiofiles "Pillow>=11.0.0" pytesseract
```

### 4e. Install ML packages (RAG, transcription, embeddings)
```bash
# Vector search + embeddings (will auto-use GPU)
pip install chromadb sentence-transformers

# Audio/video transcription (GPU-accelerated via float16)
pip install faster-whisper

# Video frame extraction
pip install opencv-python-headless

# HuggingFace access
pip install huggingface_hub
```

### 4f. Install QLoRA training packages
```bash
pip install "transformers>=4.51.0" "peft>=0.15.0" "trl>=0.17.0" "accelerate>=1.6.0" datasets "bitsandbytes>=0.45.5"
```

### 4g. Login to HuggingFace (needed for Gemma 4 base model download during training)
```bash
huggingface-cli login
# Paste your HF token from: https://huggingface.co/settings/tokens
```
Also go to https://huggingface.co/google/gemma-4-e2b-it and click **"Agree and access repository"** if you haven't already.

---

## Step 5 — Configure .env

The `.env` file is already pre-configured in `backend/.env` for your GPU. Key settings:

```env
OLLAMA_MODEL=gemma4:e2b        # Q4_K_M quantization via Ollama
WHISPER_DEVICE=cuda            # GPU transcription
WHISPER_MODEL=medium           # Good quality, fits in VRAM
WHISPER_COMPUTE_TYPE=float16   # GPU compute type for Blackwell
TRAIN_LORA_RANK=16             # LoRA rank for QLoRA
TRAIN_MAX_LENGTH=512           # Token length (fits in 8GB)
```

Only change these if needed:
```env
# If Tesseract is NOT in PATH:
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

---

## Step 6 — Frontend Setup

```bash
cd C:\Users\prath\OneDrive\Desktop\Afterlight\frontend
npm install
```

Verify the API URL (already set correctly in the project):
```bash
# Check frontend/.env.local exists, or create it:
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local
```

---

## Step 7 — Starting the Servers

**Use the one-click scripts in the project root:**

### Backend — double-click `start_backend.bat` or run:
```bash
cd C:\Users\prath\OneDrive\Desktop\Afterlight
start_backend.bat
```

### Frontend — double-click `start_frontend.bat` or run:
```bash
cd C:\Users\prath\OneDrive\Desktop\Afterlight
start_frontend.bat
```

Or manually:
```bash
# Terminal 1 — Backend
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0

# Terminal 2 — Frontend
cd frontend
npm run dev
```

---

## Step 8 — Verify Everything

### Health check (most important):
Open: http://localhost:8000/api/health

You want to see:
```json
{
  "ollama": { "connected": true, "model": "gemma4:e2b" },
  "tools": {
    "ffmpeg": { "available": true },
    "tesseract": { "available": true },
    "faster_whisper": { "available": true }
  },
  "vector_store": { "available": true }
}
```

### GPU sanity check:
```bash
cd backend
venv\Scripts\activate
python -c "import torch; print('CUDA:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NONE')"
```

### Full stack:
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs

---

## Step 9 — Before the Demo: Run the Full Pipeline

**Do this the day before recording.**

### 9a. Create a Memory Space
1. Go to http://localhost:3000/create
2. Fill in the persona details (your fictional person)
3. Submit — note the space ID from the URL

### 9b. Upload your media
Upload your own audio, video, photos, text files via the Capture Studio page, or use the API:
```bash
# Upload a text file
curl -X POST "http://localhost:8000/api/memory-spaces/YOUR_SPACE_ID/assets" \
  -F "file=@your_story.txt"

# Upload an audio/video file
curl -X POST "http://localhost:8000/api/memory-spaces/YOUR_SPACE_ID/assets" \
  -F "file=@voice_recording.mp3"
```

### 9c. Trigger processing (Gemma 4 extracts memories)
```bash
curl -X POST "http://localhost:8000/api/memory-spaces/YOUR_SPACE_ID/process"
```

Watch the backend terminal — Gemma 4 is running live on your GPU via Ollama.

### 9d. Generate training data
```bash
curl -X POST "http://localhost:8000/api/memory-spaces/YOUR_SPACE_ID/generate-training-data"
```

### 9e. Run QLoRA adapter training (do this the night before demo)
```bash
# Get the job ID from the API response, then:
curl -X POST "http://localhost:8000/api/memory-spaces/YOUR_SPACE_ID/train-adapter"
```

Or run the script directly:
```bash
cd backend
venv\Scripts\activate
python scripts/train_persona_adapter.py \
  --space_id YOUR_SPACE_ID \
  --dataset_path storage/training/YOUR_SPACE_ID/training_data.jsonl \
  --output_dir storage/adapters/YOUR_SPACE_ID \
  --model_id google/gemma-4-e2b-it \
  --lora_rank 16 \
  --batch_size 1 \
  --grad_accum 4 \
  --epochs 3
```

Training on RTX 5050 with ~60 examples takes approximately **15-30 minutes**.

### 9f. Talk with the presence
Go to http://localhost:3000/spaces/YOUR_SPACE_ID/talk and start a conversation.
The first response uses Ollama (Gemma 4 Q4_K_M). After training, the adapter can be loaded too.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `sm_120 not compatible` warning in PyTorch | Re-install with nightly: `pip install --pre torch --index-url https://download.pytorch.org/whl/nightly/cu128` |
| `ollama.connected: false` in health | Start Ollama: click system tray icon or run `ollama serve` |
| `gemma4:e2b not found` | Run `ollama pull gemma4:e2b` (7.2 GB download) |
| Talk page: "Ollama not connected" | Same — ensure Ollama is running |
| Vector search not working | `pip install chromadb sentence-transformers` and restart backend |
| Audio not transcribing | `pip install faster-whisper`, restart backend |
| `bitsandbytes` errors during training | Update: `pip install bitsandbytes>=0.45.5` |
| Training OOM (out of memory) | Reduce `TRAIN_MAX_LENGTH` to 256 in `.env` |
| `CUDA not available` during training | Wrong torch build — use nightly cu128 (see Step 4c) |
| `venv\Scripts\activate` not found | Run Step 4a to create the venv first |
| Frontend blank / JS error | Check `npm install` completed in `frontend/` |

---

## Final Checklist Before Demo

```
[ ] ollama list shows: gemma4:e2b
[ ] /api/health shows: ollama.connected: true
[ ] /api/health shows: ffmpeg, tesseract, faster_whisper all available: true
[ ] /api/health shows: vector_store.available: true
[ ] Memory space created with persona details
[ ] Your media files uploaded (audio/video/photos/text)
[ ] Processing completed (Setup page shows all green)
[ ] Training data generated (60+ examples)
[ ] Adapter training completed (Setup page shows "Adapter Ready ✓")
[ ] Talk page responds in persona voice
[ ] No Ollama warnings in backend terminal
[ ] Browser at 100% zoom, notifications off
```

When all boxes checked → open DEMO.md
