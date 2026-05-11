# Excel validation and auditing service (FastAPI)

Microservice that accepts Excel workbooks, normalizes headers, validates required columns, processes rows in chunks, and returns structured JSON for PAN, GST, gross weight, and sales audits.

The **Node** gateway used in this repo (`backend`) proxies PAN upload and invalid-row export to this service. See [`../backend/README.md`](../backend/README.md) for `/api/v1` routes and Swagger.

## Current status

- **PAN:** Full rules — header-row detection when the sheet has preamble rows, required columns, PAN / PAN1 checks **only when `total_value` > ₹2,00,000**, address proof when `total_value` > ₹50,000, row skipping for blanks / repeated headers / subtotals / missing voucher (see [PAN audit](#pan-audit)).
- **Gross weight:** Full rules — optional header-row detection, alias columns (`manual_gross_wt` → `manual_gross_weight`), decimal parsing, mismatch vs tolerance, optional `difference` column, issue codes and messages (see [Gross weight audit](#gross-weight-audit)).
- **Sales:** Full rules — header-row detection (preamble allowed), product ↔ sales-account classification (including fuzzy product matching), dominant sales-account-per-product consistency, manual vs auto gross weight tolerance (see [Sales audit](#sales-audit)); missing columns after detection return structured **422** (`SheetValidationError`).
- **GST:** Skeleton only — requires `gst` column; returns success with zero issue counts (extend `app/processors/gst_processor.py` for real checks).
- Headers are normalized to **snake_case** before validation (`app/utils/header_cleaner.py`).

## Tech stack

- Python 3.10+
- FastAPI, Uvicorn
- Pandas, OpenPyXL
- Pydantic / Pydantic Settings
- Loguru
- Pytest
- RapidFuzz (sales product classification)

## Project structure

```text
python-service/
  app/
    config/                 Settings (`app/config/settings.py`) — e.g. `CHUNK_SIZE`, `GROSS_WEIGHT_TOLERANCE`
    processors/             `pan_processor`, `gross_weight_processor`, `sales_audit_processor`, `gst_processor`, `factory`
    routers/                `health_router`, `process_router` (includes `/api/v1/process/*` gateway prefixes)
    schemas/                API models where used
    services/               `ProcessingService` → `validate_upload_file` + processor dispatch
    utils/
      audit_row_skips.py    Shared skip logic for PAN / gross weight (blank, repeated header, subtotal, missing voucher)
      constants.py          PAN regex / Form 60 & US DL equivalents, GST regex, issue messages
      excel_header_detection.py   Scan sheet for header row when exports have title rows above data
      excel_reader.py       Chunked reads
      excel_exporter.py     Invalid-row Excel downloads for PAN, gross weight, sales
      header_cleaner.py     Normalization to snake_case
      product_classifier.py Sales: product → category, sales account → expected category
      response_builder.py   Uniform success JSON
      sheet_validation_error.py   Structured errors for sales sheet shape issues
      weight_decimal.py     Gross weight decimal parsing / quantization
    validators/             `common_validator` (upload extension/MIME); helpers for reuse
    main.py                 FastAPI app, exception handlers (400 / 422)
  tests/
  requirements.txt
  README.md
```

**Where validation runs**

- Upload checks: `app/validators/common_validator.py` (via `app/services/processing_service.py`).
- Spreadsheet rules: `app/processors/*.py`.

---

## PAN audit

**Module:** `app/processors/pan_processor.py`  
**Supporting:** `app/utils/constants.py` (`is_acceptable_pan_equivalent`, messages), `app/utils/audit_row_skips.py`, `app/utils/excel_header_detection.py`.

### Columns

- **Always required:** `total_value`.
- **PAN columns:** Both **`pan` and `pan1` must exist as columns** on the sheet (values may be empty).
- **Address proof:** At least one of **`add_proof`**, **`add_proof_2`** must exist as a column.

If the first row is not the real header (e.g. report title above the table), the service scans for a row that looks like a PAN sheet (`total_value` + `pan` or `pan1` + an address column) and loads data from that row.

### Row skipping

Rows are skipped (not audited) when they look like blanks, a repeated header line, subtotal/grand total lines, or (if `voucher_no` exists) rows with no voucher — see `should_skip_audit_row` in `app/utils/audit_row_skips.py`.

### Rules

1. **PAN format / equivalents:** A value counts as valid if it matches Indian PAN `AAAAA9999A` (spacing collapsed, case-insensitive), or normalized equivalents **Form No-60** / **US DL** (`app/utils/constants.py`).
2. **Above ₹2,00,000 (`total_value`):** If neither `pan` nor `pan1` contains a valid value → `MISSING_PAN_ABOVE_2L` when both empty; **`INVALID_PAN_FORMAT`** when at least one cell is non-empty but none are valid.
3. **`total_value` ≤ ₹2,00,000:** No PAN issue codes from `_collect_pan_issues` (PAN checks for format are not applied in this branch).
4. **Above ₹50,000 (`total_value`):** At least one of `add_proof`, `add_proof_2` must be non-empty → else **`MISSING_ADDRESS_PROOF_ABOVE_50K`**.

Human-readable strings for some issues are in `records[].messages`; codes stay in `records[].issues`.

### Summary fields (success)

Includes counts such as `missingPanAbove2L`, `invalidPanFormat`, `missingAddressProofAbove50K` (and duplicate compatible keys like `missingPanCount`) — see `PanProcessor.process` return summary.

---

## Gross weight audit

**Module:** `app/processors/gross_weight_processor.py`  
**Settings:** `GROSS_WEIGHT_TOLERANCE` is used elsewhere (sales); gross processor uses **exact** quantized equality for manual vs auto unless checking the optional difference column — see below.

### Columns

- After normalization: **`manual_gross_weight`** and **`auto_gross_weight`** required.
- Aliases from Excel may be **`manual_gross_wt` / `auto_gross_wt`** (renamed internally).
- Optional: **`difference`**; if absent, aliases like `diff`, `weight_difference`, `gross_difference` may be mapped to `difference`.

Header-row detection: if the sheet does not look like row 0 is the header, `find_header_row_index` looks for a row containing both manual and auto gross weight headers.

### Rules (only rows with both weights parsed as numbers)

1. **`NEGATIVE_WEIGHT_VALUES`** — manual, auto, or effective difference negative.
2. **`GROSS_WEIGHT_MISMATCH`** — quantized manual ≠ auto (`app/utils/weight_decimal.py`).
3. **`GROSS_WEIGHT_DIFFERENCE_VIOLATION`** — if manual and auto match but the **stated** `difference` (or derived manual − auto) is not **0.00** when quantized.

Rows skipped via `should_skip_audit_row` (same helper as PAN when columns allow).

### Summary fields

`mismatchCount`, `differenceViolations`, `negativeValueViolations`, `weightMismatch` (total invalid rows).

---

## Sales audit

**Module:** `app/processors/sales_audit_processor.py`  
**Supporting:** `app/utils/product_classifier.py` (`classify_product_cached`, `expected_category_from_sales_account`), `app/config/settings.py` (`gross_weight_tolerance` for manual vs auto comparison).

### Columns (normalized names)

Required after header detection and canonicalization:

| Logical field        | Typical Excel labels (examples) |
| -------------------- | --------------------------------- |
| `voucher_no`         | Voucher No                        |
| `sales_account`      | Sales account                     |
| `product`            | Product                           |
| `manual_gross_wt`    | Manual Gross Wt., Manual Gross Weight → aliased |
| `auto_gross_wt`      | Auto Gross Wt., Auto Gross Weight → aliased     |

**Weight column aliases:** If the sheet has `manual_gross_weight` / `auto_gross_weight` but not the `_wt` names, they are renamed to `manual_gross_wt` / `auto_gross_wt` internally.

Missing required columns **after** header detection raise **`SheetValidationError`** → HTTP **422** with `success`, `detail`, and nested `error` (`missingColumns`, `foundColumns`, `headerRowExcel`, `hints`, etc.) — not a plain `KeyError` string.

### Rules (per non-blank data row)

1. **Sales account mapping:** If the sales account text does not map to an expected category rule, the row is counted in **`skippedNoRule`** and does not get category mismatch issues.
2. **Product category:** If a category cannot be inferred for the product → **`MISSING_PRODUCT_CATEGORY_FOR_VALIDATION`**.
3. **Category vs account:** If predicted product category ≠ category implied by sales account → **`PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT`**.
4. **Dominant account per product:** Across the file, the most common sales account per product wins when unambiguous; another account for the same product → **`CONFLICTING_SALES_ACCOUNT_FOR_PRODUCT`**.
5. **Weights:** If both manual and auto parse as numbers and **|manual − auto| > `GROSS_WEIGHT_TOLERANCE`** → **`GROSS_WEIGHT_OUTSIDE_TOLERANCE`**.

Messages for sales issues are in `app/utils/constants.SALES_ISSUE_MESSAGES`.

### Summary fields

e.g. `categoryBreakdown`, `skippedNoRule`, `salesAccountProductMismatches`, `conflictingSalesAccountForProduct`, `grossWeightMismatches`.

---

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

| Status | Typical cause |
| ------ | ------------- |
| `400`  | `ValueError` — bad upload (extension/MIME, empty file), unreadable Excel, export with no invalid rows, etc. |
| `422`  | Missing required columns: **`KeyError`** string for PAN/GST/gross (simple `{ "success": false, "detail": "..." }`); **`SheetValidationError`** for sales (structured `error` object with columns/hints). |
| `500`  | Unexpected processing failure |

## API endpoints

Direct FastAPI paths and gateway-style paths (same handlers):

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET`  | `/api/health` | Health check |
| `POST` | `/api/process/pan` | PAN audit (`multipart/form-data`, field **`file`**) |
| `POST` | `/api/v1/process/pan/validate` | Same as above (gateway prefix) |
| `POST` | `/api/process/pan/export-invalid` | JSON `{ "records": [ ... ] }` → Excel download |
| `POST` | `/api/v1/process/pan/export-invalid` | Same |
| `POST` | `/api/process/gst` | GST column presence (`file`) — skeleton processor |
| `POST` | `/api/v1/process/gst/validate` | Same |
| `POST` | `/api/process/gross-weight` | Gross weight audit (`file`) |
| `POST` | `/api/v1/process/gross-weight/validate` | Same |
| `POST` | `/api/process/gross-weight/export-invalid` | JSON `{ "records": [ ... ] }` → Excel download |
| `POST` | `/api/v1/process/gross-weight/export-invalid` | Same |
| `POST` | `/api/process/sales` | Sales audit (`file`) |
| `POST` | `/api/v1/process/sales/validate` | Same |
| `POST` | `/api/process/sales/export-invalid` | JSON `{ "records": [ ... ] }` → Excel download |
| `POST` | `/api/v1/process/sales/export-invalid` | Same |

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
curl -s -X POST "http://127.0.0.1:8000/api/process/gross-weight" -F "file=@./gross-weight-file.xlsx"
```

Sales:

```bash
curl -s -X POST "http://127.0.0.1:8000/api/process/sales" -F "file=@./sales-file.xlsx"
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

| Processor        | Required |
| ---------------- | -------- |
| **PAN**          | `total_value`; **both** columns `pan` **and** `pan1`; at least one of `add_proof`, `add_proof_2` |
| **GST**          | `gst` |
| **Gross weight** | `manual_gross_weight`, `auto_gross_weight` (or `manual_gross_wt` / `auto_gross_wt` before canonicalization) |
| **Sales**        | `voucher_no`, `sales_account`, `product`, `manual_gross_wt`, `auto_gross_wt` (weight columns may appear as `manual_gross_weight` / `auto_gross_weight` in Excel and are aliased) |

PAN treats empty-like cells (`na`, `pending`, `-`, etc.) as missing — see `SPREADSHEET_EMPTY_TOKENS` in `app/utils/constants.py`.

## Successful PAN response shape

```json
{
  "success": true,
  "fileType": "pan",
  "totalRows": 3,
  "errorRows": 1,
  "summary": {
    "missingPanCount": 0,
    "invalidPanFormatCount": 1,
    "missingAddressProofCount": 0,
    "missingPanAbove2L": 0,
    "invalidPanFormat": 1,
    "missingAddressProofAbove50K": 0
  },
  "records": [
    {
      "rowNumber": 4,
      "date": null,
      "voucherNo": null,
      "party": null,
      "totalValue": 250000,
      "pan": "ABCDE123",
      "pan1": "",
      "addProof": "",
      "addProof2": "",
      "issues": ["INVALID_PAN_FORMAT"],
      "messages": ["No valid PAN found in PAN or PAN1 columns"]
    }
  ]
}
```

Note: Example row shows `INVALID_PAN_FORMAT` only when **`totalValue` is above ₹2,00,000** and PAN cells are non-empty but invalid; GST skeleton responses still return `success: true` with empty `records` after column checks pass.

## Error responses

Unsupported extension:

```json
{
  "success": false,
  "detail": "Unsupported file extension. Use .xlsx, .xlsm, or .xls"
}
```

Missing columns — PAN/Gross/GST (422):

```json
{
  "success": false,
  "detail": "Missing required columns: pan, pan1"
}
```

Sales missing columns (422) include structured `error` — see `SheetValidationError.to_response()` in `app/utils/sheet_validation_error.py`.

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
- Sales-specific UX errors: raise `SheetValidationError` with `code` and context keys for 422 responses.
- Update this README when processor contracts or summary fields change.
