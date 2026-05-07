"""Rules + fuzzy paths for product classification."""

from app.utils.product_classifier import (
    classify_product,
    classify_product_direct,
    classify_product_with_detail,
    expected_category_from_sales_account,
)


def test_expected_category_sales_account_order():
    assert expected_category_from_sales_account('Gold Jadau 22k Sales') == 'jadau'
    assert expected_category_from_sales_account('Gold Sales - 22k') == '22k'


def test_rule_14k_direct():
    assert classify_product_direct('Gold Ring 14K') == '14k'
    assert classify_product_direct('14 Carat Chain') == '14k'


def test_rule_18k_direct():
    assert classify_product('18K Gold Ring') == '18k'
    assert classify_product('18 Carat Necklace') == '18k'


def test_rule_22k_accessories():
    assert classify_product('Black Beads') == '22k'
    assert classify_product('Wax Thread') == '22k'
    assert classify_product('Gold Ornament 22K') == '22k'
    assert classify_product('916 Gold Ring') == '22k'


def test_rule_24k():
    assert classify_product('24K Gold Coin') == '24k'
    assert classify_product('999 Gold Bar') == '24k'


def test_rule_jadau_strict():
    assert classify_product('Jadau Necklace') == 'jadau'


def test_fuzzy_typo_examples():
    cat, fuzz = classify_product_with_detail('18 carret ring')
    assert cat == '18k' and fuzz is True

    cat2, fuzz2 = classify_product_with_detail('blak beads')
    assert cat2 == '22k' and fuzz2 is True

    cat3, fuzz3 = classify_product_with_detail('jadau neckless')
    assert cat3 == 'jadau' and fuzz3 is False  # direct hit on "jadau"

    cat4, fuzz4 = classify_product_with_detail('jdau hararm')  # typo, no literal "jadau"
    assert cat4 == 'jadau' and fuzz4 is True


def test_standalone_916_999_not_substring_false_positive():
    assert classify_product_direct('12999 necklace') is None  # embedded 999, not standalone token
    assert classify_product('Coin 999 purity') == '24k'


def test_invalid_product_examples_vs_expected():
    assert classify_product('black beads') == '22k'
