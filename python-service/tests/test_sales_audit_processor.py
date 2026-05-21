from io import BytesIO

from openpyxl import Workbook

import pytest

from app.processors.sales_audit_processor import SalesAuditProcessor
from app.utils.sheet_validation_error import SheetValidationError


def _last_numeric_token(product: str) -> float:
    import re

    found = re.findall(r'\d+', product)
    return float(found[-1]) if found else 1.0


def _full_header() -> list[str]:
    base = [
        'SNo',
        'Date',
        'Voucher No',
        'Name of the Party',
        'Sales Account',
        'Other Account',
        'Product',
        'UOM',
        'Quantity',
        'Free Quantity',
        'Unit Rate',
        'Gross Amount',
        'CGST',
        'SGST',
        'IGST',
        'GST Amount',
        'Net Amount',
        'Manual Gross Wt.',
        'Auto Gross Wt.',
    ]
    return base


def _row(
    *,
    voucher: str,
    sales_account: str,
    product: str,
    unit_rate: object = '',
    quantity: object = 1,
    net_amount: object = '',
    party: str = '',
) -> list:
    hdr = _full_header()
    r = dict(zip(hdr, [''] * len(hdr), strict=True))
    r['Voucher No'] = voucher
    r['Name of the Party'] = party
    r['Sales Account'] = sales_account
    r['Product'] = product
    r['Unit Rate'] = unit_rate
    r['Quantity'] = quantity
    r['Net Amount'] = net_amount
    out = []
    for k in hdr:
        out.append(r[k])
    return out


def _wb_bytes(body_rows: list[list], preamble_rows: list[list[str]] | None = None) -> bytes:
    wb = Workbook()
    ws = wb.active
    if preamble_rows:
        for prow in preamble_rows:
            ws.append(prow)
    ws.append(_full_header())
    for row_values in body_rows:
        ws.append(row_values)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_sales_raises_structured_error_when_columns_incomplete():
    wb = Workbook()
    ws = wb.active
    ws.append(['Voucher No', 'Sales Account', 'Product'])
    ws.append(['V1', 'Gold Sales Account - 22k', 'Black beads'])
    buf = BytesIO()
    wb.save(buf)
    proc = SalesAuditProcessor()
    with pytest.raises(SheetValidationError) as ei:
        proc.process(buf.getvalue())
    body = ei.value.to_response()
    assert body['success'] is False
    assert body['error']['code'] == 'MISSING_REQUIRED_COLUMNS'
    assert {'unit_rate'} <= set(body['error']['missingColumns'])
    assert isinstance(body['error']['hints'], list)


def test_sales_detects_delayed_header_row():
    preamble = [['Sales Report - Detail'], ['From: demo']]
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [_row(voucher='V1', sales_account='Gold Sales Account - 22k', product='Black beads', unit_rate=120)],
        preamble_rows=preamble,
    )
    out = proc.process(b)
    assert out['success'] is True
    assert out['totalRows'] == 1
    assert out['errorRows'] == 0


def test_sales_strict_master_match_valid():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [_row(voucher='V1', sales_account='Gold Sales Account - 22k', product='Black beads', unit_rate=120)]
    )
    out = proc.process(b)
    assert out['success'] is True
    assert out['errorRows'] == 0
    assert out['summary']['invalidSalesAccounts'] == 0
    assert out['summary']['invalidProductMappings'] == 0
    assert out['summary']['productsNotFoundInMaster'] == 0
    assert out['summary']['rateDeviationViolations'] == 0
    assert out['summary']['rateMasterNotFound'] == 0


def test_sales_invalid_sales_account():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [_row(voucher='V2', sales_account='Round Off Account', product='Black beads', unit_rate=100)]
    )
    out = proc.process(b)
    assert out['summary']['invalidProductMappings'] == 1
    assert out['records'][0]['issues'] == ['INVALID_PRODUCT_MAPPING']


def test_sales_invalid_product_mapping():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='A',
                sales_account='Gold Sales Account - 22k',
                product='Customer Diamonds',
                unit_rate=100,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 1
    assert out['records'][0]['issues'] == ['INVALID_PRODUCT_MAPPING']


def test_sales_product_not_found_in_master():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(voucher='3', sales_account='Gold Sales Account - 22k', product='Widget X', unit_rate=100),
        ]
    )
    out = proc.process(b)
    # Unrecognized SKUs are UNKNOWN (not in official catalog), not mapping violations.
    assert out['errorRows'] == 0
    assert out['records'] == []


def test_sales_diamond_mapping_valid():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='D1',
                sales_account='Jewel sales account - Diamonds',
                product='Customer Diamonds',
                unit_rate=56,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0


def test_sales_diamond_chakri_master_workbook_mapping_valid():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='D2',
                sales_account='Jewel sales account - Diamonds',
                product='Chakri',
                unit_rate=100,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0
    assert out['summary']['invalidProductMappings'] == 0


def test_sales_emerald_mapping_valid_for_added_master_value():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='E1',
                sales_account='Jewels sales account - Emeralds',
                product='Emeralds JEM 10500',
                unit_rate=10500,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0


@pytest.mark.parametrize(
    'product,unit_rate',
    [
        ('Emeralds JEM 12000', 12000),
        ('Emeralds JEM 14000', 14000),
        ('Emeralds JEM 2100', 2100),
        ('Emeralds JEM 2300', 2300),
        ('Emeralds JEM 2500', 2500),
    ],
)
def test_sales_emerald_jem_master_rows_validate(product: str, unit_rate: float):
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='EJ',
                sales_account='Jewels sales account - Emeralds',
                product=product,
                unit_rate=unit_rate,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0
    assert out['summary']['productsNotFoundInMaster'] == 0


def test_sales_diamond_product_compact_dot_joins_master():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='DD',
                sales_account='Jewel sales account - Diamonds',
                product='Di.RA 15',
                unit_rate=15,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0


def test_sales_ruby_mapping_valid_for_added_master_value():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='R1',
                sales_account='Jewels sales account - Rubies',
                product='Rubies JRU 5300',
                unit_rate=5300,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0


@pytest.mark.parametrize(
    'sales_account,product',
    [
        ('Jewels sales account - Pearls', 'Pearls JPS 2900'),
        ('Jewels sales account - Pearls', 'Pearls JPS 8400'),
        ('Jewels sales account - Pearls', 'Pearls JPS 33000'),
        ('Jewels sales account - Rubies', 'Rubies JRU 6300'),
        ('Jewels sales account - Rubies', 'Rubies JRU 11200'),
        ('Jewels sales account - Rubies', 'Rubies JRU Loose 33500'),
        ('Jewels sales account - Rubies', 'Rubies JRU Mix'),
    ],
)
def test_sales_pearl_ruby_master_skus_validate(sales_account: str, product: str):
    proc = SalesAuditProcessor()
    uploaded = 1.0 if 'Mix' in product else _last_numeric_token(product)
    b = _wb_bytes(
        [_row(voucher='PR', sales_account=sales_account, product=product, unit_rate=uploaded)]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0
    assert out['summary']['productsNotFoundInMaster'] == 0
    assert out['summary']['invalidProductMappings'] == 0


def test_sales_loose_jos_with_slab_flags_rate_deviation():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='LJ1',
                    sales_account='Jewels sales account - Color stones',
                    product='Precious stones Loose JOS 3600',
                    unit_rate=1642.89,
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    assert out['records'][0]['issues'] == ['INVALID_RATE_DEVIATION']


def test_sales_24k_account_normalization_allows_missing_space_after_hyphen():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='G24',
                sales_account='Gold Sales Account -24K',
                product='Standard Gold 24K',
                unit_rate=56,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0


def test_sales_gold_misc_rows_skip_market_rate_check():
    """Black beads / misc gold SKUs are mapping-only even when market rates are configured."""
    from app.sales_engine.services.metal_rate_store import save_rule_book

    save_rule_book({'rates': {'Gold Ornaments 22K': 9000}})
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [_row(voucher='G', sales_account='Gold Sales Account - 22k', product='Black beads', unit_rate=999999)]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0
    assert out['summary']['rateDeviationViolations'] == 0


def test_sales_skips_repair_charge_rows_entirely():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(voucher='RC1', sales_account='Repair Charges', product='Repair Charges', unit_rate=''),
        ]
    )
    out = proc.process(b)
    assert out['totalRows'] == 0
    assert out['errorRows'] == 0


def test_sales_skips_blank_rows_entirely():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(voucher='', sales_account='', product='', unit_rate=''),
            _row(voucher='V1', sales_account='Gold Sales Account - 22k', product='Black beads', unit_rate=120),
        ]
    )
    out = proc.process(b)
    assert out['totalRows'] == 1
    assert out['errorRows'] == 0


def test_sales_strict_normalization_allows_spacing_and_case_noise():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='N1',
                sales_account='  gold   sales  account - 22k  ',
                product='  black\u00a0beads ',
                unit_rate=70,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0


def test_sales_rubies_jru_1000_invalid_rate_deviation():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='RV',
                sales_account='Jewels sales account - Rubies',
                product='Rubies JRU 1000',
                unit_rate=1500,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 1
    assert out['summary']['rateDeviationViolations'] == 1
    rec = out['records'][0]
    assert rec['issues'] == ['INVALID_RATE_DEVIATION']
    assert rec['standardRate'] == 1000
    assert rec['minAllowedRate'] == 700
    assert rec['maxAllowedRate'] == 1300


def test_sales_rubies_jru_1000_valid_rate_within_band():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='RV2',
                sales_account='Jewels sales account - Rubies',
                product='Rubies JRU 1000',
                unit_rate=1200,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0


def test_sales_customer_rubies_skips_rate_verification():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='CR',
                sales_account='Jewels sales account - Rubies',
                product='Customer Rubies',
                unit_rate=999999,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0


def test_sales_gemstone_slab_rate_from_product_name_not_external_workbook():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='RM',
                sales_account='Jewels sales account - Rubies',
                product='Rubies JRU 5300',
                unit_rate=9000,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 1
    assert out['records'][0]['issues'] == ['INVALID_RATE_DEVIATION']
    assert out['records'][0]['standardRate'] == 5300
    assert out['records'][0]['rateValidationSource'] == 'product_slab'


def test_sales_unit_rate_with_letters_yields_null_rate_skips_deviation():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='JH/2526/3707',
                sales_account='Jewels sales account - Rubies',
                product='Rubies JRU 5300',
                unit_rate='JH/2526/3707',
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 1
    assert out['summary']['rateDeviationViolations'] == 1
    assert out['records'][0]['issues'] == ['INVALID_RATE_DEVIATION']


def test_sales_invalid_export_preserves_exact_excel_row_and_cells():
    """rowNumber must be the physical Excel row; product/account from that same row."""
    proc = SalesAuditProcessor()
    preamble = [['Sales Report'], ['FY 2526']]
    b = _wb_bytes(
        [
            _row(
                voucher='V-ROW-5',
                sales_account='Jewels sales account - Emeralds',
                product='Emeralds JEM 5800',
                unit_rate=99999,
                quantity=1,
            ),
        ],
        preamble_rows=preamble,
    )
    out = proc.process(b)
    assert out['errorRows'] >= 1
    rec = next(r for r in out['records'] if r.get('voucherNo') == 'V-ROW-5')
    assert rec['rowNumber'] == 4
    assert rec['sourceExcelRowNumber'] == 4
    assert rec.get('originalExcelProduct') == 'Emeralds JEM 5800'
    assert rec.get('validationProduct') == 'EMERALDS JEM 5800'
    assert rec.get('originalExcelSalesAccount') == 'Jewels sales account - Emeralds'
    assert rec.get('originalExcelUnitRate') in ('99999', 99999.0, 99999)


def test_sales_invalid_row_includes_party_name():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='JH/2526/707',
                party='Mrs. Demo Customer',
                sales_account='Jewels sales account - Rubies',
                product='Rubies JRU 1000',
                unit_rate=1500,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 1
    assert out['records'][0]['partyName'] == 'Mrs. Demo Customer'


def test_sales_invalid_row_includes_row_id_and_voucher_norm():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='JH/2526/3707',
                sales_account='Jewels sales account - Rubies',
                product='Rubies JRU 1000',
                unit_rate=1500,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 1
    rec = out['records'][0]
    assert rec['voucherNorm'] == 'JH25263707'
    assert rec['voucherNo'] == 'JH/2526/3707'
    assert rec['rowId'] == rec['rowNumber']


def test_sales_skips_subtotal_voucher_only_and_narration_rows():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(voucher='JH/2526/11', sales_account='', product='', unit_rate='', quantity=''),
            _row(
                voucher='JH/S/2526/4',
                sales_account='Jewels sales account - Rubies',
                product='SUBTOTAL',
                unit_rate=1,
                quantity=1,
            ),
            _row(voucher='VOK', sales_account='Gold Sales Account - 22k', product='Black beads', unit_rate=120),
        ]
    )
    out = proc.process(b)
    assert out['totalRows'] == 1
    assert out['errorRows'] == 0


def test_sales_skips_rate_when_unit_rate_cell_empty():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='JH/2526/707',
                sales_account='Jewels sales account - Rubies',
                product='Rubies JRU 100',
                unit_rate='',
                quantity=2,
                net_amount=200,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 1
    assert out['summary']['rateDeviationViolations'] == 1
    assert out['records'][0]['issues'] == ['INVALID_RATE_DEVIATION']


@pytest.mark.parametrize(
    'voucher,product,unit_rate,sales_account',
    [
        ('JH/2526/620', 'Emeralds JEM 5800', 5800, 'Jewels sales account - Emeralds'),
        ('JH/2526/571', 'Emeralds JEM 700', 700, 'Jewels sales account - Emeralds'),
        ('JH/2526/571', 'Emeralds JEM 7000', 7000, 'Jewels sales account - Emeralds'),
        ('JH/2526/795', 'Pearls JPS 2000', 2000, 'Jewels sales account - Pearls'),
        ('JH/2526/100', 'Precious Stones JOS 100', 100, 'Jewels sales account - Color stones'),
        ('JH/2526/707', 'Rubies JRU 100', 100, 'Jewels sales account - Rubies'),
        ('JH/2526/5500', 'Rubies JRU 5500', 5500, 'Jewels sales account - Rubies'),
    ],
)
def test_sales_jewel_skus_pass_when_uploaded_unit_rate_matches_master(
    voucher: str, product: str, unit_rate: float, sales_account: str
):
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher=voucher,
                sales_account=sales_account,
                product=product,
                unit_rate=unit_rate,
                quantity=1,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 0
    assert out['summary']['rateDeviationViolations'] == 0


def test_sales_rate_invalid_when_uploaded_unit_rate_outside_master_band():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='JH/2526/620',
                sales_account='Jewels sales account - Emeralds',
                product='Emeralds JEM 5800',
                unit_rate=11600,
                quantity=2,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 1
    assert out['summary']['rateDeviationViolations'] == 1
    rec = out['records'][0]
    assert rec['issues'] == ['INVALID_RATE_DEVIATION']
    assert rec['masterStandardRate'] == 5800
    assert rec['uploadedUnitRate'] == 11600
    assert rec['rateValidationSource'] == 'product_slab'


def test_sales_enterprise_rate_examples_from_spec():
    proc = SalesAuditProcessor()
    cases = [
        ('Jewels sales account - Emeralds', 'Emeralds JEM 4400', 9103.54),
        ('Jewels sales account - Rubies', 'Rubies JRU 14500', 3401.67),
        ('Jewels sales account - Pearls', 'Pearls JPS 200', 66.89),
    ]
    for account, product, rate in cases:
        out = proc.process(_wb_bytes([_row(voucher='ENT', sales_account=account, product=product, unit_rate=rate)]))
        assert out['errorRows'] == 1, (account, product, rate)
        assert out['records'][0]['issues'] == ['INVALID_RATE_DEVIATION']


def test_sales_dedupe_merges_duplicate_row_numbers_in_api_output():
    from app.sales_engine.engine.record_dedup import dedupe_invalid_records_by_row_number

    records = [
        {
            'rowNumber': 29,
            'issues': ['INVALID_PRODUCT_MAPPING'],
            'messages': ['Product does not belong to the selected sales account.'],
            'auditStatus': 'INVALID_PRODUCT_MAPPING',
        },
        {
            'rowNumber': 29,
            'issues': ['INVALID_RATE_DEVIATION'],
            'messages': ['Unit rate below allowed range.'],
            'auditStatus': 'INVALID_RATE_DEVIATION',
        },
    ]
    merged, count = dedupe_invalid_records_by_row_number(records)
    assert count == 1
    assert len(merged) == 1
    assert set(merged[0]['issues']) == {'INVALID_PRODUCT_MAPPING', 'INVALID_RATE_DEVIATION'}


def test_sales_invalid_records_one_per_excel_row_when_pipeline_duplicates():
    """Duplicate adjudicated rows for the same Excel line must merge to one API record."""
    import polars as pl

    from app.sales_engine.engine.vectorized_sales_engine import VectorizedSalesEngine

    engine = VectorizedSalesEngine()
    duplicate = pl.DataFrame(
        {
            '__source_row_id': [29, 29],
            '__source_excel_row_number': [29, 29],
            '__voucher_display': ['V-29', 'V-29'],
            '__voucher_norm': ['V29', 'V29'],
            '__party_display': ['', ''],
            '__original_excel_sales_account': ['Gold Sales Account - 22k'] * 2,
            '__original_excel_product': ['Rubies JRU 900'] * 2,
            '__original_excel_unit_rate': ['900', '900'],
            '__sales_account_text': ['GOLD SALES ACCOUNT - 22K'] * 2,
            '__product_text': ['RUBIES JRU 900'] * 2,
            '__uploaded_unit_rate': [900.0, 900.0],
            '__extracted_master_price': [900.0, 900.0],
            '__min_allowed_rate': [630.0, 630.0],
            '__max_allowed_rate': [1170.0, 1170.0],
            '__rate_validation_source': ['skipped', 'skipped'],
            '__parsed_quantity': [1.0, 1.0],
            '__unit_rate_raw': ['900', '900'],
            '__raw_excel_row_json': ['{}', '{}'],
            '__audit_status': ['INVALID_PRODUCT_MAPPING', 'INVALID_PRODUCT_MAPPING'],
            '__audit_reason': ['ACCOUNT_PRODUCT_MISMATCH', 'ACCOUNT_PRODUCT_MISMATCH'],
            '__invalid_product_mapping': [True, True],
            '__invalid_rate_deviation': [False, False],
        }
    )
    records = engine._records_from_invalid_frame(duplicate)
    assert len(records) == 1
    assert records[0]['rowNumber'] == 29
    assert records[0]['issues'] == ['INVALID_PRODUCT_MAPPING']


def test_sales_same_voucher_different_rows_are_not_merged():
    from app.sales_engine.engine.record_dedup import dedupe_invalid_records_by_row_number

    records = [
        {
            'rowNumber': 10,
            'voucherNo': 'INV-100',
            'product': 'Gold Ornaments 22K',
            'unitRate': 9000,
            'issues': ['INVALID_RATE_DEVIATION'],
        },
        {
            'rowNumber': 11,
            'voucherNo': 'INV-100',
            'product': 'Silver articles',
            'unitRate': 120,
            'issues': ['INVALID_RATE_DEVIATION'],
        },
    ]
    merged, count = dedupe_invalid_records_by_row_number(records)
    assert count == 2
    assert {r['rowNumber'] for r in merged} == {10, 11}


def test_sales_audit_trace_skipped_and_unknown_categories():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='SK1',
                    sales_account='Gold Sales Account - 22k',
                    product='Customer Gold Ornaments 22K',
                    unit_rate=99999,
                ),
                _row(
                    voucher='SK2',
                    sales_account='Jewels sales account - Rubies',
                    product='Rubies JRU Mixn',
                    unit_rate=100,
                ),
            ]
        )
    )
    assert out['totalRows'] == 2
    assert out['errorRows'] == 0


@pytest.mark.parametrize(
    'sales_account,product,unit_rate,expected_issues',
    [
        (
            'Jewels sales account - Rubies',
            'Emeralds JEM 500',
            500,
            ['INVALID_PRODUCT_MAPPING'],
        ),
        (
            'Gold Sales Account - 22k',
            'Rubies JRU 900',
            900,
            ['INVALID_PRODUCT_MAPPING'],
        ),
        (
            'Jewels sales account - Pearls',
            'Black beads',
            100,
            ['INVALID_PRODUCT_MAPPING'],
        ),
        (
            'Silver Sales Account',
            'Pearls JPS 2900',
            2900,
            ['INVALID_PRODUCT_MAPPING'],
        ),
    ],
)
def test_sales_strict_family_routing_invalid_mappings(
    sales_account: str, product: str, unit_rate: float, expected_issues: list[str]
):
    proc = SalesAuditProcessor()
    b = _wb_bytes([_row(voucher='FAM', sales_account=sales_account, product=product, unit_rate=unit_rate)])
    out = proc.process(b)
    assert out['errorRows'] == 1
    assert out['records'][0]['issues'] == expected_issues


def test_sales_rubies_jru_3400_rate_deviation_1358():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='RD',
                sales_account='Jewels sales account - Rubies',
                product='Rubies JRU 3400',
                unit_rate=1358.75,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 1
    assert out['records'][0]['issues'] == ['INVALID_RATE_DEVIATION']
    assert out['records'][0]['standardRate'] == 3400
    assert out['records'][0]['minAllowedRate'] == 2380
    assert out['records'][0]['maxAllowedRate'] == 4420


def test_sales_pearls_jps_2000_rate_deviation_4416():
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [
            _row(
                voucher='PD',
                sales_account='Jewels sales account - Pearls',
                product='Pearls JPS 2000',
                unit_rate=4416.03,
            )
        ]
    )
    out = proc.process(b)
    assert out['errorRows'] == 1
    assert out['records'][0]['issues'] == ['INVALID_RATE_DEVIATION']
    assert out['records'][0]['standardRate'] == 2000
    assert out['records'][0]['minAllowedRate'] == 1400
    assert out['records'][0]['maxAllowedRate'] == 2600

