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
- **Sales:** strict master-rule comparison only. Uploaded rows are validated only against `app/data/master_sales_rules.xlsx`.
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

### Sales strict flow

1. Upload sales Excel
2. Detect header row
3. Normalize uploaded `sales_account`, `product`, and `unit_rate`
4. Load master verification workbook from `app/data/master_sales_rules.xlsx`
5. Normalize master workbook values the same way
6. Perform strict DuckDB joins
7. Return only invalid sales rows

Sales audit does **not** validate GST, PAN, gross weight, tax calculations, or address proof.

## Project structure

```text
python-service/
  app/
    config/                 Runtime settings
    core/
      issue_engine.py       Central issue-code registry, severity/category metadata, audit trace helpers
    data/
      master_sales_rules.csv    Legacy seed/reference data
      master_sales_rules.xlsx   Active master verification workbook for sales audit
    engines/
      vectorized_validation_engine.py  Shared OpenPyXL + Polars + DuckDB helpers
      vectorized_sales_engine.py       Strict sales rule-comparison engine
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

**Supporting:** `app/engines/vectorized_sales_engine.py`, `app/services/master_rule_service.py`, `app/utils/normalization_engine.py`

Master rule source:

- `app/data/master_sales_rules.xlsx`

Expected master workbook columns:

- `Sales Account Type`
- `Product`
- `Expected Rate`
- `Allowed Deviation`

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

Strict normalization before comparison:

- uppercase
- trim leading/trailing spaces
- collapse repeated spaces
- remove hidden Excel characters

Strict validation rules:

1. **Sales account must exactly exist in the master workbook**
   - issue: `INVALID_SALES_ACCOUNT`
2. **Product must exist in the master workbook**
   - issue: `PRODUCT_NOT_FOUND_IN_MASTER`
3. **Product must belong to the uploaded sales account according to the master workbook**
   - issue: `INVALID_PRODUCT_MAPPING`
4. **Unit rate must be within the master-defined allowed deviation**
   - issue: `RATE_DEVIATION_VIOLATION`

Allowed rate range is derived only from the master workbook:

- minimum = `expected_rate * (1 - allowed_deviation_percent / 100)`
- maximum = `expected_rate * (1 + allowed_deviation_percent / 100)`

Sales invalid-row records return:

- `rowNumber`
- `voucherNo`
- `salesAccount`
- `product`
- `unitRate`
- `issues`
- `messages`

Sales summary fields include:

- `invalidSalesAccounts`
- `invalidProductMappings`
- `productsNotFoundInMaster`
- `rateDeviationViolations`

Missing required columns after header detection raise `SheetValidationError` with structured 422 details.

## Enterprise issue model

`app/core/issue_engine.py` centralizes issue definitions with:

- `issue_code`
- `severity`
- `category`
- default message
- audit trace metadata

Current registry covers PAN, gross-weight, legacy sales issue codes, and the strict sales codes:

- `INVALID_SALES_ACCOUNT`
- `INVALID_PRODUCT_MAPPING`
- `PRODUCT_NOT_FOUND_IN_MASTER`
- `RATE_DEVIATION_VIOLATION`

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

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

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
| `POST` | `/api/process/sales` | Strict master-rule sales audit |
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
        "Product does not belong to the uploaded sales account in the master sales verification sheet."
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
- Keep strict sales validation tied only to `app/data/master_sales_rules.xlsx`.
- Update this README whenever processor contracts, export sheets, or summary fields change.
