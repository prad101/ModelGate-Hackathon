#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== ModelGate — Contract-Aware AI Control Plane ==="
echo ""

# Check for .env
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "ERROR: .env file not found. Copy .env.example and add your API key."
    exit 1
fi

# Setup backend venv if needed
if [ ! -d "$PROJECT_DIR/backend/venv" ]; then
    echo "[1/4] Creating Python 3.12 virtual environment..."
    python3.12 -m venv "$PROJECT_DIR/backend/venv" --system-site-packages
    source "$PROJECT_DIR/backend/venv/bin/activate"
    pip install -r "$PROJECT_DIR/backend/requirements.txt" -q
else
    source "$PROJECT_DIR/backend/venv/bin/activate"
fi

# Install frontend deps if needed
if [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
    echo "[2/4] Installing frontend dependencies..."
    cd "$PROJECT_DIR/frontend" && npm install --silent
fi

# Seed data if DB doesn't exist
if [ ! -f "$PROJECT_DIR/backend/data/controlplane.db" ]; then
    echo "[3/4] Seeding demo data..."
    cd "$PROJECT_DIR" && python scripts/seed_data.py
fi

echo "[4/4] Starting services..."
echo ""

# Start backend
cd "$PROJECT_DIR"
source backend/venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start frontend
cd "$PROJECT_DIR/frontend"
npm run dev -- --port 3000 &
FRONTEND_PID=$!

echo ""
echo "ModelGate is running:"
echo "  Backend API:  http://localhost:8000"
echo "  API Docs:     http://localhost:8000/docs"
echo "  Dashboard:    http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
