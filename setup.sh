#!/usr/bin/env bash

# ==============================================================================
# Ngrok Multi-Redirect Setup Script
# Automatically prepares modules, environment, and builds for immediate execution.
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo ""
echo "================================================================="
echo "           NGROK MULTI-REDIRECT - ENVIRONMENT SETUP              "
echo "================================================================="
echo ""

# 1. Check Node.js and npm
echo "🔍 Checking runtime prerequisites..."
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js is not installed. Please install Node.js (v18+) to continue."
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm is not installed. Please install npm to continue."
    exit 1
fi

NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo "✅ Node.js: $NODE_VERSION"
echo "✅ npm:     $NPM_VERSION"
echo ""

# 2. Setup Data Directory
echo "📁 Ensuring SQLite data storage directory..."
mkdir -p "$DIR/backend/data"
echo "✅ Data directory ready."
echo ""

# 3. Install Backend Dependencies
echo "📦 Installing backend dependencies (NestJS, SQLite, Ngrok SDK)..."
cd "$DIR/backend"
npm install
echo "✅ Backend dependencies installed."
echo ""

# 4. Install Frontend Dependencies
echo "🎨 Installing frontend dependencies (React 19, Vite, Tailwind CSS)..."
cd "$DIR/frontend"
npm install
echo "✅ Frontend dependencies installed."
echo ""

# 5. Build Applications
echo "🔨 Compiling backend (TypeScript)..."
cd "$DIR/backend"
npm run build
echo "✅ Backend build complete."
echo ""

echo "🔨 Building frontend SPA production assets..."
cd "$DIR/frontend"
npm run build
echo "✅ Frontend build complete."
echo ""

# 6. Ensure Execution Permissions
echo "🔒 Setting execution permissions on run.sh and setup.sh..."
chmod +x "$DIR/run.sh" "$DIR/setup.sh" 2>/dev/null || true
echo "✅ Permissions updated."
echo ""

echo "================================================================="
echo "🎉 SETUP COMPLETED SUCCESSFULLY!"
echo "================================================================="
echo ""
echo "To start the application:"
echo "  • Production Mode (Single Gateway on port 7779):"
echo "      ./run.sh"
echo ""
echo "  • Development Mode (Hot-Reload for Backend & Frontend):"
echo "      ./run.sh --reload"
echo ""
