# Excel validation and auditing service (FastAPI)

Microservice that accepts Excel workbooks, normalizes headers, validates required columns, processes rows in chunks, and returns structured JSON for **PAN** and **gross weight** audits.

The **Node** gateway used in this repo (`backend`) proxies PAN upload and invalid-row export to this service. See [`../backend/README.md`](../backend/README.md) for `/api/v1` routes and Swagger.

## Current status

- **PAN:** Full rules — required columns, PAN format (`AAAAA9999A`), missing PAN when total value is above ₹2L, invalid PAN format, missing address proof when total value is above ₹50k (see [PAN validation rules](#pan-validation-rules)).
- **Gross weight:** Tabular or semi-structured workbooks — manual vs auto gross weight and difference rules (see `app/processors/gross_weight_processor.py`).
- Headers are normalized to **snake_case** before validation.

## Tech stack

- Python 3.10+
- FastAPI, Uvicorn
- Pandas, OpenPyXL
- Pydantic / Pydantic Settings
- Loguru
- Pytest

## Project structure

```text
python-service/
  app/
    config/           Settings (`app/config/settings.py`)
    processors/       PAN + gross weight processors + factory
    routers/          `health_router`, `process_router`
    schemas/          API models where used
    services/         `ProcessingService` (calls `validate_upload_file`, dispatches processor)
    utils/            Excel reader, header cleaner, response builder, constants, logging
    validators/       `common_validator` (upload extension/MIME)
    main.py           FastAPI app, exception handlers
  tests/
  requirements.txt
  README.md
```

**Where validation runs**

- Upload checks: `app/validators/common_validator.py` (via `app/services/processing_service.py`).
- Spreadsheet rules: `app/processors/*.py` (e.g. `pan_processor.py`).

## Requirements

- Python 3.10 or newer
- `pip`
- Excel extensions: `.xlsx`, `.xlsm`, `.xls`

## Setup

From the repository root:

**Windows (PowerShell)**

```powershell
cd python-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Git Bash / Linux / macOS**

```bash
cd python-service
python -m venv .venv
source .venv/bin/activate   # Windows Git Bash: source .venv/Scripts/activate
pip install -r requirements.txt
```

## Environment variables

Defaults live in `app/config/settings.py`; a `.env` file is optional.

```env
APP_ENV=development
APP_PORT=8000
LOG_LEVEL=INFO
CHUNK_SIZE=2500
GROSS_WEIGHT_TOLERANCE=0.5
```

## Run the service

```bash
uvicorn app.main:app --reload --port 8000
```

- API base: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## HTTP errors

| Status | Typical cause                                                                  |
| ------ | ------------------------------------------------------------------------------ |
| `400`  | `ValueError` — bad upload (extension/MIME, empty file), unreadable Excel, etc. |
| `422`  | `KeyError` — missing required columns after normalization                      |
| `500`  | Unexpected processing failure                                                  |

## API endpoints

| Method | Endpoint                          | Description                                         |
| ------ | --------------------------------- | --------------------------------------------------- |
| `GET`  | `/api/health`                     | Health check                                        |
| `POST` | `/api/process/pan`                | PAN audit (`multipart/form-data`, field **`file`**) |
| `POST` | `/api/process/pan/export-invalid` | JSON `{ "records": [ ... ] }` → Excel download      |
| `POST` | `/api/process/gross-weight`       | Gross-weight column checks (`file`)                 |

## Request examples

Health:

```bash
curl http://127.0.0.1:8000/api/health
```

PAN validation:

```bash
curl -s -X POST "http://127.0.0.1:8000/api/process/pan" -F "file=@./pan-file.xlsx"
```

## Header normalization

- Lowercase, trimmed
- Non-alphanumeric characters → `_`
- Leading/trailing `_` removed

| Excel header          | Normalized            |
| --------------------- | --------------------- |
| `PAN`                 | `pan`                 |
| `Manual Gross Weight` | `manual_gross_weight` |

## Required columns (normalized)

| Processor        | Required                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **PAN**          | `total_value`; **both** `pan` **and** `pan1` columns must exist on the sheet; at least one of `add_proof`, `add_proof_2` |
| **Gross weight** | Tabular or voucher layout — see `gross_weight_processor` header detection and column rules                             |

PAN expects both `pan` and `pan1` **columns**; row-level logic treats empty-like cells (`na`, `pending`, `-`, etc.) as missing.

## PAN validation rules

- **Format:** `AAAAA9999A` (5 letters, 4 digits, 1 letter), checked on non-empty `pan` / `pan1` values.
- **Above ₹2,00,000 (`total_value`):** At least one valid PAN in `pan` or `pan1`; otherwise `MISSING_PAN_ABOVE_2L` or `INVALID_PAN_FORMAT`.
- **Below/equal ₹2,00,000:** If either column has a valid PAN, row passes PAN checks; non-empty but invalid values → `INVALID_PAN_FORMAT`.
- **Above ₹50,000:** At least one of `add_proof`, `add_proof_2` must be non-empty → else `MISSING_ADDRESS_PROOF_ABOVE_50K`.

Issue codes on each row appear in `records[].issues`.

## Successful PAN response shape

```json
{
  "success": true,
  "fileType": "pan",
  "totalRows": 3,
  "errorRows": 1,
  "summary": {
    "missingPanAbove2L": 0,
    "missingAddressProofAbove50K": 0,
    "invalidPanFormat": 1
  },
  "records": [
    {
      "rowNumber": 4,
      "date": null,
      "voucherNo": null,
      "party": null,
      "totalValue": 1000,
      "pan": "ABCDE123",
      "pan1": "",
      "addProof": "",
      "addProof2": "",
      "issues": ["INVALID_PAN_FORMAT"]
    }
  ]
}
```

Scaffolded processors return `success: true`, row counts, zero error counts, and empty `records` once required-column validation passes.

## Error responses

Unsupported extension:

```json
{
  "success": false,
  "detail": "Unsupported file extension. Use .xlsx, .xlsm, or .xls"
}
```

Missing columns (422):

```json
{
  "success": false,
  "detail": "Missing required columns: pan, pan1"
}
```

## Tests

From `python-service`:

```powershell
$env:PYTHONPATH="."
pytest
```

```bash
PYTHONPATH=. pytest
```

## Development notes

- Add processors under `app/processors/` and register in `app/processors/factory.py`.
- Reuse `app/utils/response_builder.build_processing_response()` for consistent JSON.
- Extend `app/validators/` for shared checks; upload validation stays in `common_validator.py`.
- Update this README when processor contracts or summary fields change.
