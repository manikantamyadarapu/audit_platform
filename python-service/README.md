# Excel Validation and Auditing Service

FastAPI microservice for Excel-based audit validation. The active processors are:

- PAN audit
- Gross weight audit
- Sales audit

The service keeps a uniform JSON contract for validation responses and supports downloadable Excel reports for invalid rows.

The **Node** gateway in this repo (`backend`) proxies some routes to this service. See [`../backend/README.md`](../backend/README.md) for gateway-facing API details.

## Current status

- **PAN:** full validation with header-row detection, row skipping, PAN format/equivalent checks, and address-proof rules.
- **Gross weight:** full vectorized validation with header detection, alias handling, mismatch/difference/negative checks, and benchmark logging.
- **Sales:** official jewelry sales engine — account ↔ product mapping plus gemstone slab unit rates (±30%). Rules live in `app/sales_engine/config/` (see [`app/sales_engine/README.md`](app/sales_engine/README.md)).
- **Enterprise reporting:** invalid-row exports are multi-sheet Excel workbooks with summary, issue breakdown, grouping, statistics, timing, and invalid-row sheets.
- **GST:** not active in the current processor registry.

## Tech stack

- Python 3.10+
- FastAPI, Uvicorn
- Pandas
- OpenPyXL
- XlsxWriter
- Polars
- DuckDB
- PyArrow
- Pydantic / Pydantic Settings
- Loguru
- Pytest
- RapidFuzz

## Architecture

### Shared validation flow

1. Upload Excel workbook
2. Detect the real header row even when title/metadata rows exist above it
3. Normalize headers to `snake_case`
4. Load into vectorized data structures
5. Run processor-specific validation
6. Return unchanged JSON response shape
7. Export invalid rows as Excel when requested

### Sales audit flow

1. Upload sales Excel
2. Detect header row; assign immutable `source_excel_row_number` per physical row
3. Normalize `sales_account`, `product`, and `unit_rate`
4. Validate **mapping** against `app/sales_engine/config/mappings.json` (prefix families)
5. Validate **gemstone unit rates** from slab digits in the product name (±30%; Rubies, Emeralds, Pearls, Color stones)
6. Return only invalid rows (stable Excel row numbers + original cell snapshots)

Sales audit does **not** validate GST, PAN, gross weight, voucher business rules, invoice totals, or external master Excel joins.

## Project structure

```text
python-service/
  app/
    config/                 Runtime settings
    core/
      issue_engine.py       Central issue-code registry, severity/category metadata, audit trace helpers
    data/
      master_sales_rules.xlsx   Legacy reference (not used by current sales engine)
    sales_engine/               Official sales audit (mapping + gemstone slab rates)
      README.md                 Sales engine documentation
      config/mappings.json
      config/gemstone_rules.json
      engine/vectorized_sales_engine.py
    engines/
      vectorized_validation_engine.py  Shared OpenPyXL + Polars sheet loader
      vectorized_sales_engine.py       Re-export of sales_engine entry point
    processors/
      pan_processor.py
      gross_weight_processor.py
      sales_audit_processor.py
      factory.py
    routers/
      health_router.py
      process_router.py
    services/
      processing_service.py
      master_rule_service.py
    utils/
      audit_reporter.py         Multi-sheet enterprise Excel report generator
      audit_row_skips.py        Shared skip logic for PAN / gross weight
      constants.py              Issue messages and validation constants
      excel_exporter.py         Export entry points for PAN / gross weight / sales
      header_cleaner.py         Header normalization
      master_sales_rule_engine.py   Legacy CSV-backed rule helper utilities
      normalization_engine.py   Strict uppercase/trim/hidden-char normalization
      response_builder.py       Uniform response shape
      sheet_validation_error.py Structured 422 for sales
      weight_decimal.py         Gross-weight decimal parsing
    validators/
      common_validator.py
    main.py
  tests/
  requirements.txt
  README.md
```

## Active processors

### PAN audit

**Module:** `app/processors/pan_processor.py`

Required normalized columns:

- `total_value`
- `pan`
- `pan1`
- at least one of `add_proof`, `add_proof_2`

Behavior:

1. Detects header row when title rows exist above the table.
2. Skips blank rows, repeated header rows, subtotal rows, and rows without voucher numbers when applicable.
3. Treats PAN as valid if it matches Indian PAN format or accepted equivalents such as Form No-60 / US DL.
4. Above `total_value > 200000`, flags:
   - `MISSING_PAN_ABOVE_2L`
   - `INVALID_PAN_FORMAT`
5. Above `total_value > 50000`, flags:
   - `MISSING_ADDRESS_PROOF_ABOVE_50K`

Summary fields include:

- `missingPanCount`
- `invalidPanFormatCount`
- `missingAddressProofCount`
- `missingPanAbove2L`
- `invalidPanFormat`
- `missingAddressProofAbove50K`

### Gross weight audit

**Module:** `app/processors/gross_weight_processor.py`

Required normalized columns:

- `manual_gross_weight`
- `auto_gross_weight`

Supported aliases:

- `manual_gross_wt` -> `manual_gross_weight`
- `auto_gross_wt` -> `auto_gross_weight`
- optional difference aliases such as `diff`, `weight_difference`, `gross_difference`

Behavior:

1. Detects header row when needed.
2. Uses vectorized validation via Polars and DuckDB.
3. Flags:
   - `NEGATIVE_WEIGHT_VALUES`
   - `GROSS_WEIGHT_MISMATCH`
   - `GROSS_WEIGHT_DIFFERENCE_VIOLATION`
4. Emits benchmark logging for header detection, load, validation, extraction, and total execution time.

Summary fields include:

- `mismatchCount`
- `differenceViolations`
- `negativeValueViolations`
- `weightMismatch`

### Sales audit

**Module:** `app/processors/sales_audit_processor.py`  
**Engine:** `app/sales_engine/engine/vectorized_sales_engine.py`  
**Docs:** [`app/sales_engine/README.md`](app/sales_engine/README.md)

Rule sources (JSON, editable without code changes):

- `app/sales_engine/config/mappings.json` — sales account ↔ product families
- `app/sales_engine/config/gemstone_rules.json` — slab regex, ±30%, rate-skip tokens

Required uploaded normalized columns:

- `voucher_no`
- `sales_account`
- `product`
- `unit_rate`

Typical uploaded header examples:

- `Voucher No` -> `voucher_no`
- `Sales Account` -> `sales_account`
- `Product` -> `product`
- `Unit Rate` -> `unit_rate`

Normalization (all compared text):

- uppercase, trim, collapse spaces, remove hidden Unicode

Validation rules:

1. **Sales account ↔ product mapping** (prefix families, no fuzzy match)
   - issue: `INVALID_PRODUCT_MAPPING`
2. **Gemstone unit rate** (Rubies, Emeralds, Pearls, Color stones; slab from product name; ±30%)
   - issue: `INVALID_RATE_DEVIATION`
   - skipped when product contains `CUSTOMER`, `MIX`, or `LOOSE`
   - not applied to Gold, Silver, or Diamonds

Slab rate example: `RUBIES JRU 3400` → slab `3400` → allowed unit rate **2380–4420**.

Invalid-row records include `rowNumber`, `sourceExcelRowNumber`, `originalExcel*` / `validation*` fields, `unitRate`, slab band fields, `issues`, and `messages`.

Summary fields (API):

- `invalidProductMappings`
- `rateDeviationViolations`
- `invalidSalesAccounts`, `productsNotFoundInMaster`, `rateMasterNotFound` — kept for compatibility, always **0** with the current engine

Missing required columns after header detection raise `SheetValidationError` with structured 422 details.

## Enterprise issue model

`app/core/issue_engine.py` centralizes issue definitions with:

- `issue_code`
- `severity`
- `category`
- default message
- audit trace metadata

Current registry covers PAN, gross-weight, and sales codes. **Active sales issues:**

- `INVALID_PRODUCT_MAPPING`
- `INVALID_RATE_DEVIATION`

Legacy codes (`INVALID_SALES_ACCOUNT`, `PRODUCT_NOT_FOUND_IN_MASTER`, `RATE_MASTER_NOT_FOUND`) remain in the registry for older clients but are not emitted by the current sales engine.

## Enterprise reporting

Invalid-row export endpoints generate downloadable Excel reports using `XlsxWriter` and `OpenPyXL`.

Each workbook includes:

- `Summary`
- `Issue Breakdown`
- `Issue Grouping`
- `Processing Statistics`
- `Execution Timing`
- processor-specific invalid-row sheet

Export payloads support optional:

- `summary`
- `processingStatistics`
- `executionTiming`

## Requirements

- Python 3.10+
- `pip`
- supported Excel uploads: `.xlsx`, `.xlsm`, `.xls`

## Setup

From the repository root:

### Windows (PowerShell)

```powershell
cd python-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Git Bash / Linux / macOS

```bash
cd python-service
python -m venv .venv
source .venv/bin/activate   # Windows Git Bash: source .venv/Scripts/activate
pip install -r requirements.txt
```

## Environment variables

Defaults live in `app/config/settings.py`; `.env` is optional.

```env
APP_ENV=development
APP_PORT=8000
LOG_LEVEL=INFO
CHUNK_SIZE=2500
GROSS_WEIGHT_TOLERANCE=0.5
GROSS_WEIGHT_MATCH_EPSILON=0.001
```

Notes:

- `CHUNK_SIZE` is still available for legacy/shared flows.
- sales audit no longer uses `GROSS_WEIGHT_TOLERANCE`.

## Run the service

From `python-service` with the virtual environment activated:

```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If you see `Unable to create process` pointing at another user’s path, recreate the venv on this machine (`rm -rf .venv`, then `python -m venv .venv` and `pip install -r requirements.txt`).

- API base: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## HTTP errors

| Status | Typical cause |
| ------ | ------------- |
| `400`  | Bad upload, unreadable Excel, empty export request, missing master workbook, etc. |
| `422`  | Missing required columns or other structured sales sheet-shape failures |
| `500`  | Unexpected processing failure |

## API endpoints

Active endpoints:

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET`  | `/api/health` | Health check |
| `POST` | `/api/process/pan` | PAN audit |
| `POST` | `/api/v1/process/pan/validate` | Same as above |
| `POST` | `/api/process/pan/export-invalid` | Export PAN invalid rows as Excel |
| `POST` | `/api/v1/process/pan/export-invalid` | Same |
| `POST` | `/api/process/gross-weight` | Gross-weight audit |
| `POST` | `/api/v1/process/gross-weight/validate` | Same |
| `POST` | `/api/process/gross-weight/export-invalid` | Export gross-weight invalid rows as Excel |
| `POST` | `/api/v1/process/gross-weight/export-invalid` | Same |
| `POST` | `/api/process/sales` | Official sales audit (mapping + gemstone slab rates) |
| `POST` | `/api/v1/process/sales/validate` | Same |
| `POST` | `/api/process/sales/export-invalid` | Export sales invalid rows as Excel |
| `POST` | `/api/v1/process/sales/export-invalid` | Same |

Legacy GST routes still exist in `process_router`, but GST is not registered as an active processor.

## Request examples

Health:

```bash
curl http://127.0.0.1:8000/api/health
```

PAN validation:

```bash
curl -s -X POST "http://127.0.0.1:8000/api/process/pan" -F "file=@./pan-file.xlsx"
```

Gross weight validation:

```bash
curl -s -X POST "http://127.0.0.1:8000/api/process/gross-weight" -F "file=@./gross-weight-file.xlsx"
```

Sales validation:

```bash
curl -s -X POST "http://127.0.0.1:8000/api/process/sales" -F "file=@./sales-file.xlsx"
```

Sales invalid-row export:

```json
{
  "records": [
    {
      "rowNumber": 2,
      "voucherNo": "V1",
      "salesAccount": "SALES A",
      "product": "PRODUCT X",
      "unitRate": 155,
      "issues": ["INVALID_PRODUCT_MAPPING"],
      "messages": [
        "Product does not belong to the selected sales account."
      ]
    }
  ],
  "summary": {
    "invalidProductMappings": 1
  },
  "processingStatistics": {
    "totalRows": 7
  },
  "executionTiming": {
    "validationMs": 15.0
  }
}
```

## Header normalization

Headers are normalized with:

- lowercase
- trim
- non-alphanumeric to `_`
- strip leading/trailing `_`

Examples:

- `PAN` -> `pan`
- `Manual Gross Weight` -> `manual_gross_weight`
- `Unit Rate` -> `unit_rate`

## Required columns

| Processor | Required normalized columns |
| --------- | --------------------------- |
| PAN | `total_value`, `pan`, `pan1`, and one of `add_proof` / `add_proof_2` |
| Gross weight | `manual_gross_weight`, `auto_gross_weight` |
| Sales | `voucher_no`, `sales_account`, `product`, `unit_rate` |

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

- Register new processors in `app/processors/factory.py`.
- Keep `app/utils/response_builder.py` as the outward response contract helper.
- Use `SheetValidationError` for sales sheet-shape errors that should surface as structured 422 responses.
- Change official sales rules in `app/sales_engine/config/mappings.json` and `gemstone_rules.json`.
- See [`app/sales_engine/README.md`](app/sales_engine/README.md) for sales-specific architecture and examples.
- Update this README whenever processor contracts, export sheets, or summary fields change.
