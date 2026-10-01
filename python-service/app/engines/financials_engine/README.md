# Financials — Stock Reconciliation

Stock Reconciliation builds a jewels closing-stock working paper from six Excel files. The Python engine does the math. The Node backend authenticates the request, proxies the files, and stores one audit-run summary. The UI lives at `/financials/closing-stock`.

## Inputs

All six files are required on `POST /api/v1/process/financials/validate`.

| File | What it is | Columns used |
|------|------------|----------------|
| Sales | Current-year sales register | Product, Quantity, Gross Amount |
| Purchases | Current-year purchase register | Product, Quantity, Gross Amount |
| Opening Quantity | Opening qty by product (qty is the authority) | Product + opening balance qty |
| Previous Year Closing | Last year's closing workbook (amounts come from here) | Product sheets, category tabs, Trading sheet |
| MR | Material receipt / inward transfer | Product, Quantity, Gross Amount, Branch |
| DC | Delivery challan / outward transfer | Product, Quantity, Gross Amount, Branch |

Headers are matched by name, not by column letter. Extra title rows above the table are skipped (scan limit 80 rows).

## Pipeline

```
Sales + Purchases
        │  group by product, SUM(qty), SUM(gross)
        ▼
Opening Quantity  +  Previous Year Closing
        │  qty from quantity file, amount from last year's closing
        ▼
MR + DC
        │  classify branch → location pivot
        │  net per product per location
        ▼
Closing Stock Rule Book (JSON master list)
        │  LEFT JOIN every rule-book product to those pivots
        │  compute totals, average rate, issues, closing, gross profit
        ▼
Excel working paper
   one sheet per jewel category + a Gold/Silver Trading sheet
```

Orchestration: `engine/audit.py` (`FinancialsPivotAudit.process`).
Layout and formulas: `config/product_rule_book.py`.
Excel: `engine/closing_stock_template.py` and `engine/trading_template.py`.

## 1. Sales and Purchases pivots

`engine/calculator.py` groups rows by the product text as it first appears. Blank product names are dropped. Each product becomes one row:

- `sumOfQuantity` = SUM(Quantity)
- `sumOfGross` = SUM(Gross Amount)

Both are rounded to 4 decimals. Sales and Purchases are never mixed.

## 2. Opening stock

Opening stock is two files joined in `engine/opening_stock.py`.

- **Opening Qty** comes only from the Opening Quantity file.
- **Opening Amount** comes from the previous-year closing amount for that product.

Match order:

1. **Exact name** against the previous-year product index (normalized, case-insensitive).
2. **Subcategory fallback** (`engine/opening_stock_fallback.py`) when the name changed, was combined, or only matches inside the same rule-book subcategory (including rose-cut number matching and metal groups).
3. **Gold / Silver** uses the previous-year Trading sheet closing stock when that sheet is present.

Statuses written on each opening row:

| Status | Meaning |
|--------|---------|
| `matched` | Exact previous-year product, amount filled |
| `matched_fallback` | Amount taken from a renamed or combined previous-year product |
| `quantity_mismatch` | A candidate was found, but previous closing qty does not equal this year's opening qty. Amount is left blank |
| `manual_mapping_required` | More than one plausible previous-year product. Amount is left blank |
| `unmatched` | No previous-year product. Qty is kept, amount is blank |

## 3. MR and DC (receipts and issues)

`engine/mr_dc_pivots.py` classifies each row by Branch, then Party, into one location:

| Location key | Aliases |
|--------------|---------|
| `jubileeHills` | jubilee hills, jubilee, jh |
| `kokapet` | kokapet |
| `internalBasheerbagh` | internal, basheerbagh, ist, internal stock transfer |

Rows that match none of those stay unclassified. They are counted and sampled (up to 50) but they do not enter a pivot. MR and DC stay in separate trees. They are never added together at this step.

`engine/mr_dc_closing_qty.py` then nets them **per location, per product**, and only if the product name matches a rule-book product exactly (normalized):

```
Net = SUM(MR qty) − SUM(DC qty)
Net > 0  → Receipts qty for that location
Net < 0  → Issues qty = |Net| for that location
Net = 0  → neither column
```

Location → working-paper columns:

| Location | Receipts column | Issues column |
|----------|-----------------|---------------|
| Jubilee Hills | Receipts Jubilee Hills | Issues Banjara Hills |
| Kokapet | Receipts Kokapet | Issues Kokapet |
| Internal / Basheerbagh | Receipts Internal | Issues Internal |

Only quantity is taken from MR/DC. Issue amounts are calculated later from average rate. Receipt amounts stay empty.

## 4. Rule book

`config/closing_stock_product_rule_book.json` is the master product list. Display names on the working paper always come from this file, not from the uploaded Excel.

Jewel sheets:

- Diamond (has subcategories)
- Emerald
- Pearls
- Rubie
- Precious and Semi Precious (has subcategories)

A pivot product is joined to a rule-book name in this order (`_build_rule_book_match_lookup`):

1. Normalized full name (`"Flat polki FP1"`)
2. Alphanumeric-only key (`flatpolkifp1` also matches `Flatpolki FP 1`)
3. Core SKU (trailing code such as `fp1`, `jps1000`) when that code is unique in the book

Every rule-book product is written even when sales, purchases, opening, and transfers are all blank. Pivot products that match nothing are returned as unmapped and are not placed on a sheet.

## 5. Closing-stock formulas

Computed per product in `_add_stock_section_totals` and the helpers under it. Missing pieces count as 0 once any sibling in that sum is present. If every input in a sum is missing, the result stays blank.

```
Receipts Qty     = Internal + Jubilee Hills + Kokapet
Total Qty        = Opening Qty + Purchases Qty + Receipts Qty
Total Amt        = Opening Amt + Purchases Amt + Receipts Amt
Average Rate     = Total Amt / Total Qty     (qty 0 → rate 0)
Issue Amt        = Issue Qty × Average Rate  (per Internal, Banjara Hills, Kokapet)
Issues Total Qty = Internal + Banjara Hills + Kokapet
Issues Total Amt = sum of those issue amounts
Closing Qty      = Total Qty − Sales Qty − Issues Total Qty
Closing Amt      = Closing Qty × Average Rate
Gross Profit Amt = Closing Amt + Sales Amt + Issues Total Amt − Total Amt
Gross Profit %   = GP Amt / Sales Amt when GP Amt > 0 and Sales Amt ≠ 0, else 0
```

Rounding:

- Product **amounts** are rounded for display. Product **quantities** stay exact.
- A TOTAL or GRAND TOTAL amount is `ROUND(SUM(unrounded product amounts))`, not the sum of already-rounded cells.
- TOTAL average rate is recomputed as Total Amt / Total Qty. Rates are never summed.

## 6. Gold and Silver trading sheet

Jewels use the formulas above. Gold and Silver use `engine/metal_trading.py` and are written on the Trading sheet.

```
From Head Office qty = Receipts Jubilee Hills − Issues Banjara Hills   (only if > 0)
To Head Office qty   = Issues Banjara Hills − Receipts Jubilee Hills   (only if > 0)

Closing Qty = Opening
            + Purchase difference
            + From Head Office
            + Making charges
            + GP qty
            − Sales difference
            − To Head Office

Closing Amt = Closing Qty × net average rate
GP Amt      = (Sales + Closing) Amt − (Opening + Purchase difference + Making) Amt
```

## Outputs

`POST /financials/validate` returns JSON:

- `salesPivot`, `purchasesPivot`, `openingPivot`
- `mrPivots` / `dcPivots` (three location lists each)
- opening-stock report counts (exact, fallback, unmatched, qty mismatch, manual mapping)
- MR/DC classification counts and a sample of unclassified rows
- unmapped product names

Follow-up calls, using that JSON (no re-upload):

| Call | Result |
|------|--------|
| `POST /financials/export-pivots` | Sales + Purchases pivot workbook |
| `POST /financials/export-closing-stock` | Working paper (category sheets + Trading) |
| `POST /financials/remap-closing-stock` | Same paper after a manual product remap |
| `GET /financials/closing-stock-rule-book` | Current rule book plus a content fingerprint |

Node stores one `audit_runs` row for the validate call (`uploaded_by`, file names, row counts, issue summary). It does not store every pivot row or the generated workbook.

## Code map

| Piece | File |
|-------|------|
| HTTP routes | `app/routers/financials_router.py` |
| Orchestration | `engine/audit.py` |
| Sales/Purchases pivot | `engine/calculator.py` |
| Workbook header detection | `parsers/workbook_loader.py` |
| Opening qty + previous year | `parsers/opening_stock_loader.py`, `engine/opening_stock.py` |
| Renamed / combined opening | `engine/opening_stock_fallback.py` |
| MR/DC load + location | `parsers/mr_dc_loader.py`, `engine/mr_dc_pivots.py` |
| MR/DC net → receipts/issues | `engine/mr_dc_closing_qty.py` |
| Rule book + formulas | `config/product_rule_book.py`, `config/closing_stock_product_rule_book.json` |
| Jewel Excel | `engine/closing_stock_template.py` |
| Gold/Silver Excel | `engine/metal_trading.py`, `engine/trading_template.py` |
| Abstract sheet | `engine/abstract_template.py`, `engine/abstract_values.py` |
| Node proxy + audit history | `backend/src/routes/financials.routes.js`, `backend/src/services/financials.service.js` |
