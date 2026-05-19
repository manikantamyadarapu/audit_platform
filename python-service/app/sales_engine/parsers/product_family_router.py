from __future__ import annotations

from app.sales_engine.parsers.product_category import (
    detected_category_expr,
    extracted_slab_price_expr,
    gem_slab_shape_expr,
    slab_family_expr,
)

extracted_master_price_expr = extracted_slab_price_expr

__all__ = [
    'detected_category_expr',
    'extracted_master_price_expr',
    'extracted_slab_price_expr',
    'gem_slab_shape_expr',
    'slab_family_expr',
]
