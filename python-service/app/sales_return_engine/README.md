# Sales Return Audit Engine

Dual-file audit for **Sales Return** workbooks. The engine runs in two phases:

1. **Return row validation** — reuses the full [Sales Audit Engine](../sales_engine/README.md) on the sales return file (mapping, UOM, unit rate, gemstone/metal rules).
2. **Product-wise rate comparison** — compares average return rate vs average sales rate per product using **both** uploaded files.

PAN, gross weight, GST, and voucher logic remain **out of scope** (same as sales audit).

---

## What it validates

| Phase | Scope | Output |
| ----- | ----- | ------ |
| **Return validation** | Every transaction row in the **Sales Return** file | Invalid rows with sales-engine issue codes (mapping, UOM, rate deviation, free-quantity unit rate, …) |
| **Rate comparison** | Products present in the **Sales Return** aggregates | One comparison row per violating product (`HIGHER_SALES_RETURN_RATE` or `PRODUCT_NOT_FOUND_IN_SALES`) |

The **Sales Audit** file is used only for rate-comparison baselines (not re-validated as return rows).

---

## Architecture

```text
sales_return_engine/
  engine/
    sales_return_audit_engine.py   Load both files → validate return → compare averages
  __init__.py

app/processors/sales_return_audit_processor.py   Entry point (dual bytes in → JSON out)

Reused from sales_engine/
  engine/vectorized_sales_engine.py              Return row validation
  validators/uom_validator.py                    UOM rules (Grams vs Carats)
  validators/unit_rate_range_validator.py        0–1 unit rate for misc products
  config/uom_rules.json                          Grams product list
  config/sales_ledger_catalog.json               Account ↔ product mapping
```

**Frontend:** Scrutiny → **Sales Return Audit** (`/scrutiny/sales-return-rate`)  
**Node proxy:** `POST /api/v1/process/sales-return/validate`  
**Python:** `POST /api/process/sales-return/validate` (also `/api/v1/process/...`)

---

## End-to-end flow

```text
┌─────────────────────┐     ┌──────────────────────────┐
│  Sales Audit File   │     │  Sales Return Audit File │
│  (baseline rates)   │     │  (validated + compared)  │
└──────────┬──────────┘     └────────────┬─────────────┘
           │                             │
           │         Load + detect header │
           │         Canonicalize columns │
           └──────────────┬──────────────┘
                          │
           ┌──────────────▼──────────────┐
           │  Phase 1: Return validation │
           │  VectorizedSalesEngine      │
           │  (same rules as sales)      │
           └──────────────┬──────────────┘
                          │
           ┌──────────────▼──────────────┐
           │  Phase 2: Rate comparison   │
           │  SUM(gross) / SUM(qty)      │
           │  per product (both files)   │
           └──────────────┬──────────────┘
                          │
           ┌──────────────▼──────────────┐
           │  JSON response + Excel export│
           └─────────────────────────────┘
```

### Step-by-step

1. Accept **two** Excel uploads: Sales Audit + Sales Return Audit.
2. Detect header row on each file (preamble/title rows supported).
3. **Canonicalize** column names (`sales_return_account` → `sales_account`, `qty` → `quantity`, etc.).
4. On the return file, normalize account text: `Sales Return` → `Sales` (case-insensitive) so mapping rules align with sales ledger catalog.
5. **Validate return rows** via `VectorizedSalesEngine.validate_loaded_sheet()`.
6. **Build product averages** from both files (see formula below).
7. **Compare** return averages to sales averages — exact product key match only.
8. Return combined JSON; UI shows return invalid rows + rate comparison table separately.

---

## Required columns

### Both files (minimum)

| Normalized column | Typical Excel header | Required for |
| ----------------- | -------------------- | ------------ |
| `voucher_no` | Voucher No | Transaction detection |
| `sales_account` | Sales Account | Mapping (sales file) |
| `sales_return_account` | Sales Return Account | Mapping (return file; renamed to `sales_account`) |
| `product` | Product | Mapping + comparison key |
| `unit_rate` | Unit Rate | Sales-engine rate rules |
| `quantity` | Quantity | Averages + transaction filter |
| `gross_amount` | Gross Amount | Average rate formula |

Header detection accepts either `sales_account` **or** `sales_return_account` on the return file.

### Transaction row rules

A row counts as a transaction when **all** of the following hold:

- Non-blank voucher, sales account, product
- **Quantity &gt; 0** (zero or negative qty rows are **skipped** — no division, no average contribution)
- Not a repeated header, blank row, or business-skip row (repair charges, etc.)

Rows with `Quantity = 0` are excluded from `SUM(gross) / SUM(qty)` and do not produce `ZeroDivisionError`.

---

## Phase 1 — Return row validation (reused sales engine)

All rules documented in [sales_engine/README.md](../sales_engine/README.md) apply to the **return file**, including:

| Check | Issue codes (examples) |
| ----- | ------------------------ |
| Sales account ↔ product mapping | `INVALID_PRODUCT_MAPPING` |
| Gemstone slab ±30% | `INVALID_RATE_DEVIATION` |
| Gold/silver rule-book ±30% | `INVALID_RATE_DEVIATION` |
| UOM vs product category | `INVALID_UOM` |
| Unit rate 0–1 for misc products | `INVALID_UNIT_RATE_RANGE` → mapped to **`INVALID_FREE_QUANTITY`** on return output |

### UOM rules (Grams vs Carats)

Configured in `app/sales_engine/config/uom_rules.json` + `validators/uom_validator.py`.

| Expected UOM | Products / categories |
| ------------ | --------------------- |
| **Carats** | Default for all products **not** in the grams list — Diamonds, Emeralds, Rubies, Color stones, etc. |
| **Grams** | Gold Ornaments (14K–Jadau), Standard Gold 24K, Customer Gold 18K/22K, Silver articles, Black beads, **Nail**, Dori, Lac, Wax Dori Etc, Pearls (literal), Pearls JPS `{n}` pattern |

Invoice UOM is normalized from values like `Grams`, `GMS`, `Carats`, `CTS`, etc.

Mismatch → `INVALID_UOM` — *Invalid UOM for product.*

### Free-quantity / misc products (unit rate 0–1)

These normalized product names require **0 ≤ unit rate ≤ 1** (inclusive):

- Lac  
- Nail  
- Dori  
- Black beads  
- Wax  
- Wax, Dori Etc  

Valid examples: `0`, `0.01`, `0.50`, `1.00`  
Invalid examples: `1.01`, `2`, `10`

Internal sales-engine code: `INVALID_UNIT_RATE_RANGE`  
**Sales Return API output:** remapped to **`INVALID_FREE_QUANTITY`** with message *Unit rate must be between 0 and 1 for this product.*

---

## Phase 2 — Product-wise average rate comparison

### Formula (product-wise)

For each distinct product (exact normalized key):

```text
average_rate = SUM(gross_amount) / SUM(quantity)
```

- Aggregates **all transaction rows** for that product in the file.
- **Not** `AVG(unit_rate)` and **not** row-by-row averaging.
- Uses parsed numeric gross amount and quantity from enriched dataframe.
- Products with no rows where `quantity > 0` do not appear in averages.

### Product matching

Products are matched by **`normalize_strict_text(product)`** — uppercase, collapsed spaces, hidden characters stripped.

| Match type | Example |
| ---------- | ------- |
| **Exact** | `Di. RA 15` ↔ `Di. RA 15` |
| **No partial** | `Di. RA 15` ≠ `Di. RA 150` |
| **No partial** | `Flat Polki FP 1` ≠ `Flat Polki FP 10` |

### Comparison rules

For each product in **return averages**:

| Condition | Issue | Message |
| --------- | ----- | ------- |
| Product **not** in sales averages | `PRODUCT_NOT_FOUND_IN_SALES` | Product not found in Sales Audit file. |
| `return_average_rate > sales_average_rate` | `HIGHER_SALES_RETURN_RATE` | Average sales return rate is higher than average sales rate. |
| `return_average_rate ≤ sales_average_rate` | *(no row)* | Compliant — not exported to comparison table |

**One output row per violating product** — multiple return lines for the same product are grouped before comparison.

### Example — higher return rate

| File | Gross | Qty | Average |
| ---- | ----- | --- | ------- |
| Sales | 900,000 | 100 | **9,000** |
| Return | 95,000 | 10 | **9,500** |

Difference = 500 → `HIGHER_SALES_RETURN_RATE`.

### Example — product missing in sales

Return file contains `Flat Polki FP 10` but the sales file has no rows for that product → `PRODUCT_NOT_FOUND_IN_SALES` (no crash, sales columns show 0).

---

## Issue codes (Sales Return specific)

| Code | When | In response |
| ---- | ---- | ----------- |
| `HIGHER_SALES_RETURN_RATE` | Return avg rate &gt; sales avg rate | `rateComparisonRecords` |
| `PRODUCT_NOT_FOUND_IN_SALES` | Return product has no sales aggregate | `rateComparisonRecords` |
| `INVALID_FREE_QUANTITY` | Unit rate outside 0–1 for Lac/Nail/Dori/etc. | `returnValidationRecords` (mapped from `INVALID_UNIT_RATE_RANGE`) |

All standard sales issue codes may also appear in `returnValidationRecords` (`INVALID_UOM`, `INVALID_PRODUCT_MAPPING`, `INVALID_RATE_DEVIATION`, …).

---

## API

### Validate (multipart)

**Node:** `POST /api/v1/process/sales-return/validate`  
**Python:** `POST /api/process/sales-return/validate`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `salesFile` | file | Sales Audit Excel (Node multipart name) |
| `salesReturnFile` | file | Sales Return Audit Excel |
| `sales_file` | file | Python FastAPI multipart name |
| `sales_return_file` | file | Python FastAPI multipart name |

### Export rate comparison (JSON)

**Node:** `POST /api/v1/process/sales-return/export-rate-comparison`  
**Python:** `POST /api/process/sales-return/export-rate-comparison`

Body: `{ "records": [ ...rateComparisonRecords ] }`

### Response shape (success)

```json
{
  "success": true,
  "fileType": "sales_return",
  "totalRows": 120,
  "errorRows": 15,
  "summary": {
    "returnValidationErrorRows": 10,
    "salesProductCount": 45,
    "returnProductCount": 38,
    "higherReturnRateProducts": 3,
    "productsNotFoundInSales": 2,
    "rateComparisonViolations": 5,
    "processingMs": 842.1
  },
  "returnValidationRecords": [ "..." ],
  "rateComparisonRecords": [ "..." ],
  "records": "returnValidationRecords + rateComparisonRecords"
}
```

### Rate comparison record fields

| Field | Excel export header |
| ----- | ------------------- |
| `product` | Product |
| `salesTotalGrossAmount` | Sales Total Gross Amount |
| `salesTotalQuantity` | Sales Total Quantity |
| `salesAverageRate` | Sales Average Rate |
| `returnTotalGrossAmount` | Sales Return Total Gross Amount |
| `returnTotalQuantity` | Sales Return Total Quantity |
| `returnAverageRate` | Sales Return Average Rate |
| `difference` | Difference |
| `issues` | Issue |
| `messages` | Message |

Export workbook sheet: **Higher Return Rate Products** (plus standard Summary / Issue Breakdown sheets from `audit_reporter.py`).

Return invalid rows can be exported separately from the UI using the same sales invalid-row Excel layout.

---

## UI integration

| Layer | Path / component |
| ----- | ---------------- |
| Route | `/scrutiny/sales-return-rate` |
| Page | `frontend/src/pages/SalesReturnRateAudit.jsx` |
| Tables | `SalesResultsTable` (return validation), `SalesReturnRateComparisonTable` (rate comparison) |
| API client | `frontend/src/services/processExcelService.js` → `validateSalesReturnAudit`, `exportSalesReturnRateComparison` |

Upload **both** files, run validation, review KPIs (return errors, higher-rate products), export comparison Excel or return invalid rows.

---

## Configuration

| File | Purpose |
| ---- | ------- |
| `sales_engine/config/uom_rules.json` | Grams product list for UOM |
| `sales_engine/config/sales_ledger_catalog.json` | Account ↔ product mapping |
| `sales_engine/config/gemstone_rules.json` | ±30% slab families |
| `sales_engine/config/metal_rate_rule_book.json` | Gold/silver entered rates |

Changes require **Python service restart** (same as sales audit).

---

## Tests

```bash
cd python-service
python -m pytest tests/test_sales_return_audit_engine.py -q
python -m pytest tests/test_sales_return_audit_verification.py -q
```

Verification suite covers:

- Product missing in sales file  
- Zero quantity (no division error)  
- UOM Grams/Carats rules + Pearls/Nail  
- Free-quantity unit rate 0–1  
- SUM(gross)/SUM(qty) average formula  
- Exact product matching (no partial match)  
- One comparison row per product  
- Excel export columns  
- Higher sales return rate detection  

---

## Related documentation

- [Sales Audit Engine](../sales_engine/README.md) — mapping, rate deviation, UOM internals  
- [Python Service README](../../README.md) — run locally, env vars, API overview  

---

## Changing rules

| Change | Where |
| ------ | ----- |
| UOM grams products | `sales_engine/config/uom_rules.json` |
| 0–1 unit rate product list | `sales_engine/validators/unit_rate_range_validator.py` → `ZERO_TO_ONE_PRODUCTS` |
| Mapping / catalog | `sales_engine/config/sales_ledger_catalog.json` |
| Comparison thresholds | `sales_return_engine/engine/sales_return_audit_engine.py` → `_compare_product_averages` |

Restart `uvicorn` after config or code changes.
