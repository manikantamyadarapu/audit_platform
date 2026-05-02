# Audit platform — Node.js API (PAN)

Express gateway for the audit platform. It exposes versioned HTTP routes, validates uploads and export payloads on the Node side, and proxies PAN Excel validation and invalid-row export to the **`python-service`** (FastAPI).

For spreadsheet rules and Python endpoints, see [`../python-service/README.md`](../python-service/README.md).

## Tech stack

- Node.js **18+**
- Express, Axios, Multer (memory uploads), Helmet, CORS
- Swagger UI (`swagger-ui-express`) backed by static OpenAPI at `src/openapi/openapi.json`

## Repository layout

```text
src/
  server.js                         # Loads env, validates config, listens, graceful shutdown
  app.js                            # Middleware stack, health, /api/v1, Swagger, errors
  config/index.js                   # PYTHON_SERVICE_URL, CORS, upload/body limits, Swagger flag
  openapi/openapi.json              # OpenAPI 3 spec served at /openapi.json and /api-docs
  routes/index.js                   # Mounts /process/pan → pan.routes
  routes/pan.routes.js              # validate + export-invalid
  controllers/pan.controller.js
  services/pythonClient.service.js  # Axios → Python (/api/process/pan, export-invalid)
  middleware/upload.middleware.js   # Multer (memory, size/type limits)
  middleware/requestId.middleware.js
  middleware/errorHandler.middleware.js
  validators/panExport.validator.js # Export-invalid JSON body checks
  utils/constants.js
  utils/logger.js
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Node process health (does not call Python) |
| `POST` | `/api/v1/process/pan/validate` | `multipart/form-data`, field **`file`** → Python `POST /api/process/pan` → JSON |
| `POST` | `/api/v1/process/pan/export-invalid` | JSON `{ "records": [ ... ] }` → Python `POST /api/process/pan/export-invalid` → `.xlsx` stream |

Optional header **`x-request-id`** is accepted on both POST routes and forwarded to Python when present.

## Swagger UI (upload and test)

With **Python** (`uvicorn`, port **8000** by default) and **this server** running:

- **Swagger UI:** `http://127.0.0.1:3000/api-docs`
- **Raw spec:** `http://127.0.0.1:3000/openapi.json`

Use **PAN → POST /api/v1/process/pan/validate**, **Try it out**, attach an Excel file on field **`file`**, **Execute**.

**Export invalid rows**

1. Run **validate**; copy the **`records`** array from the JSON (rows with issues).
2. Open **PAN → POST /api/v1/process/pan/export-invalid** → **Try it out**.
3. Body shape: `{ "records": [ ... ] }` (see examples in Swagger).
4. **Execute** and download the spreadsheet response as `.xlsx`.

Set **`ENABLE_SWAGGER=false`** to disable `/api-docs` and `/openapi.json` (typical for locked-down production).

## Environment variables

Copy `.env.example` to `.env` and adjust as needed.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP listen port |
| `NODE_ENV` | `development` | `production` enforces stricter CORS rules |
| `PYTHON_SERVICE_URL` | `http://127.0.0.1:8000` | FastAPI base URL (no trailing slash) |
| `CORS_ORIGIN` | `*` in dev | Comma-separated origins; **required** in production (no `*`) |
| `REQUEST_BODY_JSON_LIMIT` | `50mb` | Max JSON body for export-invalid |
| `UPLOAD_MAX_BYTES` | `52428800` (50 MiB) | Max multipart upload size |
| `ENABLE_SWAGGER` | `true` | Set `false` to hide Swagger |

## Setup and run

```bash
cd backend
cp .env.example .env
npm install
```

Start **`python-service`** first, then:

```bash
npm run dev
```

Production:

```bash
npm start
```

## curl examples

Validate:

```bash
curl -s -X POST "http://127.0.0.1:3000/api/v1/process/pan/validate" -F "file=@./your.xlsx"
```

Export (save bytes to file):

```bash
curl -s -X POST "http://127.0.0.1:3000/api/v1/process/pan/export-invalid" \
  -H "Content-Type: application/json" \
  -d "{\"records\":[{\"rowNumber\":2,\"issues\":[\"MISSING_PAN_ABOVE_2L\"]}]}" \
  --output invalid.xlsx
```
