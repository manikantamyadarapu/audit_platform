# Excel validation and auditing service (FastAPI)

Microservice that accepts Excel workbooks, normalizes headers, validates required columns, processes rows in chunks, and returns structured JSON for **PAN** and **gross weight** audits.

The **Node** gateway used in this repo (`backend`) proxies PAN and gross-weight uploads and invalid-row exports to this service. See [`../backend/README.md`](../backend/README.md) for `/api/v1` routes and Swagger.

## Current status

- **PAN:** Full rules — required columns, PAN format (`AAAAA9999A`), missing PAN when total value is above ₹2L, invalid PAN format, missing address proof when total value is above ₹50k (see [PAN validation rules](#pan-validation-rules)). Fast path uses **openpyxl** read-only streaming when the first sheet’s header row is detected within the configured probe window; otherwise **pandas** reads the sheet.
- **Gross weight:** Tabular or semi-structured (voucher-block) layouts — **gross-weight-v2** parser in `app/processors/gross_weight_processor.py`; triplet rules in `app/validators/gross_weight_validator.py` (manual, auto, and difference quantized to two decimals; manual must equal auto and difference must be exactly `0.00`).
- Headers are normalized to **snake_case** before validation where applicable.
- Optional **`EXCEL_MAX_ROWS`** caps how many Excel rows are scanned (useful for huge files); when the cap truncates, `rowStats.scanCapTruncated` is `true`.

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
    processors/       PAN + gross weight processors + `factory.py` registry
    routers/          `health_router`, `process_router`
    schemas/          e.g. `base.py` (`HealthResponse`)
    services/         `ProcessingService` (calls `validate_upload_file`, dispatches processor)
    utils/            Excel reader, header cleaner, response builder, `excel_exporter`, constants, logging
    validators/       `common_validator` (upload extension/MIME), `gross_weight_validator` (triplet math)
    main.py           FastAPI app, exception handlers
  tests/
  requirements.txt
  README.md
```

**Where validation runs**

- Upload checks: `app/validators/common_validator.py` (via `app/services/processing_service.py`).
- Gross-weight numeric rules: `app/validators/gross_weight_validator.py` (used by `gross_weight_processor.py`).
- Spreadsheet layout and row logic: `app/processors/*.py` (e.g. `pan_processor.py`, `gross_weight_processor.py`).

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
# 0 = no cap. When set, row scans stop at this many rows and rowStats.scanCapTruncated may be true.
EXCEL_MAX_ROWS=0
# Rows from the top of the sheet used to find the PAN header row (title rows above the table).
EXCEL_PAN_HEADER_PROBE_ROWS=80
```

`GROSS_WEIGHT_TOLERANCE` is present in settings for compatibility; **current** gross-weight validation uses exact two-decimal equality via `gross_weight_validator` (no tolerance band).

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

| Method | Endpoint                                   | Description                                                    |
| ------ | ------------------------------------------ | -------------------------------------------------------------- |
| `GET`  | `/api/health`                              | Health check                                                   |
| `POST` | `/api/process/pan`                       | PAN audit (`multipart/form-data`, field **`file`**)            |
| `POST` | `/api/process/pan/export-invalid`        | JSON `{ "records": [ ... ] }` → Excel download                 |
| `POST` | `/api/process/gross-weight`              | Gross-weight checks (`file`)                                   |
| `POST` | `/api/process/gross-weight/export-invalid` | JSON `{ "records": [ ... ] }` → Excel download of invalid rows |

## Request examples

Health:

```bash
curl http://127.0.0.1:8000/api/health
```

PAN validation:

```bash
curl -s -X POST "http://127.0.0.1:8000/api/process/pan" -F "file=@./pan-file.xlsx"
```

Gross weight:

```bash
curl -s -X POST "http://127.0.0.1:8000/api/process/gross-weight" -F "file=@./weights.xlsx"
```

Invalid-row exports accept the same `records` arrays returned by the corresponding `POST` process endpoints (PAN or gross weight).

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
| **Gross weight** | Tabular or voucher layout — see `gross_weight_processor` header detection and column rules                               |

PAN expects both `pan` and `pan1` **columns**; row-level logic treats empty-like cells (`na`, `pending`, `-`, etc.) as missing.

## PAN validation rules

- **Format:** `AAAAA9999A` (5 letters, 4 digits, 1 letter), checked on non-empty `pan` / `pan1` values.
- **Above ₹2,00,000 (`total_value`):** At least one valid PAN in `pan` or `pan1`; otherwise `MISSING_PAN_ABOVE_2L` or `INVALID_PAN_FORMAT`.
- **Below/equal ₹2,00,000:** If either column has a valid PAN, row passes PAN checks; non-empty but invalid values → `INVALID_PAN_FORMAT`.
- **Above ₹50,000:** At least one of `add_proof`, `add_proof_2` must be non-empty → else `MISSING_ADDRESS_PROOF_ABOVE_50K`.

Issue codes on each row appear in `records[].issues`.

## Gross weight validation rules

- **Triplet:** For each data row (or voucher block), **manual gross**, **auto gross**, and **difference** must all be present and parseable as numbers.
- **Equality:** After rounding to **two decimal places** (half-up, Excel-style), manual gross must equal auto gross, and difference must be exactly **0.00**.
- **Issue strings** (examples): `Missing weight or difference values`, `Manual Gross and Auto Gross mismatch`, `Difference must be exactly 0.00`.
- **Response:** `summary` includes counts such as `valid`, `invalid`, `mismatchCount`, `differenceViolations`, `diffOnlyViolations`, and `layoutMode`. Top-level `layoutEngine` is `gross-weight-v2`. Rows use `status` `valid` | `invalid` and `records[].issues` (see processor for full field set per layout).

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

### Optional fields on success

All process endpoints that return JSON from `build_processing_response()` may include:

- **`performance`:** `readTimeMs`, `parseTimeMs`, `validateTimeMs`, `rowsPerSecond`, `wallTimeMs`.
- **`rowStats`:** Engine-specific counters (e.g. PAN: `dataRowsScanned`, `blankRowsSkipped`, `headerRowExcel`, `scanCapTruncated`, `engine`; gross weight: tabular/voucher scan stats and `scanCapTruncated`).

Gross-weight success payloads also include **`module`** (`gross_weight`) and **`layoutEngine`** (`gross-weight-v2`) for client compatibility checks.

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
- Invalid-row Excel downloads are built in `app/utils/excel_exporter.py` (`export_invalid_pan_records`, `export_invalid_gross_weight_records`).
- Update this README when processor contracts or summary fields change.
