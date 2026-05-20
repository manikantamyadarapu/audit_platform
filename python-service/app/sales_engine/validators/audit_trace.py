from __future__ import annotations

import polars as pl

from app.sales_engine.config.loader import misc_product_patterns, rate_validation_families


def _misc_product_expr(product_col: str = '__product_norm') -> pl.Expr:
    match = pl.lit(False)
    for pattern in misc_product_patterns():
        match = match | pl.col(product_col).str.contains(f'(?i){pattern}')
    return match.alias('__is_misc_product')


def audit_flag_columns(*, product_col: str = '__product_norm') -> list[pl.Expr]:
    product = pl.col(product_col)
    return [
        product.str.contains('(?i)CUSTOMER').alias('__has_customer'),
        product.str.contains('(?i)LOOSE').alias('__has_loose'),
        product.str.contains('(?i)MIX').alias('__has_mix'),
        _misc_product_expr(product_col),
    ]


def audit_trace_columns() -> list[pl.Expr]:
    """Row-preserving audit flags; never drop rows — classify via __final_issue / __drop_reason."""
    is_txn = (
        pl.col('__is_transaction_row').fill_null(False)
        & ~pl.col('__is_blank_row').fill_null(False)
        & ~pl.col('__is_repeated_header').fill_null(False)
    )
    mapping_ok = pl.col('__mapping_valid')
    slab_family = pl.col('__slab_family')
    rate_invalid = pl.col('__rate_invalid_raw').fill_null(False)
    has_slab = slab_family.is_not_null()
    rate_family = slab_family.is_in(list(rate_validation_families()))
    gem_shape = pl.col('__gem_slab_shape').fill_null(False)
    unit_rate_ok = pl.col('__uploaded_unit_rate').is_not_null() & (pl.col('__uploaded_unit_rate') > 0)
    unit_rate_missing = pl.col('__uploaded_unit_rate').is_null() | (pl.col('__uploaded_unit_rate') <= 0)

    rate_expected = is_txn & mapping_ok & rate_family
    price_parse_failed = rate_expected & gem_shape & ~has_slab
    # Loose rows with an extracted slab (e.g. Precious stones Loose JOS 3600) still get ±30% checks.
    loose_slab_rate_check = pl.col('__has_loose') & pl.col('__extracted_master_price').is_not_null()
    rate_deviation_applies = ~pl.col('__has_mix') & (~pl.col('__has_loose') | loose_slab_rate_check)

    invalid_mapping = is_txn & ~mapping_ok
    invalid_pattern = is_txn & mapping_ok & price_parse_failed
    metal_applies = pl.col('__metal_rate_applies').fill_null(False)
    metal_rate_no_unit = is_txn & mapping_ok & metal_applies & unit_rate_missing
    invalid_rate = is_txn & mapping_ok & rate_invalid.fill_null(False) & rate_deviation_applies
    invalid_rate_no_unit = (
        is_txn
        & mapping_ok
        & rate_family
        & has_slab
        & unit_rate_missing
        & rate_deviation_applies
    )
    invalid_rate_no_unit = invalid_rate_no_unit | metal_rate_no_unit
    invalid_rate_flag = (invalid_rate | invalid_rate_no_unit).fill_null(False)

    unknown_mix = is_txn & pl.col('__has_mix') & slab_family.is_null()
    unknown_pattern = (
        is_txn
        & mapping_ok
        & slab_family.is_null()
        & ~gem_shape
        & ~pl.col('__has_customer')
        & ~pl.col('__has_loose')
        & ~pl.col('__is_misc_product')
        & ~pl.col('__has_mix')
    )

    skipped_loose = (
        is_txn
        & mapping_ok
        & pl.col('__has_loose')
        & pl.col('__extracted_master_price').is_null()
    )
    skipped_customer = is_txn & mapping_ok & pl.col('__has_customer') & ~pl.col('__has_loose')
    skipped_misc = (
        is_txn
        & mapping_ok
        & pl.col('__is_misc_product')
        & ~pl.col('__has_loose')
        & ~pl.col('__has_customer')
    )

    gold_diamond_valid = (
        is_txn
        & mapping_ok
        & slab_family.is_null()
        & ~gem_shape
        & ~pl.col('__has_customer')
        & ~pl.col('__has_loose')
        & ~pl.col('__is_misc_product')
        & ~metal_applies
        & ~invalid_rate_no_unit
    )

    drop_reason = (
        pl.when(~is_txn & pl.col('__is_blank_row'))
        .then(pl.lit('BLANK_ROW'))
        .when(~is_txn & pl.col('__is_repeated_header'))
        .then(pl.lit('REPEATED_HEADER'))
        .when(~is_txn & pl.col('__is_business_skip_row'))
        .then(pl.lit('BUSINESS_SKIP'))
        .when(~is_txn & ~pl.col('__is_transaction_row'))
        .then(pl.lit('NOT_TRANSACTION_ROW'))
        .otherwise(pl.lit(None))
        .alias('__drop_reason')
    )

    final_issue = (
        pl.when(~is_txn)
        .then(pl.lit(None))
        .when(invalid_mapping)
        .then(pl.lit('INVALID_PRODUCT_MAPPING'))
        .when(invalid_pattern)
        .then(pl.lit('INVALID_PRODUCT_PATTERN'))
        .when(invalid_rate_flag)
        .then(pl.lit('INVALID_RATE_DEVIATION'))
        .when(unknown_mix | unknown_pattern)
        .then(pl.lit('UNKNOWN_PRODUCT'))
        .when(skipped_loose | skipped_customer | skipped_misc)
        .then(pl.lit('SKIPPED'))
        .when(has_slab & ~rate_invalid & unit_rate_ok)
        .then(pl.lit('VALID'))
        .when(gold_diamond_valid)
        .then(pl.lit('VALID'))
        .otherwise(pl.lit('UNKNOWN_PRODUCT'))
        .alias('__final_issue')
    )

    audit_status = final_issue.alias('__audit_status')

    audit_reason = (
        pl.when(~is_txn)
        .then(pl.lit(None))
        .when(invalid_mapping)
        .then(pl.lit('ACCOUNT_PRODUCT_MISMATCH'))
        .when(invalid_pattern)
        .then(pl.lit('PRICE_PARSE_FAILED'))
        .when(invalid_rate)
        .then(pl.lit('RATE_OUTSIDE_30_PERCENT'))
        .when(invalid_rate_no_unit)
        .then(pl.lit('UNIT_RATE_INVALID'))
        .when(unknown_mix)
        .then(pl.lit('MIX_PRODUCT'))
        .when(unknown_pattern)
        .then(pl.lit('NO_PRODUCT_PATTERN'))
        .when(skipped_loose)
        .then(pl.lit('LOOSE_PRODUCT'))
        .when(skipped_customer)
        .then(pl.lit('CUSTOMER_PRODUCT'))
        .when(skipped_misc)
        .then(pl.lit('GOLD_SKIPPED'))
        .when(has_slab & ~rate_invalid)
        .then(pl.lit(''))
        .when(gold_diamond_valid)
        .then(
            pl.when(pl.col('__sales_account_norm').str.contains('DIAMOND'))
            .then(pl.lit('DIAMOND_SKIPPED'))
            .when(pl.col('__sales_account_norm').str.contains('GOLD'))
            .then(pl.lit('GOLD_SKIPPED'))
            .when(pl.col('__sales_account_norm').str.contains('SILVER'))
            .then(pl.lit('SILVER_SKIPPED'))
            .otherwise(pl.lit(''))
        )
        .otherwise(pl.lit('NO_PRODUCT_PATTERN'))
        .alias('__audit_reason')
    )

    return [
        invalid_mapping.alias('__invalid_product_mapping'),
        invalid_pattern.alias('__invalid_product_pattern'),
        invalid_rate_flag.alias('__invalid_rate_deviation'),
        drop_reason,
        final_issue,
        audit_status,
        audit_reason,
    ]
