# Official Jewelry Sales Audit Engine

Vectorized sales validation for the enterprise sales ledger. This module implements the **official sales account ↔ product mapping** and **gemstone slab unit-rate** rules from the jewelry sales verification sheet.

PAN audit, gross weight audit, and GST are **not** handled here.

## What it validates

| Validation | Scope |
| ---------- | ----- |
| **Product mapping** | Sales account must own the product (prefix-based family match) |
| **Unit rate (±30%)** | Rubies, Emeralds, Pearls, Color stones only — slab price taken from the product name |

**No rate check** for Gold, Silver, or Diamonds (mapping only).

**No** external master Excel joins, fuzzy matching, amount÷quantity, voucher logic, PAN, or gross weight.

## Architecture

```text
sales_engine/
  config/
    mappings.json           Official account → product families
    gemstone_rules.json     Slab regex, ±30%, rate-skip tokens
  config/loader.py          Cached JSON config access
  parsers/
    product_family_router.py  Strict regex → product_family
    product_price_parser.py   Family-based slab extraction
  validators/
    mapping_validator.py      Account ↔ product_family
    gemstone_rate_validator.py  Slab band + skip rules
  engine/
    vectorized_sales_engine.py  Load, enrich, adjudicate, export invalid rows
```

Entry point for the API: `app/processors/sales_audit_processor.py`  
Compatibility re-export: `app/engines/vectorized_sales_engine.py`

Shared Excel loading (immutable row numbers): `app/engines/vectorized_validation_engine.py`

## Validation flow

1. Upload sales Excel (`.xlsx` / `.xlsm` / `.xls`).
2. Detect header row (supports title/preamble rows above the table).
3. Assign **`source_excel_row_number`** = physical worksheet row (never regenerated).
4. Normalize text: uppercase, trim, collapse spaces, strip hidden Unicode.
5. Keep only **transaction rows**: voucher + sales account + product + quantity &gt; 0; skip subtotals, repair charges, blank rows, repeated headers.
6. **Mapping:** match `sales_account` + `product` against `config/mappings.json` using prefix families (e.g. `RUBIES JRU 3400` → family `RUBIES JRU`).
7. **Rate (gemstones):** parse slab from product name; compare uploaded unit rate to slab × 0.70 … slab × 1.30 unless product contains `CUSTOMER`, `MIX`, or `LOOSE`.
8. Return **only invalid rows** with stable Excel row identity and debug fields.

## Configuration

### `config/mappings.json`

| Section | Purpose |
| ------- | ------- |
| `account_families` | Sales account → allowed `product_family` codes |
| `product_family_route_order` | Priority when multiple patterns could match |
| `product_family_patterns` | Strict regex per family (full match via `str.contains`) |

**Pipeline:** normalize product → route to `product_family` → check account allows that family.

Examples:

- `RUBIES JRU 3400` → family `RUBIES` → valid on `JEWELS SALES ACCOUNT - RUBIES`
- `EMERALDS JEM 500` on Rubies account → `INVALID_PRODUCT_MAPPING`
- `WIDGET X` → no family → `INVALID_PRODUCT_MAPPING`

### `config/gemstone_rules.json`

| Field | Purpose |
| ----- | ------- |
| `deviation_percent` | Allowed band (default **30** → ±30%) |
| `rate_skip_tokens` | Skip rate when product contains `CUSTOMER`, `MIX`, or `LOOSE` |
| `rate_validation_families` | Families that get slab rate checks |
| `price_patterns` | Per-family regex to extract slab (e.g. `JRU (\d+)$`) |

Rate validation applies only to: **RUBIES, EMERALDS, PEARLS, COLOR_STONES, SEMI_PRECIOUS, SYNTHETIC**.

Rate formula:

```text
min_allowed = slab × (1 - deviation_percent/100)
max_allowed = slab × (1 + deviation_percent/100)
```

`rateValidationSource` on invalid rows is `product_slab` (not an external rate workbook).

## Required upload columns

After header normalization:

| Column | Typical Excel header |
| ------ | -------------------- |
| `voucher_no` | Voucher No |
| `sales_account` | Sales Account |
| `product` | Product |
| `unit_rate` | Unit Rate |

`quantity` is used to identify transaction rows but is not validated against business rules.

Other columns (party name, GST, gross weight, etc.) are ignored for validation; party name may still appear on invalid-row output when present.

## Issue codes (sales only)

| Code | When |
| ---- | ---- |
| `INVALID_PRODUCT_MAPPING` | Unknown account, or product not in that account’s families |
| `INVALID_RATE_DEVIATION` | Gemstone slab product: unit rate outside ±30% band |

Messages (see `app/utils/constants.py`):

- *Product does not belong to the selected sales account.*
- *Unit rate is outside the allowed ±30% deviation band.*

## Invalid-row payload (API)

Each invalid record includes:

| Field | Description |
| ----- | ----------- |
| `rowNumber` / `sourceExcelRowNumber` | Original Excel row (immutable) |
| `voucherNo` / `voucherNorm` | Voucher display and normalized key |
| `originalExcelSalesAccount` / `originalExcelProduct` / `originalExcelUnitRate` | Raw cell values from upload |
| `validationSalesAccount` / `validationProduct` | Normalized values used for rules |
| `unitRate` / `uploadedUnitRate` | Parsed unit rate |
| `standardRate` / `masterStandardRate` | Slab from product name (gemstones) |
| `minAllowedRate` / `maxAllowedRate` | ±30% band |
| `rateValidationSource` | `product_slab` or `skipped` |
| `issues` / `messages` | Codes and human-readable text |

## Row identity

`source_excel_row_number` is set once when the sheet is read (1-based physical row). It is **never** reset with `reset_index`, `enumerate`, or join row multiplication.

If export row **1382** shows the wrong product, compare `originalExcelProduct` to the workbook — that field is frozen at load time.

## Performance

- Polars expressions end-to-end for validation (no per-row Python loops).
- No DuckDB master joins for sales adjudication.
- Suitable for **10,000+** transaction rows.

Benchmark logs: `[sales] vectorized validation benchmark ...`

Debug CSV (optional): `app/debug/sales_transaction_pipeline.csv`

## Examples

**Valid mapping + rate**

- Account: `JEWELS SALES ACCOUNT - RUBIES`
- Product: `RUBIES JRU 3400`
- Unit rate: `4000` (within 2380–4420)

**Invalid mapping**

- Same product under `JEWELS SALES ACCOUNT - PEARLS` → `INVALID_PRODUCT_MAPPING`

**Invalid rate**

- Product: `RUBIES JRU 1000`, unit rate: `1500` → `INVALID_RATE_DEVIATION`

**Rate skipped**

- Product: `CUSTOMER RUBIES` or `RUBIES JRU MIX` → mapping only

**Gold — rate ignored**

- Account: `GOLD SALES ACCOUNT - 22K`, product: `BLACK BEADS`, any unit rate → mapping only

## Tests

```bash
cd python-service
source .venv/Scripts/activate   # or PowerShell Activate.ps1
python -m pytest tests/test_sales_audit_processor.py -q
```

## Legacy files (not used by this engine)

These remain in the repo for reference or other tooling but are **not** loaded by the current sales audit path:

- `app/data/master_sales_rules.xlsx`
- `app/data/master_sales_rate_rules.xlsx`
- `app/services/master_rule_service.py`
- `app/services/master_sales_rate_rule_service.py`

Update **`app/sales_engine/config/*.json`** to change official sales rules.
