"""MR/DC input columns — matched by normalized header name, not position."""

from typing import Final

from app.utils.header_cleaner import normalize_header

# logical_key -> (display name, accepted normalized aliases)
MR_DC_COLUMN_SPEC: Final[dict[str, tuple[str, tuple[str, ...]]]] = {
    'sno': ('SNo', ('sno', 's_no', 'sl_no', 'slno', 'serial_no', 'si_no')),
    'date': ('Date', ('date',)),
    'voucher_no': ('Voucher No', ('voucher_no', 'voucher_number', 'vch_no', 'voucher')),
    'branch': ('Branch', ('branch',)),
    'party': ('Party', ('party',)),
    'item_type': ('Item Type', ('item_type',)),
    'other_account': ('Other Account', ('other_account',)),
    'product': ('Product', ('product',)),
    'uom': ('UOM', ('uom', 'unit')),
    'quantity': ('Quantity', ('quantity', 'qty')),
    'free_quantity': ('Free Quantity', ('free_quantity', 'free_qty')),
    'unit_rate': ('Unit Rate', ('unit_rate', 'rate')),
    'gross_amount': ('Gross Amount', ('gross_amount', 'gross')),
    'discount': ('Discount', ('discount',)),
    'gross_minus_discount': (
        'Gross Minus Discount',
        ('gross_minus_discount', 'gross_less_discount'),
    ),
    'cgst': ('CGST', ('cgst',)),
    'sgst': ('SGST', ('sgst',)),
    'igst': ('IGST', ('igst',)),
    'gst_amount': ('GST Amount', ('gst_amount', 'gst')),
    'net_amount': ('Net Amount', ('net_amount', 'net')),
    'division': ('Division', ('division',)),
}

# Only columns used by MR/DC pivot logic are required. All others are optional.
MR_DC_REQUIRED_LOGICAL: Final[tuple[str, ...]] = (
    'product',
    'quantity',
    'gross_amount',
    'branch',
)
MR_DC_REQUIRED_DISPLAY: Final[tuple[str, ...]] = tuple(
    MR_DC_COLUMN_SPEC[key][0] for key in MR_DC_REQUIRED_LOGICAL
)

ALIAS_TO_LOGICAL: Final[dict[str, str]] = {}
for _logical, (_display, aliases) in MR_DC_COLUMN_SPEC.items():
    ALIAS_TO_LOGICAL.setdefault(normalize_header(_display), _logical)
    for alias in aliases:
        ALIAS_TO_LOGICAL.setdefault(alias, _logical)
