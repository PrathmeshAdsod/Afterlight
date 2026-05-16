@echo off
echo.
echo  ✦ Afterlight — Starting Backend (Python 3.12 venv + GPU)
echo  ─────────────────────────────────────────────────────────
echo.

cd /d %~dp0backend

if not exist venv\Scripts\python.exe (
    echo  ERROR: venv not found. Run SETUP.md steps first.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo  Checking Ollama...
ollama list 2>nul | findstr "gemma4" >nul
if errorlevel 1 (
    echo  WARNING: gemma4:e2b not found in Ollama. Run: ollama pull gemma4:e2b
) else (
    echo  Ollama: gemma4:e2b ready
)

echo  Starting FastAPI on http://localhost:8000
echo  API docs: http://localhost:8000/docs
echo.
python -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
