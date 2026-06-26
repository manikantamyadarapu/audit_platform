# HAA Audit Platform

Spreadsheet-driven audit workspace for jewellery and retail ledgers. Teams upload Excel workbooks; the platform validates structure and business rules and surfaces row-level issues with exports and dashboard analytics.

## Project Overview

| Layer | Role |
|-------|------|
| **Frontend** | React SPA — Scrutiny audits, dashboard, user management, settings |
| **Backend** | Node.js API gateway — auth, PostgreSQL persistence, proxies to Python |
| **Python service** | FastAPI audit engine — Excel parsing, validators, rate rules, exports |

Active audit modules: **PAN verification**, **Gross weight**, **Sales ledger (rate & ledger)**, **Sales return rate audit**, **Product average rates**, **Gold/silver rate book**, **Diamond/gem rate book**.

## Architecture

```mermaid
flowchart TB
  subgraph client [Browser]
    UI[React SPA]
  end
  subgraph node [Node.js Gateway :4002]
    API[Express /api]
    Auth[JWT + Refresh Cookie]
    DB[(PostgreSQL / Supabase)]
  end
  subgraph py [Python Service :8000]
    ENG[FastAPI Processors]
    VAL[Validators & Rate Engines]
  end
  UI -->|HTTPS /api| API
  API --> Auth
  API --> DB
  API -->|Axios proxy| ENG
  ENG --> VAL
```

## Tech Stack

| Area | Technologies |
|------|----------------|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router, TanStack Table, Axios |
| Backend | Node.js 18+, Express, Prisma, PostgreSQL, JWT, Multer, Helmet, Swagger |
| Python | FastAPI, Uvicorn, Pandas, Polars, DuckDB, OpenPyXL, Pydantic, Pytest |

## Modules

| Module | Route | Description |
|--------|-------|-------------|
| Dashboard | `/dashboard` | KPIs, audit trend, issues by category, recent uploads |
| PAN verification | `/scrutiny/pan` | PAN format, ₹2L PAN rule, ₹50k address proof |
| Gross weight | `/scrutiny/gross-weight` | Manual vs auto gross weight tolerance |
| Sales ledger | `/scrutiny/sales-ledger` | Account/product mapping, UOM, rate deviation |
| Sales return | `/scrutiny/sales-return-rate` | Return file validation + rate vs sales averages |
| Product averages | `/sales-audit/product-average-rates` | Stored averages from last sales audit |
| Rate rule book | `/scrutiny/rate-rule-book` | Gold & silver min/max rates |
| Diamond/gem rates | `/scrutiny/diamond-gem-rates` | Diamond product rate bands |
| Users | `/users` | User administration (role-based) |

## Setup Instructions

Each service has its own `.env` in its folder. Configure all three before starting.

### 1. Python service (port 8000)

```bash
cd python-service
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Backend (port 4002)

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy   # first-time / production
npm run dev
```

### 3. Frontend (port 4000)

```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:4000**. Dev proxy forwards `/api` to the backend.

## Deployment Instructions

1. **PostgreSQL** — provision database; set `DATABASE_URL` and `DIRECT_URL` in `backend/.env`.
2. **Backend** — set `NODE_ENV=production`, strong JWT secrets, explicit `CORS_ORIGIN`. Run `npx prisma migrate deploy` and `npm start`.
3. **Python** — run behind private network only (`APP_ENV=production`). Use Uvicorn/gunicorn with process manager.
4. **Frontend** — build with `VITE_API_BASE_URL` pointing to the public API URL; serve `dist/` via CDN or reverse proxy.
5. **Reverse proxy** — terminate TLS; route `/api` to Node; never expose Python port 8000 publicly.

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Node gateway URL (empty in dev — uses Vite proxy) |
| `VITE_API_URL` | Optional direct Python URL (legacy; rate book uses Node) |

### Backend (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP listen port (default 4002) |
| `NODE_ENV` | `development` or `production` |
| `DATABASE_URL` | PostgreSQL connection (pooler) |
| `DIRECT_URL` | Direct PostgreSQL URL for migrations |
| `JWT_SECRET` | Access token signing secret |
| `REFRESH_TOKEN_SECRET` | Refresh token signing secret |
| `JWT_EXPIRES_IN` | Access token TTL (default `15m`) |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token TTL (default `7d`) |
| `PYTHON_SERVICE_URL` | FastAPI base URL |
| `CORS_ORIGIN` | Allowed origins (`*` dev only; required in production) |
| `ENABLE_SWAGGER` | Swagger UI (auto-disabled when `NODE_ENV=production`) |

### Python (`python-service/.env`)

| Variable | Purpose |
|----------|---------|
| `APP_ENV` | `development` or `production` |
| `LOG_LEVEL` | Logging level (default `INFO`) |
| `AUDIT_DEBUG_EXPORT` | Write debug workbooks when `true` |
| `SALES_DEBUG_EXPORT` | Write sales debug exports when `true` |

See [backend/README.md](backend/README.md) and [python-service/README.md](python-service/README.md) for detail.

## User Roles

Roles are stored in PostgreSQL (`roles` table) and linked to users via `role_id`. Typical roles include administrators and auditors. Protected routes require a valid JWT access token; admin features (user management) enforce role checks on the backend.

## Audit Flow

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant API as Node API
  participant PY as Python Engine
  participant DB as PostgreSQL

  U->>FE: Upload Excel
  FE->>API: POST /api/v1/process/... (Bearer + cookie)
  API->>PY: Proxy multipart upload
  PY->>PY: Normalize headers, run validators
  PY-->>API: JSON records + summary
  API->>DB: Persist audit run (where applicable)
  API-->>FE: Response
  FE-->>U: Widgets, table, export
```

1. User authenticates (login → access token + HttpOnly refresh cookie).
2. User uploads workbook on a Scrutiny page.
3. Node validates upload limits and forwards to Python.
4. Python detects header row, normalizes columns, runs processor-specific rules.
5. Response includes `totalRows`, `errorRows`, `summary`, and `records` / `exceptionRecords`.
6. User filters issues, exports invalid rows (Excel/CSV/PDF).
7. Dashboard aggregates historical runs from PostgreSQL.

## Production Checklist

- [ ] `NODE_ENV=production` on backend
- [ ] Strong `JWT_SECRET` and `REFRESH_TOKEN_SECRET` (32+ characters)
- [ ] `CORS_ORIGIN` set to frontend origin (not `*`)
- [ ] `npx prisma migrate deploy` completed
- [ ] Python service on private network only
- [ ] `VITE_API_BASE_URL` set at frontend build time
- [ ] HTTPS via reverse proxy
- [ ] Smoke test: login, each audit type, dashboard, logout
- [ ] Confirm API 500 responses do not leak stack traces

## Documentation

| Document | Purpose |
|----------|---------|
| [backend/README.md](backend/README.md) | Node API, auth, Prisma, routes |
| [python-service/README.md](python-service/README.md) | Audit engines, validators, processors |
