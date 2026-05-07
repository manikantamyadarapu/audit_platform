import pytest

from app.utils.product_classifier import classify_product_cached, expected_category_from_sales_account


@pytest.fixture(autouse=True)
def clear_classifier_lru_between_tests() -> None:
    classify_product_cached.cache_clear()
    expected_category_from_sales_account.cache_clear()
    yield
    classify_product_cached.cache_clear()
    expected_category_from_sales_account.cache_clear()
