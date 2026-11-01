"""Rebuild three-branch Financials workbooks from the latest held uploads."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook

from app.engines.financials_engine.engine.audit import FinancialsPivotAudit
from app.engines.financials_engine.engine.closing_stock_template import (
    build_closing_stock_template_bytes,
)
from app.engines.financials_engine.engine.financials_export import prepare_branch_export_layout
from app.engines.financials_engine.engine.jubilee_hills_placement import apply_jubilee_hills_placement
from app.engines.financials_engine.engine.jubilee_hills_template import (
    build_jubilee_hills_workbook_bytes,
)

HELD = Path(__file__).resolve().parents[2] / 'backend' / 'storage' / 'held-financials' / '1'
OUT = Path.home() / 'Downloads'
PREVIOUS_MAPPED = {
    'basheerbagh': OUT / 'Closing-Stock-Jewels (14).xlsx',
    'kokapet': OUT / 'Closing-Stock-Jewels (12).xlsx',
    'jubileeHills': OUT / 'Jubilee-Hills-Financials (2).xlsx',
}
SHEETS = (
    'Diamond',
    'Emerald',
    'Pearls',
    'Rubie',
    'Precious and Semi Precious',
)


def _latest(branch: str, slot: str) -> Path:
    files = list((HELD / branch / slot).glob('*.xlsx'))
    if not files:
        raise FileNotFoundError(f'No held file for {branch}/{slot}')
    return max(files, key=lambda path: path.stat().st_mtime)


def _read(branch: str, slot: str) -> tuple[str, bytes]:
    path = _latest(branch, slot)
    return path.name, path.read_bytes()


def _load_previous_openings(path: Path) -> dict[tuple[str, str], tuple[float | None, float | None]]:
    wb = load_workbook(path, data_only=True, read_only=True)
    openings: dict[tuple[str, str], tuple[float | None, float | None]] = {}
    for sheet in SHEETS:
        if sheet not in wb.sheetnames:
            continue
        for row in wb[sheet].iter_rows(min_row=10, max_col=3, values_only=True):
            label = str(row[0] or '').strip()
            if not label or label.upper() in {'TOTAL', 'GRAND TOTAL'} or label.endswith('TOTAL'):
                continue
            qty, amt = row[1], row[2]
            if qty is None and amt is None:
                continue
            openings[(sheet, label)] = (qty, amt)
    wb.close()
    return openings


def _overlay_previous_openings(result: dict, openings: dict[tuple[str, str], tuple]) -> int:
    applied = 0
    layouts = result.get('layoutByCategory') or {}
    for sheet, rows in layouts.items():
        for row in rows or []:
            if str(row.get('kind') or '') != 'product':
                continue
            label = str(row.get('label') or '').strip()
            found = openings.get((sheet, label))
            if not found:
                continue
            qty, amt = found
            if qty is not None:
                row['openingQty'] = qty
            if amt is not None:
                row['openingAmt'] = amt
            applied += 1
    pivot = list(result.get('openingPivot') or [])
    by_name = {str(item.get('product') or '').strip(): item for item in pivot}
    for (_sheet, label), (qty, amt) in openings.items():
        row = by_name.get(label)
        if row is None:
            row = {'product': label}
            pivot.append(row)
            by_name[label] = row
        if qty is not None:
            row['sumOfQuantity'] = qty
            row['openingQty'] = qty
        if amt is not None:
            row['sumOfGross'] = amt
            row['openingAmt'] = amt
    result['openingPivot'] = pivot
    return applied


def _pending_count(result: dict) -> int:
    report = result.get('openingStockReport') or result.get('openingAmountMatch') or {}
    if isinstance(report, dict):
        return int(
            report.get('manualMappingRequiredCount')
            or report.get('manualMappingRequired')
            or report.get('unresolvedProductCount')
            or 0
        )
    return 0


def _grand_totals(layout_by_category: dict) -> dict[str, dict[str, float | None]]:
    totals = {}
    for category, rows in (layout_by_category or {}).items():
        grand = next((row for row in rows or [] if row.get('kind') == 'grand_total'), None)
        if not grand:
            continue
        totals[category] = {
            'totalQty': grand.get('totalQty'),
            'totalAmt': grand.get('totalAmt'),
            'issuesTotalQty': grand.get('issuesTotalQty'),
            'issuesTotalAmt': grand.get('issuesTotalAmt'),
            'closingStockQty': grand.get('closingStockQty'),
            'closingStockAmt': grand.get('closingStockAmt'),
            'grossProfitAmt': grand.get('grossProfitAmt'),
        }
    return totals


def main() -> None:
    audit = FinancialsPivotAudit()
    branches: dict[str, dict] = {}

    for dest in ('basheerbagh', 'kokapet'):
        sales_name, sales = _read(dest, 'sales')
        purch_name, purch = _read(dest, 'purchases')
        qty_name, qty = _read(dest, 'quantity')
        prev_name, prev = _read(dest, 'previousYear')
        mr_name, mr = _read(dest, 'mr')
        dc_name, dc = _read(dest, 'dc')
        print(f'Processing {dest}...')
        result = audit.process(
            sales_name,
            sales,
            purch_name,
            purch,
            opening_qty_file_name=qty_name,
            opening_qty_bytes=qty,
            previous_year_file_name=prev_name,
            previous_year_bytes=prev,
            mr_file_name=mr_name,
            mr_bytes=mr,
            dc_file_name=dc_name,
            dc_bytes=dc,
            destination_branch=dest,
        )
        applied = _overlay_previous_openings(result, _load_previous_openings(PREVIOUS_MAPPED[dest]))
        branches[dest] = result
        print(
            f'  displayed={result.get("summary", {}).get("productsDisplayed")} '
            f'pending_opening={_pending_count(result)} overlay={applied}'
        )

    print('Processing jubileeHills...')
    sales_name, sales = _read('jubilee-hills', 'sales')
    purch_name, purch = _read('jubilee-hills', 'purchases')
    qty_name, qty = _read('jubilee-hills', 'quantity')
    prev_name, prev = _read('jubilee-hills', 'previousYear')
    sr_name, sr = _read('jubilee-hills', 'salesReturn')
    pr_name, pr = _read('jubilee-hills', 'purchaseReturn')
    cn_name, cn = _read('jubilee-hills', 'creditNote')
    dn_name, dn = _read('jubilee-hills', 'debitNote')
    mr_name, mr = _read('jubilee-hills', 'mr')
    dc_name, dc = _read('jubilee-hills', 'dc')
    jh = audit.process_jubilee_hills(
        sales_name,
        sales,
        purch_name,
        purch,
        opening_qty_file_name=qty_name,
        opening_qty_bytes=qty,
        previous_year_file_name=prev_name,
        previous_year_bytes=prev,
        sales_return_file_name=sr_name,
        sales_return_bytes=sr,
        purchase_return_file_name=pr_name,
        purchase_return_bytes=pr,
        credit_note_file_name=cn_name,
        credit_note_bytes=cn,
        debit_note_file_name=dn_name,
        debit_note_bytes=dn,
        mr_file_name=mr_name,
        mr_bytes=mr,
        dc_file_name=dc_name,
        dc_bytes=dc,
    )
    jh = apply_jubilee_hills_placement(jh)
    applied = _overlay_previous_openings(jh, _load_previous_openings(PREVIOUS_MAPPED['jubileeHills']))
    branches['jubileeHills'] = jh
    print(
        f'  displayed={jh.get("summary", {}).get("productsDisplayed")} '
        f'pending_opening={_pending_count(jh)} overlay={applied}'
    )

    keys = ('basheerbagh', 'kokapet', 'jubileeHills')
    prepared: dict[str, dict] = {}
    rates = {key: branches[key].get('productAverageRates') or [] for key in keys}
    complete = {key: True for key in keys}

    for _pass in range(2):
        for dest in keys:
            sources = {key: branches[key].get('layoutByCategory') for key in keys if key != dest}
            prepared[dest] = prepare_branch_export_layout(
                destination=dest,
                layout_by_category=branches[dest].get('layoutByCategory'),
                sales_pivot=branches[dest].get('salesPivot'),
                purchases_pivot=branches[dest].get('purchasesPivot'),
                opening_pivot=branches[dest].get('openingPivot'),
                mr_pivots=branches[dest].get('mrPivots')
                or (branches[dest].get('transferPivots') or {}).get('mrPivots'),
                dc_pivots=branches[dest].get('dcPivots')
                or (branches[dest].get('transferPivots') or {}).get('dcPivots'),
                source_average_rates=rates,
                source_issue_layouts=sources,
                source_opening_complete=complete,
                branch_kind='jubilee' if dest == 'jubileeHills' else 'closing',
            )
            rates[dest] = prepared[dest].get('productAverageRates') or rates[dest]
            branches[dest]['layoutByCategory'] = prepared[dest]['layoutByCategory']
            branches[dest]['productAverageRates'] = rates[dest]

    stamp = datetime.now().strftime('%Y%m%d-%H%M')
    outputs = {
        'basheerbagh': OUT / f'Basheerbagh-Closing-Stock-Jewels-{stamp}.xlsx',
        'kokapet': OUT / f'Kokapet-Closing-Stock-Jewels-{stamp}.xlsx',
        'jubileeHills': OUT / f'Jubilee-Hills-Financials-{stamp}.xlsx',
    }

    for dest, path in outputs.items():
        result = branches[dest]
        mr_pivots = result.get('mrPivots') or (result.get('transferPivots') or {}).get('mrPivots')
        dc_pivots = result.get('dcPivots') or (result.get('transferPivots') or {}).get('dcPivots')
        if dest == 'jubileeHills':
            raw = build_jubilee_hills_workbook_bytes(
                layout_by_category=prepared[dest]['layoutByCategory'],
                sales_pivot=result.get('salesPivot'),
                purchases_pivot=result.get('purchasesPivot'),
                opening_pivot=result.get('openingPivot'),
                mr_pivots=mr_pivots,
                dc_pivots=dc_pivots,
            )
        else:
            raw = build_closing_stock_template_bytes(
                products_by_category=prepared[dest]['productsByCategory'],
                layout_by_category=prepared[dest]['layoutByCategory'],
                sales_pivot=result.get('salesPivot'),
                purchases_pivot=result.get('purchasesPivot'),
                opening_pivot=result.get('openingPivot'),
                mr_pivots=mr_pivots,
                dc_pivots=dc_pivots,
            )
        path.write_bytes(raw)
        print(f'WROTE {path} ({len(raw)} bytes)')
        print('  GRAND TOTALS', _grand_totals(prepared[dest]['layoutByCategory']))
        print('  receiptAmountReview', len(prepared[dest].get('receiptAmountReview') or []))


if __name__ == '__main__':
    main()
