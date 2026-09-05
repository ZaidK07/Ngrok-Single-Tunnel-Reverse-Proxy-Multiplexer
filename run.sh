#!/usr/bin/env bash

# ==============================================================================
# Ngrok Multi-Redirect Runner
# Modes:
#   ./run.sh          -> Production mode (Compiles & runs gateway on port 7779)
#   ./run.sh --reload -> Development mode (Hot-reload for Backend & Frontend)
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

GATEWAY_PORT=7779
FRONTEND_PORT=5173

BACKEND_PID=""
FRONTEND_PID=""

# Helper function to forcefully free a port if occupied
free_port() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "🧹 Freeing port :$port (terminating PIDs: $pids)..."
        kill -15 $pids 2>/dev/null || true
        sleep 0.5
        # Force kill if still lingering
        local remaining=$(lsof -ti :$port 2>/dev/null || true)
        if [ -n "$remaining" ]; then
            kill -9 $remaining 2>/dev/null || true
        fi
    fi
}

# Clean graceful shutdown trap
cleanup() {
    echo ""
    echo "🛑 Shutting down Ngrok Multi-Redirect..."

    # Terminate backend process
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "   Stopping backend (PID: $BACKEND_PID)..."
        kill -TERM "$BACKEND_PID" 2>/dev/null || true
    fi

    # Terminate frontend process
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "   Stopping frontend (PID: $FRONTEND_PID)..."
        kill -TERM "$FRONTEND_PID" 2>/dev/null || true
    fi

    # Give processes a moment to run shutdown hooks
    sleep 1

    # Guarantee ports are completely freed
    free_port $GATEWAY_PORT
    free_port $FRONTEND_PORT

    echo "✨ All services stopped cleanly. Ports $GATEWAY_PORT and $FRONTEND_PORT are free."
    exit 0
}

# Register signal trap for clean exit
trap cleanup SIGINT SIGTERM EXIT

# Free any ports before starting up to avoid EADDRINUSE collisions
free_port $GATEWAY_PORT
free_port $FRONTEND_PORT

MODE="production"
if [ "$1" == "--reload" ] || [ "$1" == "-r" ] || [ "$1" == "dev" ]; then
    MODE="development"
fi

echo "================================================================="
echo "        🚀 NGROK MULTI-REDIRECT - HTTPS LIVE MAKER               "
echo "================================================================="
echo " Mode:         $MODE"
echo " Gateway Port: $GATEWAY_PORT"
echo " Working Dir:  $DIR"
echo "================================================================="
echo ""

if [ "$MODE" == "development" ]; then
    echo "🔥 Starting in DEVELOPMENT mode with hot-reload..."
    echo ""

    # Start NestJS backend in watch mode
    echo "▶️  Starting Backend dev server..."
    cd "$DIR/backend"
    npm run start:dev &
    BACKEND_PID=$!
    cd "$DIR"

    # Start Vite frontend dev server
    echo "▶️  Starting Frontend dev server on http://localhost:$FRONTEND_PORT..."
    cd "$DIR/frontend"
    npm run dev &
    FRONTEND_PID=$!
    cd "$DIR"

    echo ""
    echo "-----------------------------------------------------------------"
    echo "  Dashboard UI:   http://localhost:$FRONTEND_PORT"
    echo "  Gateway Engine: http://localhost:$GATEWAY_PORT"
    echo "  Press Ctrl+C to stop all services cleanly"
    echo "-----------------------------------------------------------------"
    echo ""

    # Wait on child processes
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true

else
    echo "🏭 Starting in PRODUCTION mode (No reload, embedded dashboard)..."
    echo ""

    # Check if builds exist, otherwise build
    if [ ! -d "$DIR/frontend/dist" ]; then
        echo "Building frontend production bundle..."
        cd "$DIR/frontend"
        npm run build
        cd "$DIR"
    fi

    if [ ! -d "$DIR/backend/dist" ]; then
        echo "Building backend production bundle..."
        cd "$DIR/backend"
        npm run build
        cd "$DIR"
    fi

    # Start compiled production backend (serves API, proxy, and built dashboard)
    echo "▶️  Starting Production Gateway on http://localhost:$GATEWAY_PORT..."
    cd "$DIR/backend"
    node dist/main.js &
    BACKEND_PID=$!
    cd "$DIR"

    echo ""
    echo "-----------------------------------------------------------------"
    echo "  Production Gateway: http://localhost:$GATEWAY_PORT"
    echo "  Dashboard UI:       http://localhost:$GATEWAY_PORT/dashboard"
    echo "  Press Ctrl+C to stop the gateway cleanly"
    echo "-----------------------------------------------------------------"
    echo ""

    # Wait on backend process
    wait $BACKEND_PID 2>/dev/null || true
fi
