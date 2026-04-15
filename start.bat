@echo off
title MediAI Health Platform

echo.
echo  ========================================
echo    MediAI Health Intelligence Platform
echo    Starting Full-Stack Application...
echo  ========================================
echo.

:: Check for .env files
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env"
    echo  WARNING: Please edit backend\.env and add your ANTHROPIC_API_KEY
    pause
)
if not exist "frontend\.env" (
    copy "frontend\.env.example" "frontend\.env"
)

:: Setup Python venv if needed
echo [1/3] Starting Python Backend...
cd backend
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt -q
start "MediAI Backend" cmd /k "python main.py"
cd ..

timeout /t 3 /nobreak >nul

:: Frontend
echo [2/3] Starting React Frontend...
cd frontend
if not exist "node_modules" (
    call npm install
)
start "MediAI Frontend" cmd /k "npm run dev"
cd ..

timeout /t 2 /nobreak >nul

:: Scheduler
echo [3/3] Starting Health Scheduler...
cd backend
start "MediAI Scheduler" cmd /k "python scheduler.py"
cd ..

echo.
echo  ==========================================
echo   MediAI is running!
echo.
echo   App:       http://localhost:5173
echo   API:       http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo  ==========================================
echo.
echo  Close the opened terminal windows to stop.
pause
