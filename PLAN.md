# Ngrok Multi-Redirect (HTTPS Live Maker)
## Product Requirements Document (PRD) & Technical Specification v1.0

---

## 1. Executive Summary

**Ngrok Multi-Redirect** is an enterprise-grade dynamic reverse-proxy multiplexer and live tunnel manager. It allows developers to expose an arbitrary number of local services (webhooks, REST APIs, GraphQL services, WebSockets, and full frontend web applications) across different ports through a **single Ngrok tunnel** without collisions, paid domain upgrades, or port conflicts.

The system is split into two cleanly decoupled applications:
* **Backend:** Pure NestJS (TypeScript) with an embedded high-performance reverse proxy engine, Ngrok lifecycle manager, embedded zero-config SQLite persistence layer (WAL mode), and local node health monitor. All configuration is safely managed via the First-Run UI Setup Wizard and database settings (zero credential files in repository).
* **Frontend:** Production-grade React + TypeScript (TSX) Single Page Application styled with a strict, solid enterprise design system (light/dark mode, no glassmorphism, uniform corner radius, and tab-based navigation).

---

## 2. Core Architecture & The On-The-Fly Subpath Virtualization Engine

When traffic arrives from the public internet via the single Ngrok public URL (`https://<ngrok-domain>`), it reaches the Gateway listening on the configured main port (`7779`). The Gateway routes requests to target local ports using a **Subpath Virtualization & 3-Tier Cascade Engine**:

```
                                  [ Public Internet ]
                                           │
                                   [ Ngrok Tunnel ]
                                           │
                       ┌───────────────────▼───────────────────┐
                       │   Gateway Server (Port 7779 - NestJS) │
                       └───────────────────┬───────────────────┘
                                           │
                ┌──────────────────────────┼──────────────────────────┐
                │                          │                          │
        [ Tier 1: Path Match ]    [ Tier 2: Referer Scoped ]   [ Tier 3: Active Cookie ]
        /<node_id>/...            Naked sub-resources          Fallback scoping for
        APIs, Webhooks & Apps     Tab-isolated for Web UIs     root / navigation
                │                          │                          │
                └──────────────────────────┼──────────────────────────┘
                                           │
                       ┌───────────────────▼───────────────────┐
                       │ On-The-Fly Virtualization Engine      │
                       │ • HTML <base> & SW Sanitizer Inject   │
                       │ • JS ES Import & Vite HMR Rewrite     │
                       │ • React Router Basename Dynamic Fix   │
                       │ • Raw Webhook Stream Bypass           │
                       └───────────────────┬───────────────────┘
                                           │
         ┌──────────────────┬──────────────┴─────┬──────────────────┐
         ▼                  ▼                    ▼                  ▼
[ localhost:5174 ]  [ localhost:9911 ]   [ localhost:4000 ]  [ Dashboard / Admin ]
  Wiki (Vite/React)    Storefront (Next)    Webhook Handler      Gateway UI
```

### The Tiers & Virtualization Mechanics:

#### Tier 1: Explicit Subpath Namespace & Webhook Routing
* **Target:** Web applications, Webhooks, REST APIs, GraphQL, and direct links.
* **Mechanism:** The URL starts with `/<node_id>/...` (e.g., `https://my-ngrok.com/custom-wiki/` or `POST /my-epic-webhook-07`).
* **Behavior:** The gateway extracts `node_id`, matches the active node, strips or preserves the prefix according to configuration, and proxies the request to `http://localhost:<port>/...`.
* **Trailing Slash Enforcement:** Transparently issues a 301 redirect on bare slugs (`/<node_id>` $\rightarrow$ `/<node_id>/`) so browser WHATWG relative resolution works seamlessly.
* **Webhook & Raw Stream Guarantee:** Body-parsing is completely bypassed for proxy routes; raw binary payloads, chunked streams, and cryptographic HMAC signatures arrive byte-for-byte unaltered with zero redirects.

#### Tier 2: Referer Header Scoping (Naked Subresource Isolation)
* **Target:** Naked asset requests (`/@vite/client`, `/src/index.css`) that do not carry the subpath prefix.
* **Mechanism:** Parses the browser's `Referer` header to identify the originating app slug and routes directly to the correct local port.

#### Tier 3: Active Cookie Scoping Fallback
* **Target:** Browser-level fallbacks and root `/` requests.
* **Mechanism:** Maintains `__active_node` session cookie to route root navigations cleanly.

#### On-The-Fly JavaScript Module Virtualization
* **ES Module Import Rewriter:** Browser-native JavaScript imports (`from "/..."`, `import "/..."`, `import("/...")`) bypass HTML `<base>`. The gateway dynamically intercepts JavaScript chunks and prepends `/<slug>/` on-the-fly.
* **React Router 6/7 Basename Injection:** Arbitrary React Router applications with `<BrowserRouter>` are dynamically patched in the served bundle to default to `window.__GW_BASENAME__`, rendering subpath routes (`<Route path="/" />`) immediately without blank screens and with **zero code changes** to external projects.
* **Vite HMR WebSocket Virtualization:** Patches `__HMR_BASE__ = "/<slug>/"` in `/@vite/client` so hot-module reloading and full-duplex WebSocket connections route cleanly to `wss://.../<slug>/?token=...`.

#### HTML & CSS Virtualization
* **HTML Sanitization & Shim:** Injects `<base href="/<slug>/">`, `window.__GW_BASENAME__ = "/<slug>"`, and a Service Worker cleanup script into `<head>` to unregister rogue background workers from other projects.
* **CSS URL Rewriting:** Rewrites `url(/...)` $\rightarrow$ `url(/<slug>/...)` for fonts and images.

#### WebSocket & Protocol Upgrades
* The reverse proxy intercepts HTTP `Upgrade: websocket` headers, extracts the target node from the URL subpath, strips the prefix, and establishes full-duplex tunnel connections directly to target ports (supporting Socket.io, HMR, GraphQL subscriptions).

---

## 3. Node Model & Creation Specifications

Every routing node represents a mapped local port and contains three primary fields:

| Field | Type | Description | Constraints |
|---|---|---|---|
| **Node Name** | `string` | Display label for the service (e.g., "Stripe Webhook", "React Admin") | 1–50 characters |
| **Node Port** | `number` | The target local port running on `localhost` (e.g., `5000`, `3000`) | 1–65535 |
| **Node ID** | `string` | Unique URL identifier used as the path slug (e.g., `auth`, `5000`) | Unique, alphanumeric, hyphens/underscores only. Cannot conflict with reserved paths. |

### Reserved Slugs
The following identifiers are reserved for system operations and cannot be used as `Node ID`:
* `dashboard`, `api`, `health`, `static`, `assets`, `favicon.ico`, `socket.io`

### Node Statuses:
* **Active:** Proxy routes traffic to the node.
* **Paused:** Proxy returns `503 Service Temporarily Paused`.
* **Local Health Status:** Background health-checker continuously polls `http://localhost:<port>`:
  * `HEALTHY (Green)`: Local port is accepting TCP/HTTP connections.
  * `UNREACHABLE (Red)`: Local port is down or not responding.

---

## 4. Embedded SQLite Database Schema (WAL Mode)

All system configurations, node states, and traffic logs are persisted locally using embedded SQLite via `better-sqlite3` with Write-Ahead Logging (WAL) enabled (`backend/data/gateway.sqlite`). No external database servers are required.

### 4.1 Table: `nodes`
Stores the configuration and metadata for all proxied endpoints.

```sql
CREATE TABLE IF NOT EXISTS nodes (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    port INT NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    strip_prefix BOOLEAN DEFAULT TRUE,
    last_health_status VARCHAR(20) DEFAULT 'UNKNOWN',
    last_health_checked_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_nodes_slug (slug),
    INDEX idx_nodes_port (port),
    INDEX idx_nodes_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4.2 Table: `request_logs`
Stores detailed request logs per node for auditing, debugging, and traffic analysis.

```sql
CREATE TABLE IF NOT EXISTS request_logs (
    id VARCHAR(36) PRIMARY KEY,
    node_id VARCHAR(36) NOT NULL,
    method VARCHAR(10) NOT NULL,
    original_path TEXT NOT NULL,
    target_path TEXT NOT NULL,
    target_port INT NOT NULL,
    status_code INT NOT NULL,
    latency_ms INT NOT NULL,
    client_ip VARCHAR(45) NULL,
    user_agent TEXT NULL,
    referer TEXT NULL,
    error_message TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    INDEX idx_logs_node_id (node_id),
    INDEX idx_logs_created_at (created_at),
    INDEX idx_logs_status_code (status_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4.3 Table: `gateway_settings`
Key-value store for persisting gateway configurations, Ngrok preferences, and runtime states across restarts.

```sql
CREATE TABLE IF NOT EXISTS gateway_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 5. Frontend UI/UX Architecture & Pages

The frontend is a dedicated React + Vite + TypeScript application with a strict enterprise design system:
* **Solid Colors:** No glassmorphism, blur filters, or low-contrast gradients.
* **Strict Uniform Rounding:** Every input, button, card, modal, and badge strictly conforms to `rounded-lg` (8px).
* **Themes:** Full Dark Mode (`zinc-950` backgrounds, `zinc-900` cards, `zinc-800` borders) and Light Mode (`slate-50` background, `white` cards, `slate-200` borders).
* **Navigation:** Clean tab-based header navigation.

### Page Specifications:

#### Page 1: Gateway & Ngrok Control (`/` or `/gateway`)
* **Tunnel Status Panel:**
  * Live status pill: `ONLINE (Green)` / `STOPPED (Zinc)` / `ERROR (Red)`.
  * Single-click **"Start Ngrok"** / **"Stop Ngrok"** action button.
  * Live Ngrok Public Base URL (`https://xxxx.ngrok-free.app`) with 1-click copy.
  * Tunnel metadata: Protocol, Region, Latency, and Gateway Port (`7979`).
* **Quick Stats:**
  * Total Registered Nodes.
  * Active Local Nodes.
  * Total Proxied Requests (24h).
  * Error Rate (%) and Average Latency.

#### Page 2: Nodes Manager (`/nodes`)
* **Header Actions:** "Create New Node" modal button, search filter, status filter.
* **Create Node Modal:**
  * Node Name (Display name)
  * Node Port (Local port)
  * Node ID (Unique URL slug)
  * Instant slug availability validation and conflict prevention.
* **Nodes Table & Cards:**
  * Node Name & Target (`localhost:<port>`).
  * Live Heartbeat indicator (Green dot if local service is up, red if down).
  * Dedicated Live URL (`https://<ngrok>/<node_id>`) with 1-click **Copy URL** button.
  * Direct "Open Live URL" in new tab button.
  * Quick Status Switch: Active / Paused.
  * "View Details" button linking to the dedicated node page.
  * Edit & Delete actions.

#### Page 3: Node Detailed View (`/nodes/:id`)
* **Node Header:** Name, Node ID, Target Port, Live Public URL with copy button, Status toggles.
* **Health & Diagnostics:** Direct test ping to local port with latency measurement.
* **Dedicated Node Request History:**
  * Complete, paginated, searchable table of every request routed to this specific node.
  * Columns: Timestamp, Method (GET, POST, PUT, DELETE with color badges), Path, Target Port, Status Code (200, 404, 500), Latency (ms).
  * Request Inspector Drawer: Click any request to view Client IP, User-Agent, Referer, Headers, and Error logs.

#### Page 4: Global Traffic Inspector (`/traffic`)
* Real-time stream of all incoming requests across all nodes.
* Filterable by Node ID, HTTP Method, Status Code range (2xx, 4xx, 5xx), and time range.
* Auto-refresh toggle with live counter updates.

#### Page 5: Settings & Database Info (`/settings`)
* MySQL connection diagnostics (Host, Database, Latency, Connection Pool health).
* Gateway Port configuration (default `7979`).
* Ngrok credentials and custom domain settings preview.
* Log Pruning: Option to clear logs older than 7 or 30 days.

---

## 6. Configuration Management & First-Run Setup Wizard

To ensure zero friction and complete security for open source deployment, the gateway requires no hardcoded credential files or `.env` secrets. 

On initial startup:
1. **Embedded SQLite:** The gateway automatically initializes a zero-config SQLite database (`backend/data/gateway.sqlite`) in WAL mode with automated schema migrations.
2. **First-Run Setup Wizard:** If no auth token is detected, the frontend directs the user to the interactive `/setup` onboarding wizard.
3. **Persistent Settings:** Ngrok Auth Token, Custom Domain, Gateway Port, and UI preferences (like traffic auto-refresh rate) are saved directly in the SQLite `gateway_settings` table.
4. **Settings Page:** All credentials and preferences can be reviewed, edited, or reconfigured dynamically from the Settings UI tab at any time without server restarts.

---

## 7. Unified CLI & Execution (`run.sh`)

A single production-grade shell script in the root directory manages both frontend and backend processes:

### Modes of Operation:
1. **Production Mode (`./run.sh`):**
   * Builds the React frontend (`dist/`).
   * Compiles the NestJS backend (`dist/`).
   * Starts the production backend service which serves the API, reverse proxy, and pre-built frontend dashboard.
   * No file watching or reloading.

2. **Development Mode (`./run.sh --reload`):**
   * Starts NestJS backend with live file-watching (`npm run start:dev`).
   * Starts Vite frontend dev server with Hot Module Replacement (`npm run dev`).
   * Runs both concurrently with unified terminal logging and graceful shutdown on `Ctrl+C`.

---

## 8. Reliability & Edge Case Matrix

| Edge Case | Root Cause | Implemented Solution |
|---|---|---|
| **Multiple Web UIs Open Simultaneously** | Browser asks for `/assets/app.js` without prefix; cookies bleed across tabs | **Tier 2 Referer Routing:** Isolates origin tab via browser `Referer` header. Each tab gets its own correct assets. |
| **Local Service Down** | Target local port is stopped or crashed | Gateway returns a clean JSON error `502 Bad Gateway` and logs the failure to MySQL without crashing the proxy. |
| **Ngrok Disconnection / Reconnection** | Network drops or tunnel expires | `NgrokService` detects tunnel state change, updates database, and frontend reflects status in real-time. |
| **Slug Collisions** | User creates a node with an existing slug or system path | Frontend & Backend enforce strict slug validation and reject reserved keywords (`api`, `dashboard`, etc.). |
| **Large File Uploads / Streaming** | Heavy payloads buffer in memory | Reverse proxy streams request and response bodies directly using Node `stream.pipeline` without in-memory buffering. |
| **WebSocket Upgrades** | Protocol switch from HTTP to WS | Proxy catches `http.Server` 'upgrade' event and pipes WebSocket streams directly to target port. |
