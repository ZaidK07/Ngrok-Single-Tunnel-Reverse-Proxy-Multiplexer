# Ngrok Multi-Redirect

Dynamic reverse-proxy multiplexer and tunnel orchestrator designed to expose multiple local services, web applications, and webhooks across arbitrary ports through a single Ngrok tunnel.

---

## Overview

Ngrok Multi-Redirect resolves common limitations encountered when testing multi-service distributed architectures locally. Rather than requiring multiple paid Ngrok tunnels, custom domain subscriptions, or complex ingress controllers, this platform routes all incoming public traffic arriving at a single tunnel endpoint to designated local ports based on URL namespaces, referer headers, and dynamic runtime rewrites.

The system incorporates an embedded zero-configuration SQLite persistence engine, a first-run web onboarding wizard, a real-time request inspection feed with configurable polling intervals, and periodic target health checks.

---

## Core Capabilities

- **Single Tunnel Multiplexing:** Expose multiple independent microservices (REST APIs, WebSockets, Next.js, FastAPI, Flask, Vite, React Router, etc.) through one public URL.
- **On-The-Fly Subpath Virtualization Engine ("1 App at 1 URL"):**
  - **Deterministic Subpath Base URLs:** Each web app lives cleanly under its own dedicated subpath (e.g. `https://<ngrok-domain>/custom-wiki/` and `https://<ngrok-domain>/zaid-website/`) without root redirects or manual browser page reloads.
  - **ES Module JavaScript Import Rewriting:** Intercepts and rewrites browser-native ES module imports (`from "/..."`, `import "/..."`, `import("/...")`) to prepend the node slug dynamically on-the-fly.
  - **React Router 6/7 Auto-Basename Patch:** Patches `<BrowserRouter>` on-the-fly to default to `window.__GW_BASENAME__`, eliminating blank screen routing errors with **zero source code modifications** to external repositories.
  - **Vite HMR WebSocket Virtualization:** Rewrites `__HMR_BASE__ = "/<slug>/"` in `/@vite/client` so hot-module reloading and full-duplex WebSocket connections route directly to the target dev server.
  - **HTML & CSS Asset Virtualization:** Injects `<base href="/<slug>/">`, rewrites root-absolute `src` and `href` attributes, and transforms CSS `url(/...)` references for fonts and images.
  - **Cross-App Service Worker Isolation:** Injects a browser-level Service Worker sanitizer into `<head>` on every HTML document to immediately unregister rogue background workers from other projects.
  - **Trailing Slash Enforcement:** Transparently issues 301 redirects on bare slugs (e.g. `/<slug>` $\rightarrow$ `/<slug>/`) to guarantee correct WHATWG relative URL resolution.
- **24/7 Always-On Webhook & Streaming Engine:**
  - Dedicated Tier 1 path matching for webhooks (e.g. `POST /my-epic-webhook-07`, Stripe, GitHub, Slack).
  - Body-parsers are completely bypassed on reverse-proxy routes to stream raw binary bodies, chunked streams, and HMAC cryptographic signatures byte-for-byte unaltered with zero redirects.
- **3-Tier Routing Cascade:**
  - **Tier 1 (Subpath Namespace Routing):** Matches `/<node_slug>/*` directly to target ports, stripping or preserving prefixes as configured.
  - **Tier 2 (Referer Scoped Tab Isolation):** Scopes naked subresource requests (e.g. `/@vite/client` or `/src/index.css`) to the correct local port using the browser's `Referer` header.
  - **Tier 3 (Active Cookie Scoping Fallback):** Uses `__active_node` session cookies as a resilient fallback for browser tools and root requests.
- **Zero-Config Embedded Persistence:** Backed by SQLite in Write-Ahead Logging (WAL) mode via `better-sqlite3`. Requires no external database servers (MySQL, PostgreSQL, or Redis).
- **First-Run Setup Wizard:** No credentials or auth tokens are committed to source control. Setup is initiated via an onboarding interface on initial launch.
- **Live Traffic Inspector:** Real-time request logging with method filters, HTTP status indicators, latency tracking, client IP attribution, and customizable refresh rates persisted in the database.
- **Background Health Monitoring:** Automated heartbeat polling checks the operational status of configured target ports and reports state changes.
- **Decoupled Architecture:** NestJS TypeScript backend paired with a React 19 single-page management dashboard.

---

## System Architecture

```
                                  [ Public Internet Traffic ]
                                               │
                                       [ Ngrok Tunnel ]
                                               │
                            ┌──────────────────▼──────────────────┐
                            │   Gateway Server (Port 7779 / Node) │
                            └──────────────────┬──────────────────┘
                                               │
                ┌──────────────────────────────┼──────────────────────────────┐
                │                              │                              │
     [ Tier 1: Subpath Match ]     [ Tier 2: Referer Scoped ]     [ Tier 3: Active Cookie ]
     /<node_id>/...                Naked sub-resources            Browser fallback scoping
     APIs, Webhooks & Virtual UIs  Tab-isolated web frontends     Root & legacy clients
                │                              │                              │
                └──────────────────────────────┼──────────────────────────────┘
                                               │
                            ┌──────────────────▼──────────────────┐
                            │ On-The-Fly Virtualization Engine    │
                            │ • HTML <base> & SW Sanitizer Inject │
                            │ • JS ES Import & Vite HMR Rewrite   │
                            │ • React Router Basename Dynamic Fix │
                            │ • Raw Webhook Stream Bypass         │
                            └──────────────────┬──────────────────┘
                                               │
                ┌──────────────────┬───────────┴──────────┬──────────────────┐
                ▼                  ▼                      ▼                  ▼
        [ localhost:5174 ]  [ localhost:9911 ]     [ localhost:4000 ]  [ Dashboard / Admin ]
          Wiki (Vite/React)   Storefront (Next)      Webhook Handler     Management UI
```

---

## Requirements

- **Node.js:** v18.0.0 or higher (LTS recommended)
- **npm:** v8.0.0 or higher
- **Operating System:** macOS, Linux, or Windows (WSL recommended)

---

## Installation

Run the automated setup script from the root of the repository:

```bash
./setup.sh
```

The script performs the following tasks:
1. Validates runtime dependencies (`node` and `npm`).
2. Creates the local database storage directory (`backend/data`).
3. Installs backend dependencies.
4. Installs frontend dependencies.
5. Builds the production bundles for both services.
6. Sets execution permissions on CLI scripts.

---

## Execution

A unified runner script (`run.sh`) controls application lifecycle and process management.

### Production Mode

In production mode, the gateway compiles assets if necessary and serves the reverse proxy, API endpoints, and dashboard application from a single port.

```bash
./run.sh
```

- **Gateway and Reverse Proxy:** `http://localhost:7779`
- **Dashboard Interface:** `http://localhost:7779/dashboard`

### Development Mode

In development mode, the NestJS backend and Vite frontend run concurrently with hot-reloading enabled.

```bash
./run.sh --reload
```

- **Frontend Development Server:** `http://localhost:5173`
- **Backend API & Proxy Engine:** `http://localhost:7779`

To stop all running processes cleanly, issue `SIGINT` (Ctrl+C). The script traps termination signals and releases occupied network ports.

---

## Configuration

### First-Run Onboarding

When launching the application for the first time:

1. Navigate to `http://localhost:7779/dashboard` (or `http://localhost:5173` if running in development mode).
2. The interface will automatically route to the `/setup` onboarding screen.
3. Supply your **Ngrok Auth Token** (retrievable from your Ngrok dashboard).
4. Optionally specify a **Reserved Custom Domain** (e.g., `api-gateway.ngrok-free.app`) and custom gateway port.
5. Submit the configuration. The gateway initializes the tunnel and activates traffic routing.

### Runtime Settings

All configuration parameters are stored within the `gateway_settings` table of the SQLite database. Values can be updated directly from the **Settings** view in the management dashboard at any time without requiring server restarts:

- **Ngrok Auth Token**
- **Configured Static Domain**
- **Gateway Listening Port**
- **Traffic Feed Auto-Refresh Interval** (1s, 2s, 3s, 5s, 10s)
- **User Interface Theme**

---

## Project Structure

```
Ngrok-Multi-Redirect/
├── backend/
│   ├── src/
│   │   ├── database/         # SQLite service, migrations, and query execution
│   │   ├── ngrok/            # Ngrok process lifecycle and tunnel controller
│   │   ├── nodes/            # Target service registry and health monitoring
│   │   ├── proxy/            # Reverse proxy cascade engine and header manipulation
│   │   ├── settings/         # Configuration services and system diagnostics
│   │   ├── setup/            # Initial onboarding and credential storage endpoints
│   │   └── traffic/          # Request logging and traffic analytics
│   ├── data/                 # SQLite database storage (gitignored)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI elements (Header, Modals, Toggles)
│   │   ├── pages/            # View controllers (Gateway, Nodes, Traffic, Settings, Setup)
│   │   ├── services/         # API integration client
│   │   ├── types/            # TypeScript interface definitions
│   │   └── utils/            # Status, formatting, and timezone helpers
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── run.sh                    # Unified process execution and port cleanup script
├── setup.sh                  # Environment initialization script
├── PLAN.md                   # Product specifications and technical documentation
└── README.md                 # System overview and operational reference
```

---

## API Reference

The backend exposes a structured REST API under the `/api` namespace:

### Node Management
- `GET /api/nodes` - Retrieve all configured target nodes and health states.
- `POST /api/nodes` - Register a new target node with port, slug, and prefix configuration.
- `GET /api/nodes/:id` - Retrieve detailed information for a specific node.
- `PATCH /api/nodes/:id` - Update node properties or toggle active status.
- `DELETE /api/nodes/:id` - Remove a node from the routing registry.
- `POST /api/nodes/:id/ping` - Trigger an immediate health-check probe against the node port.

### Tunnel Control
- `GET /api/ngrok/status` - Retrieve active tunnel state, public URL, and connection metrics.
- `POST /api/ngrok/start` - Initialize and connect the Ngrok tunnel.
- `POST /api/ngrok/stop` - Terminate the active Ngrok tunnel.

### Traffic and Analytics
- `GET /api/traffic` - Retrieve paginated request logs with optional filters for node, status, and method.
- `GET /api/traffic/stats` - Retrieve aggregate traffic metrics, error rates, and latency averages.
- `DELETE /api/traffic/clear` - Prune request logs (optionally filtering by age in days).

### Settings and Diagnostics
- `GET /api/settings/info` - Inspect runtime resource usage, database status, and uptime.
- `GET /api/settings/config` - Retrieve current gateway configuration parameters.
- `POST /api/settings/config` - Persist updated configuration values to the database.

---

## Security Model

- **Zero Credential Exposure:** Secrets and tokens are never read from repository files or committed to source control.
- **Isolated Local Persistence:** The embedded database file resides in an explicitly ignored directory (`backend/data/`).
- **Header Normalization:** The proxy engine sanitizes sensitive client and forwarding headers (`x-forwarded-for`, `x-forwarded-proto`, `x-forwarded-host`) to ensure target nodes receive standardized metadata.

---

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0). See the [LICENSE](LICENSE) file for details.
