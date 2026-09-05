# 🌐 Ngrok Multi-Redirect (HTTPS Live Maker)

> **Expose an arbitrary number of local microservices, APIs, and full web applications across different ports through a single Ngrok tunnel — with zero collisions, tab isolation, and zero-config SQLite persistence.**

---

## 🚀 Key Features

* **Single Tunnel, Multi-Port Multiplexing:** Route traffic from a single public Ngrok HTTPS URL to multiple distinct local services (e.g. Next.js on `:3000`, NestJS on `:5000`, Python bot on `:8000`).
* **3-Tier Routing Cascade:**
  1. **Tier 1 (Namespace Routing):** `/<node_id>/...` routes cleanly to individual backends and APIs.
  2. **Tier 2 (Referer Header Tab Isolation):** Multiple web applications running in separate browser tabs have their naked static assets (`/main.js`, `/static/css/...`) isolated cleanly without cross-talk.
  3. **Tier 3 (Runtime Asset & `<base>` Rewriter):** HTML rewrites injected transparently to guarantee relative path resolution.
* **First-Run Setup Wizard:** No credential files or `.env` secrets committed to the repository. The application launches a guided browser wizard on first boot to configure Ngrok credentials and custom domains.
* **Embedded SQLite Persistence:** Powered by `better-sqlite3` in WAL mode. Zero external database dependencies (no MySQL/PostgreSQL required).
* **Live Traffic Inspector:** Real-time stream of HTTP & WebSocket requests with latency tracking, method filtering, status badge indicators, and database-persisted auto-refresh rates (`1s`, `2s`, `3s`, `5s`, `10s`).
* **Health Monitoring:** Periodic background heartbeat pinging configured target ports with live status badges.
* **Enterprise Dashboard:** Clean React 19 + Tailwind CSS dashboard with dark/light mode, smooth toggles, and instant node management.

---

## 🛠️ Quick Start

### 1. Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v8.0.0 or higher

### 2. Setup
Run the automated environment setup script:
```bash
./setup.sh
```
This script checks runtime prerequisites, initializes the SQLite storage directory, installs all backend and frontend dependencies, and builds production bundles.

### 3. Run the Application

#### Production Mode (Single Gateway on port 7779)
```bash
./run.sh
```
* **Gateway & Reverse Proxy:** `http://localhost:7779`
* **Web Dashboard:** `http://localhost:7779/dashboard`

#### Development Mode (Hot-Reloading for Backend & Frontend)
```bash
./run.sh --reload
```
* **Frontend Dev Server:** `http://localhost:5173`
* **Backend Dev API:** `http://localhost:7779`

---

## ⚙️ Configuration & First Run

1. When starting the gateway for the first time, open `http://localhost:7779/dashboard` (or `http://localhost:5173` in dev mode).
2. The **First-Run Setup Wizard** will guide you through entering:
   * **Ngrok Auth Token** (from [dashboard.ngrok.com](https://dashboard.ngrok.com))
   * **Custom Domain** *(optional)* (e.g. `your-domain.ngrok-free.app`)
   * **Gateway Port** *(default: 7779)*
3. Click **Complete Setup & Start Gateway**. All configurations are encrypted/persisted in the local SQLite database.
4. Settings can be dynamically modified at any time via the **Settings** tab.

---

## 📁 Architecture Overview

```
Ngrok-Multi-Redirect/
├── backend/
│   ├── src/
│   │   ├── database/     # SQLite service & schema migrations (WAL mode)
│   │   ├── ngrok/        # Ngrok SDK lifecycle management & tunnel control
│   │   ├── nodes/        # Microservice target registry & health monitor
│   │   ├── proxy/        # 3-Tier reverse proxy routing engine & body buffers
│   │   ├── settings/     # Database-backed configuration & system stats
│   │   ├── setup/        # First-run setup wizard APIs
│   │   └── traffic/      # Request inspection & logging endpoints
│   └── data/             # Local SQLite database (gitignored)
├── frontend/
│   ├── src/
│   │   ├── components/   # UI components (Toggle, Modal, Navbar, PortBadge)
│   │   ├── pages/        # Dashboard, Nodes, Traffic, Settings, SetupPage
│   │   └── services/     # Axios client communicating with backend
├── run.sh                # Unified CLI runner (production & development)
├── setup.sh              # Automated environment preparation script
└── PLAN.md               # Product Requirements Document & Technical Specification
```

---

## 🔒 Security & Privacy

* No secret tokens, passwords, or personal credentials are included in this repository.
* Local SQLite databases (`*.sqlite`, `*.db`, `data/`) are strictly gitignored.
* Proxy engine sanitizes and secures forwarded request headers (`x-forwarded-for`, `x-forwarded-proto`, `x-forwarded-host`).

---

## 📄 License
MIT License. Feel free to use, modify, and distribute.
