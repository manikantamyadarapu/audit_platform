# Audit Platform — Python Service

FastAPI microservice for Excel upload validation, rate-rule storage, and invalid-row export. The Node backend proxies authenticated requests to this service.

## Folder Structure

```text
python-service/
  app/
    main.py                    # FastAPI app, CORS, exception handlers
    config/settings.py         # Environment settings (Pydantic)
    routers/                   # HTTP routes (health, process, rate rules, rate book)
    processors/                # PAN, gross weight, sales, sales return processors
    engines/                   # Shared vectorized validation engine
    sales_engine/              # Sales ledger pipeline (validators, parsers, config JSON)
    sales_return_engine/       # Sales return validation + rate comparison
    validators/                # PAN/GST helper validators
    utils/                     # Excel I/O, response builder, exporters, constants
    services/processing_service.py
  tests/                       # Pytest suite
  requirements.txt
```

## Audit Engines

| Engine | Entry processor | Purpose |
|--------|-----------------|---------|
| PAN | `pan_processor.py` | PAN format, high-value PAN rules, address proof |
| Gross weight | `gross_weight_processor.py` | Manual vs auto gross weight mismatch |
| Sales ledger | `sales_audit_processor.py` | Account/product mapping, UOM, rate deviation |
| Sales return | `sales_return_processor.py` | Return row validation + product-wise rate comparison |

Processing flow:

1. `ProcessingService` validates upload MIME/extension and reads bytes.
2. `processors/factory.py` selects processor by audit type.
3. Header row is detected; columns normalized to snake_case.
4. Validators run (vectorized Polars/DuckDB or pandas pipelines).
5. `response_builder.py` returns consistent JSON (`success`, `totalRows`, `errorRows`, `summary`, `records`).

## Validators

| Area | Location | Checks |
|------|----------|--------|
| Upload | `validators/common_validator.py` | Extension, MIME type |
| PAN helpers | `validators/pan_validator.py` | Format helpers |
| Sales mapping | `sales_engine/validators/mapping_validator.py` | Account ↔ product catalog |
| UOM | `sales_engine/validators/uom_validator.py` | Unit of measure rules |
| Metal rates | `sales_engine/validators/metal_rate_validator.py` | Gold/silver rate book bands |
| Diamond rates | `sales_engine/validators/diamond_rate_validator.py` | Diamond product bands |
| Gemstone rates | `sales_engine/validators/gemstone_rate_validator.py` | Slab-based gemstone rates |
| Sales messages | `sales_engine/validators/sales_audit_messages.py` | Business-facing issue text |

Rule configuration JSON lives in `app/sales_engine/config/` (catalog, gemstone rules, metal/diamond rate books).

## Rate Validation Logic

- **Gold/silver:** Employee-entered rates in Rate Rule Book; unit rate compared to min/max bands per product.
- **Diamond/gem:** `diamond_rate_rule_book.json` defines product rate bands.
- **Gemstone:** Slab extracted from product name; ± configured variation percent.
- **Sales return:** Average return rate per product compared to stored sales audit averages; flags higher return rates.

Issue codes (examples): `INVALID_RATE_DEVIATION`, `INVALID_PRODUCT_MAPPING`, `INVALID_UOM`, `HIGHER_SALES_RETURN_RATE`.

## PAN Audit

- **Processor:** `app/processors/pan_processor.py`
- **Required columns:** `total_value`, `pan`, `pan1`, and `add_proof` or `add_proof_2`
- **Rules:** Valid PAN format; above ₹2L requires PAN; above ₹50k requires address proof
- **Export:** `POST /api/process/pan/export-invalid` → invalid-rows Excel

## Gross Audit

- **Processor:** `app/processors/gross_weight_processor.py`
- **Required columns:** `manual_gross_weight`, `auto_gross_weight` (aliases `*_gross_wt` accepted)
- **Rule:** Absolute difference exceeds tolerance → `GROSS_WEIGHT_MISMATCH`
- **Export:** `POST /api/process/gross-weight/export-invalid`

## Sales Audit

- **Processor:** `app/processors/sales_audit_processor.py`
- **Pipeline:** `app/sales_engine/engine/vectorized_sales_engine.py`
- **Required columns:** `voucher_no`, `sales_account`, `product`, `unit_rate`, `quantity` (for transaction rows)
- **Checks:** Sales account ↔ product mapping, UOM, metal/diamond/gemstone rate deviation, unit rate range
- **Export:** `app/sales_engine/exception_report.py` builds exception rows with business Message text

## Sales Return Audit

- **Processor:** `app/processors/sales_return_processor.py`
- **Engine:** `app/sales_return_engine/`
- **Flow:** Validate return file rows (reuses sales validators where applicable); compare product average rates against sales baseline passed from Node (stored PostgreSQL averages)
- **Export:** `app/sales_return_engine/exception_report.py` — consolidated exception report

## Product Average Rates

Computed during sales ledger validation and persisted by the Node backend. Sales return audit consumes the latest stored averages as baseline for rate comparison.

## Environment Variables

Configure **`python-service/.env`** only:

```env
APP_ENV=development
LOG_LEVEL=INFO
AUDIT_DEBUG_EXPORT=false
SALES_DEBUG_EXPORT=false
```

| Variable | Purpose |
|----------|---------|
| `APP_ENV` | `development` or `production` |
| `LOG_LEVEL` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `AUDIT_DEBUG_EXPORT` | When `true`, writes slow debug workbooks under `app/debug/` |
| `SALES_DEBUG_EXPORT` | When `true`, writes sales debug trace files |

Additional tuning (tolerances, port, chunk size) uses defaults in `app/config/settings.py` when not set in env.

## Startup Instructions

```bash
cd python-service
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- **Health:** `GET http://127.0.0.1:8000/api/health`
- **Swagger:** `http://127.0.0.1:8000/docs` (disable public access in production)

## API Endpoints (direct)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/process/pan` | PAN validation |
| `POST` | `/api/process/gross-weight` | Gross weight validation |
| `POST` | `/api/process/sales` | Sales ledger validation |
| `POST` | `/api/process/sales-return/validate` | Sales return validation |
| `GET`/`POST` | `/api/rate-rules` | Gold/silver rate book |
| `GET`/`POST` | `/api/rate-book/diamonds` | Diamond rate book |

Gateway-prefixed mirrors exist under `/api/v1/...` when called via Node.

## Tests

```bash
cd python-service
PYTHONPATH=. pytest tests/ -q
```

Focused smoke:

```bash
PYTHONPATH=. pytest tests/test_health.py tests/test_gross_weight_processor.py tests/test_sales_exception_report.py -q
```

## Production Notes

- Keep port **8000** on a **private network** — Node proxies all client traffic.
- Set `APP_ENV=production` and `LOG_LEVEL=INFO`.
- Keep `AUDIT_DEBUG_EXPORT` and `SALES_DEBUG_EXPORT` as `false`.
- Unhandled errors return `{ "success": false, "message": "Internal server error" }` without stack traces.
