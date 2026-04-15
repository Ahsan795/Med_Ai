#!/bin/bash
# MediAI Full-Stack Startup Script
# Usage: chmod +x start.sh && ./start.sh

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║     🩺  MediAI Health Platform         ║"
echo "  ║     Starting Full-Stack Application    ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Check for .env
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠  backend/.env not found. Copying from .env.example...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${RED}   ➜  Please edit backend/.env and add your ANTHROPIC_API_KEY${NC}"
fi

if [ ! -f "frontend/.env" ]; then
    cp frontend/.env.example frontend/.env
fi

# Backend
echo -e "\n${GREEN}[1/3] Starting Python Backend...${NC}"
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null || true
pip install -r requirements.txt -q
python main.py &
BACKEND_PID=$!
echo -e "     Backend PID: $BACKEND_PID — http://localhost:8000"
cd ..

sleep 2

# Frontend
echo -e "\n${GREEN}[2/3] Starting React Frontend...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install -q
fi
npm run dev &
FRONTEND_PID=$!
echo -e "     Frontend PID: $FRONTEND_PID — http://localhost:5173"
cd ..

# Scheduler (background)
echo -e "\n${GREEN}[3/3] Starting Health Check-in Scheduler...${NC}"
cd backend
python scheduler.py &
SCHEDULER_PID=$!
echo -e "     Scheduler PID: $SCHEDULER_PID (every 12 hours)"
cd ..

echo -e "\n${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ MediAI is running!${NC}"
echo ""
echo -e "   🌐 App:       ${BLUE}http://localhost:5173${NC}"
echo -e "   🔗 API:       ${BLUE}http://localhost:8000${NC}"
echo -e "   📖 API Docs:  ${BLUE}http://localhost:8000/docs${NC}"
echo ""
echo -e "   Press ${RED}Ctrl+C${NC} to stop all services"
echo -e "${BLUE}═══════════════════════════════════════════${NC}\n"

# Wait and cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping all services...${NC}"
    kill $BACKEND_PID $FRONTEND_PID $SCHEDULER_PID 2>/dev/null || true
    echo -e "${GREEN}All services stopped. Goodbye! 💙${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

wait
