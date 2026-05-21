# Official Jewelry Sales Audit Engine

Vectorized sales validation for the enterprise sales ledger. The engine enforces **two** rule families only:

1. **Sales account ↔ product mapping** (official Sales Ledger Verification catalog)
2. **Unit rate ±30%** (gemstone slab from product name; gold/silver from employee-entered market rates)

PAN, gross weight, GST, address proof, voucher logic, and external master Excel joins are **out of scope**.

## What it validates

| Check | Accounts / products | How it works |
| ----- | ------------------- | ------------ |
| **Product mapping** | All 11 sales accounts in `sales_ledger_catalog.json` | Product must match that account’s catalog regex; wrong account for a known SKU → `INVALID_PRODUCT_MAPPING` |
| **Unit rate ±30% (gem)** | Rubies, Emeralds, Pearls, Color stones, Semi precious | Slab = last number in product name; band = slab × 0.70 … slab × 1.30 |
| **Unit rate ±30% (metal)** | 8 rule-book products (Gold Ornaments 14K–Jadau, Customer 18K/22K, Standard 24K, Silver articles) | Band from **Rate Rule Book** entered rate per product (`metal_rate_rule_book.json`) |
| **Mapping only** | Diamonds; Black beads, Dori, Lac, Wax Dori (not in rule book) | Mapping checked; no rate validation |

**Not validated:** PAN, gross weight, GST, tax, amount÷quantity inference, fuzzy matching, `master_sales_rules.xlsx` joins.

## Accounts covered (mapping catalog)

| Sales account | Example products |
| ------------- | ---------------- |
| Gold 14K / 18K / 22K / Jadau / 24K | Gold Ornaments, Standard Gold 24K, Black beads, Wax Dori Etc, … |
| Silver | Silver articles |
| Diamonds | Chakri, Di. RA/RC, Flat polki FP, SD Di., loose diamonds, customer lines |
| Color stones | Precious stones JOS/JSP, loose JOS, Synthetic JSY, Customer Stones |
| Emeralds / Pearls / Rubies | JEM/JPS/JRU numbered SKUs, loose, mix, customer lines |

Full patterns live in `config/sales_ledger_catalog.json` (from the verification sheet).

## Architecture

```text
sales_engine/
  config/
    sales_ledger_catalog.json   Account → product regex (source of truth for mapping)
    mappings.json                 Slab routing, misc patterns, legacy aliases
    gemstone_rules.json           ±30% deviation, gemstone rate families
    metal_rate_rule_book.json     Product → entered rate (8 SKUs) + variation %
  config/loader.py                Cached JSON loaders
  parsers/
    product_category.py           Category, slab family, slab price extraction
    product_family_router.py      Re-exports for compatibility
    metal_rate.py                 Gold/silver account-rate expressions (helpers)
  validators/
    mapping_validator.py          Catalog + cross-account mapping
    gemstone_rate_validator.py    Gemstone slab ±30%
    metal_rate_validator.py       Gold/silver market rate ±30% (combined with gem export cols)
    audit_trace.py                Row-level flags, final issue, audit reason
  engine/
    vectorized_sales_engine.py    Load → enrich → adjudicate → API invalid rows
    reconciliation.py             Input = valid + invalid + dropped
    debug_trace.py                Debug columns / optional CSV
    audit_workbook.py             Multi-sheet debug export
    record_dedup.py               Optional API dedupe (not used on default export path)
```

**Entry point:** `app/processors/sales_audit_processor.py`  
**Compatibility:** `app/engines/vectorized_sales_engine.py`  
**Excel load (immutable row numbers):** `app/engines/vectorized_validation_engine.py`

## Validation flow

1. Upload sales Excel (`.xlsx` / `.xlsm` / `.xls`).
2. Detect header row (title/preamble rows above the table are supported).
3. Set **`__source_row_id`** = physical Excel row (1-based, never regenerated).
4. Normalize text: uppercase, trim, collapse spaces, strip hidden characters.
5. Keep **transaction rows** only: voucher + sales account + product + quantity &gt; 0; skip blanks, subtotals, repair charges, repeated headers.
6. **Canonicalize** sales account via aliases (`Jewel sales account - Diamonds` → `JEWEL SALES ACCOUNT - DIAMONDS`, etc.).
7. **Mapping:** product must match **this** account’s rules in `sales_ledger_catalog.json`.
   - Product matches **another** account’s catalog → `INVALID_PRODUCT_MAPPING` (cross-account).
   - Product matches **no** catalog pattern → `UNKNOWN_PRODUCT` (not a mapping hit).
8. **Rate (gemstones):** extract slab from product name; compare uploaded unit rate to ±30% band.
8b. **Rate (gold/silver):** when normalized product matches a rule-book SKU with a saved rate, compare **invoice unit rate only** to ±30% of that entered rate.
9. Export **one invalid API record per Excel row** (no `group_by`, no dedupe on the default path).
10. Write debug workbook: `app/debug/sales_audit_debug.xlsx` (all rows + trace columns).
11. **Reconciliation** assertion: `input = valid + invalid + dropped` (logged on every run).

## Rate rules (gemstones)

Applies to families in `gemstone_rules.json` → `rate_validation_families`:

**RUBIES, EMERALDS, PEARLS, COLOR_STONES, SEMI_PRECIOUS**

```text
min_allowed = slab × (1 − 30%)
max_allowed = slab × (1 + 30%)
PASS when: min_allowed ≤ uploaded_unit_rate ≤ max_allowed
```

| Situation | Rate behaviour |
| --------- | -------------- |
| Numbered SKU (`Rubies JRU 800`) | Slab from product name; rate checked |
| `Precious stones Loose JOS 3600` | Slab parsed from name; **rate checked** (loose + numeric slab) |
| `LOOSE` with no parseable slab | `SKIPPED` (no rate deviation) |
| `CUSTOMER …` | `SKIPPED` |
| `… MIX` | `SKIPPED` |
| Missing / zero unit rate on slab product | `INVALID_RATE_DEVIATION` (`UNIT_RATE_INVALID`) |
| Slab shape but parse fails | `INVALID_PRODUCT_PATTERN` |

`rateValidationSource` on invalid rows: **`product_slab`**.

## Gold, silver, and diamonds

| Material | Mapping | Unit rate |
| -------- | ------- | --------- |
| **Gold ornaments / Standard Gold** | Per-account catalog | ±30% vs employee market rate when configured |
| **Misc gold** (Black beads, Dori, Lac, Wax Dori, Customer …) | Catalog | **Skipped** (mapping only) |
| **Silver articles** | `Silver articles` | ±30% vs silver market rate |
| **Diamonds** | Full diamond SKU catalog | Mapping only |

### Rate Rule Book (product rates)

Employees enter rates per product in the UI (**Scrutiny → Rate Rule Book**) or via API:

- `GET/POST /api/v1/rate-rules` (Node proxy → Python)
- Payload: `{ "rates": { "Gold Ornaments 22K": 9000, ... } }`
- Persisted to `config/metal_rate_rule_book.json`

Rule-book products only:

1. Gold Ornaments 14K  
2. Gold Ornaments 18K  
3. Customer Gold Ornaments 18K  
4. Customer Gold Ornaments 22K  
5. Gold Ornaments 22K  
6. Gold Ornaments Jadau  
7. Standard Gold 24K  
8. Silver articles  

```text
Example: Gold Ornaments 22K entered rate = 9000
  min = 6300, max = 11700
  invoice unit rate 5800 → INVALID_RATE_DEVIATION
```

`parsers/metal_rate.py` matches `__product_norm` to rule-book keys; `rateValidationSource`: `rule_book_product`.

## Configuration reference

### `sales_ledger_catalog.json`

| Section | Purpose |
| ------- | ------- |
| `sales_account_aliases` | Upload spellings → canonical keys (normalized at load) |
| `account_product_rules` | Per-account regex list for allowed products |

### `mappings.json`

| Section | Purpose |
| ------- | ------- |
| `slab_route_order` / `slab_route_patterns` | Regex to extract slab family + price from product name |
| `misc_product_patterns` | e.g. `Wax, Dori Etc` (mapping via catalog; misc skip in audit trace) |
| `sales_account_aliases` | Merged with catalog aliases at load |

### `gemstone_rules.json`

| Field | Default | Purpose |
| ----- | ------- | ------- |
| `deviation_percent` | 30 | ±30% band |
| `rate_validation_families` | RUBIES, EMERALDS, PEARLS, COLOR_STONES, SEMI_PRECIOUS | Who gets slab rate checks |

## Required upload columns

| Normalized column | Typical Excel header |
| ----------------- | -------------------- |
| `voucher_no` | Voucher No |
| `sales_account` | Sales Account |
| `product` | Product |
| `unit_rate` | Unit Rate |

`quantity` &gt; 0 is required to treat a row as a transaction. Other columns (party name, GST, gross weight, …) are not validated but may appear on invalid-row output.

## Issue codes

| Code | When |
| ---- | ---- |
| `INVALID_PRODUCT_MAPPING` | Known account, product belongs on a **different** account (catalog hit elsewhere) |
| `INVALID_RATE_DEVIATION` | Gemstone (or future metal) rate outside ±30%, or missing unit rate on slab product |
| `INVALID_PRODUCT_PATTERN` | Gemstone-shaped product but slab price could not be parsed |

Internal / non-export statuses: `VALID`, `SKIPPED`, `UNKNOWN_PRODUCT` (see debug `__final_issue`).

Messages (`app/utils/constants.py`):

- *Product does not belong to the selected sales account.*
- *Unit rate is outside the allowed ±30% deviation band.*

## API invalid-row payload

| Field | Description |
| ----- | ----------- |
| `rowNumber` / `sourceExcelRowNumber` | Physical Excel row |
| `originalExcelSalesAccount` / `originalExcelProduct` / `originalExcelUnitRate` | Raw cells at load time |
| `validationSalesAccount` / `validationProduct` | Normalized values used in rules |
| `standardRate` / `masterStandardRate` | Reference slab (from product name for gems) |
| `minAllowedRate` / `maxAllowedRate` | ±30% band |
| `deviationPercent` / `rateDifference` | vs standard |
| `rateValidationSource` | `product_slab` or `skipped` |
| `issues` / `messages` | Codes and text |

## Reconciliation (summary)

Every upload logs:

```text
TOTAL_INPUT_ROWS = TOTAL_VALID_ROWS + TOTAL_INVALID_ROWS + TOTAL_DROPPED_ROWS
```

`summary.reconciliation` and `summary.distinctInvalidRows` match exported invalid counts (row-preserving, no dedupe).

## Examples

**Valid — mapping + rate**

- Account: `JEWELS SALES ACCOUNT - RUBIES`, product: `Rubies JRU 3400`, unit rate: `4000` → within 2380–4420

**Invalid — mapping**

- `Gold Ornaments Jadau` on `GOLD SALES ACCOUNT - 14K` → `INVALID_PRODUCT_MAPPING`
- `Emeralds JEM 500` on `JEWELS SALES ACCOUNT - PEARLS` → `INVALID_PRODUCT_MAPPING`

**Invalid — rate**

- `Rubies JRU 1000`, unit rate `1500` → `INVALID_RATE_DEVIATION`
- `Precious stones Loose JOS 3600`, unit rate `1642` → `INVALID_RATE_DEVIATION` (loose + parsed slab)

**Valid — mapping only (no gem rate)**

- `GOLD SALES ACCOUNT - 22K` + `Black beads` + any unit rate → mapping OK, rate not checked
- `JEWEL SALES ACCOUNT - DIAMONDS` + `Chakri` → mapping OK, rate not checked

**Skipped rate**

- `Customer Rubies`, `Rubies JRU Mix` → mapping may pass; rate skipped

## Performance

- **Default (fast):** `AUDIT_DEBUG_EXPORT=false` — no `sales_audit_debug.xlsx` write on each upload; API returns invalid rows only.
- **Debug (slow):** set `AUDIT_DEBUG_EXPORT=true` or `SALES_DEBUG_EXPORT=true` in `python-service/.env` when tuning rules.

## Performance and debug

- Polars vectorized expressions (no per-row Python validation loops).
- Suitable for **10,000+** rows.
- Log line: `[sales] vectorized validation benchmark …`
- Debug export: **`python-service/app/debug/sales_audit_debug.xlsx`** — filter `__final_issue` to tune rules.

## Tests

```bash
cd python-service
python -m pytest tests/test_sales_audit_processor.py tests/test_sales_ledger_catalog.py tests/test_sales_reconciliation.py -q
```

## Changing rules

Edit JSON under **`app/sales_engine/config/`** and restart the Python service. No code change needed for catalog or slab pattern updates.

## Legacy (not used by this engine)

| Path | Note |
| ---- | ---- |
| `app/data/master_sales_rules.xlsx` | Old hierarchical master |
| `app/data/master_sales_rate_rules.xlsx` | Product-wise rate workbook builder |
| `app/services/master_rule_service.py` | Legacy flattening |
| `app/services/master_sales_rate_rule_service.py` | Legacy rate flattening |

The sales audit path does **not** join these files at runtime.
