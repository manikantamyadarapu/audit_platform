from io import BytesIO

from openpyxl import Workbook

from app.services.master_rule_service import MasterRuleService
from app.utils.normalization_engine import (
    normalize_blankable_text,
    normalize_strict_text,
    normalize_voucher,
)


def _headered_master_bytes() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(['Enterprise Master Sales Verification'])
    ws.append([])
    ws.append(['Sales Account Type', 'Product', 'Category', 'Status'])
    ws.append(['Gold Sales Account - 22k', 'Black beads', 'Gold', 'Active'])
    ws.append(['Jewel sales account - Diamonds', 'Customer Diamonds', 'Diamonds', 'Active'])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _forward_fill_master_bytes() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(['Enterprise Master Sales Verification'])
    ws.append(['Sales Account Type', 'Product', 'Category', 'Status'])
    ws.append(['Jewels sales account - Rubies', None, 'Rubies', 'Active'])
    ws.append([None, 'Rubies JRU 100', None, None])
    ws.append([None, 'Rubies JRU 1000', None, None])
    ws.append(['Gold Sales Account - 24K', None, 'Gold', 'Active'])
    ws.append([None, 'Standard Gold 24K', None, None])
    ws.append(['Silver sales Account', 'Retired Product', 'Silver', 'Inactive'])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_load_master_sales_rules_returns_workbook_rows() -> None:
    rules = MasterRuleService().load_master_rules()
    assert len(rules) > 0
    rows = rules.to_dicts()
    assert any(
        row['sales_account'] == 'GOLD SALES ACCOUNT - 22K'
        and row['product'] == 'BLACK BEADS'
        for row in rows
    )
    assert any(
        row['sales_account'] == 'JEWELS SALES ACCOUNT - EMERALDS'
        and row['product'] == 'EMERALDS JEM 10500'
        for row in rows
    )
    assert any(
        row['sales_account'] == 'JEWELS SALES ACCOUNT - EMERALDS'
        and row['product'] == 'EMERALDS JEM 12000'
        for row in rows
    )
    assert any(
        row['sales_account'] == 'JEWELS SALES ACCOUNT - RUBIES'
        and row['product'] == 'RUBIES JRU 5300'
        for row in rows
    )
    assert any(
        row['sales_account'] == 'JEWELS SALES ACCOUNT - RUBIES'
        and row['product'] == 'RUBIES JRU 6300'
        for row in rows
    )
    assert any(
        row['sales_account'] == 'JEWELS SALES ACCOUNT - RUBIES'
        and row['product'] == 'RUBIES JRU 11200'
        for row in rows
    )
    assert any(
        row['sales_account'] == 'JEWELS SALES ACCOUNT - PEARLS'
        and row['product'] == 'PEARLS JPS 2900'
        for row in rows
    )
    assert any(
        row['sales_account'] == 'JEWELS SALES ACCOUNT - PEARLS'
        and row['product'] == 'PEARLS JPS 8400'
        for row in rows
    )


def test_master_rule_service_loads_category_and_status() -> None:
    rules = MasterRuleService().load_master_rules()
    row = next(
        item
        for item in rules.to_dicts()
        if item['sales_account'] == 'GOLD SALES ACCOUNT - 22K'
        and item['product'] == 'BLACK BEADS'
    )
    assert row['category'] == 'GOLD'
    assert row['status'] == 'ACTIVE'


def test_master_rule_service_loads_diamond_account_mapping() -> None:
    rules = MasterRuleService().load_master_rules()
    row = next(
        item
        for item in rules.to_dicts()
        if item['sales_account'] == 'JEWEL SALES ACCOUNT - DIAMONDS'
        and item['product'] == 'CUSTOMER DIAMONDS'
    )
    assert row['category'] == 'DIAMONDS'
    assert row['status'] == 'ACTIVE'


def test_master_rule_service_loads_headered_workbook_and_writes_debug_csv(tmp_path) -> None:
    workbook_path = tmp_path / 'master_sales_rules.xlsx'
    workbook_path.write_bytes(_headered_master_bytes())
    debug_path = tmp_path / 'flattened_master_rules.csv'

    rules = MasterRuleService(
        workbook_path=workbook_path, debug_output_path=debug_path
    ).load_master_rules()
    rows = rules.to_dicts()

    assert any(
        row['sales_account'] == 'GOLD SALES ACCOUNT - 22K'
        and row['product'] == 'BLACK BEADS'
        for row in rows
    )
    assert any(
        row['sales_account'] == 'JEWEL SALES ACCOUNT - DIAMONDS'
        and row['product'] == 'CUSTOMER DIAMONDS'
        for row in rows
    )
    assert debug_path.exists()
    debug_text = debug_path.read_text(encoding='utf-8')
    assert 'GOLD SALES ACCOUNT - 22K,BLACK BEADS' in debug_text
    assert 'JEWEL SALES ACCOUNT - DIAMONDS,CUSTOMER DIAMONDS' in debug_text


def test_master_rule_service_forward_fills_parent_account_for_blank_child_rows(tmp_path) -> None:
    workbook_path = tmp_path / 'forward_fill_master.xlsx'
    workbook_path.write_bytes(_forward_fill_master_bytes())
    debug_path = tmp_path / 'flattened_master_rules.csv'

    rules = MasterRuleService(
        workbook_path=workbook_path, debug_output_path=debug_path
    ).load_master_rules()
    rows = rules.to_dicts()

    assert any(
        row['sales_account'] == 'JEWELS SALES ACCOUNT - RUBIES'
        and row['product'] == 'RUBIES JRU 100'
        for row in rows
    )
    assert any(
        row['sales_account'] == 'JEWELS SALES ACCOUNT - RUBIES'
        and row['product'] == 'RUBIES JRU 1000'
        for row in rows
    )
    assert any(
        row['sales_account'] == 'GOLD SALES ACCOUNT - 24K'
        and row['product'] == 'STANDARD GOLD 24K'
        for row in rows
    )
    assert not any(row['product'] is None or row['sales_account'] is None for row in rows)
    assert not any(row['product'] == 'RETIRED PRODUCT' for row in rows)
    debug_text = debug_path.read_text(encoding='utf-8')
    assert 'JEWELS SALES ACCOUNT - RUBIES,RUBIES JRU 100' in debug_text
    assert 'GOLD SALES ACCOUNT - 24K,STANDARD GOLD 24K' in debug_text


def test_master_rule_service_skips_inactive_rows_after_forward_fill(tmp_path) -> None:
    workbook_path = tmp_path / 'forward_fill_master.xlsx'
    workbook_path.write_bytes(_forward_fill_master_bytes())
    rules = MasterRuleService(workbook_path=workbook_path).load_master_rules()
    assert not any(row['product'] == 'RETIRED PRODUCT' for row in rules.to_dicts())


def test_normalize_strict_text_applies_upper_trim_and_hidden_char_cleanup() -> None:
    assert normalize_strict_text('  black\u00a0 beads \ufeff ') == 'BLACK BEADS'


def test_normalize_strict_text_normalizes_separators() -> None:
    assert normalize_strict_text('gold_sales/account|22k') == 'GOLD SALES ACCOUNT 22K'


def test_normalize_strict_text_inserts_space_after_dot_between_letters() -> None:
    assert normalize_strict_text('Di.RA 15') == 'DI. RA 15'
    assert normalize_strict_text('Di.RA.RC 1') == 'DI. RA. RC 1'


def test_normalize_voucher_strips_to_alphanumeric_only() -> None:
    assert normalize_voucher('JH/2526/3707') == 'JH25263707'
    assert normalize_voucher('JH 2526 3707') == 'JH25263707'
    assert normalize_voucher('JH-2526-3707') == 'JH25263707'
    assert normalize_voucher(None) == ''


def test_normalize_blankable_text_returns_none_for_empty_after_cleanup() -> None:
    assert normalize_blankable_text(' \u00a0 ') is None
