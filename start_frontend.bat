@echo off
echo.
echo  ✦ Afterlight — Starting Frontend (Next.js)
echo  ─────────────────────────────────────────────────────────
echo.

cd /d %~dp0frontend

if not exist node_modules (
    echo  node_modules not found. Running npm install...
    npm install
)

echo  Starting Next.js on http://localhost:3000
echo.
npm run dev
