"""Build gemstone_product_catalog.json from enterprise master product strings.

Run: python -m app.data.build_gemstone_product_catalog
"""

from __future__ import annotations

import json
import re
from pathlib import Path

_CONFIG = Path(__file__).resolve().parents[1] / 'engines' / 'sales_engine' / 'config' / 'gemstone_product_catalog.json'

_COLOR_BLOB = (
    'Customer Stones'
    'Precious stones JOS 100Precious stones JOS 1000Precious stones JOS 10000Precious stones JOS 1100'
    'Precious stones JOS 11000Precious stones JOS 1200Precious stones JOS 12000Precious stones JOS 1300'
    'Precious stones JOS 1400Precious stones JOS 14000Precious stones JOS 150Precious stones JOS 1500'
    'Precious stones JOS 1600Precious stones JOS 16000Precious stones JOS 1700Precious stones JOS 17000'
    'Precious stones JOS 17500Precious stones JOS 1800Precious stones JOS 1900Precious stones JOS 200'
    'Precious stones JOS 2000Precious stones JOS 20000Precious stones JOS 2100Precious stones JOS 2200'
    'Precious stones JOS 2300Precious stones JOS 2400Precious stones JOS 250Precious stones JOS 2500'
    'Precious stones JOS 25000Precious stones JOS 2600Precious stones JOS 2700Precious stones JOS 2800'
    'Precious stones JOS 2900Precious stones JOS 300Precious stones JOS 3000Precious stones JOS 3100'
    'Precious stones JOS 3200Precious stones JOS 3300Precious stones JOS 3400Precious stones JOS 350'
    'Precious stones JOS 3500Precious stones JOS 3600Precious stones JOS 3700Precious stones JOS 38500'
    'Precious stones JOS 400Precious stones JOS 4000Precious stones JOS 4200Precious stones JOS 4400'
    'Precious stones JOS 450Precious stones JOS 4500Precious stones JOS 45000Precious stones JOS 4800'
    'Precious stones JOS 4900Precious stones JOS 49000Precious stones JOS 50Precious stones JOS 500'
    'Precious stones JOS 5000Precious stones JOS 550Precious stones JOS 5500Precious stones JOS 5600'
    'Precious stones JOS 600Precious stones JOS 6000Precious stones JOS 650Precious stones JOS 6500'
    'Precious stones JOS 66000Precious stones JOS 700Precious stones JOS 7000Precious stones JOS 750'
    'Precious stones JOS 7500Precious stones JOS 800Precious stones JOS 8000Precious stones JOS 850'
    'Precious stones JOS 8500Precious stones JOS 900Precious stones JOS 950'
    'Precious stones Loose JOS 100Precious Stones Loose JOS 1100Precious stones Loose JOS 1200'
    'Precious stones Loose JOS 150Precious stones Loose JOS 1800Precious stones Loose JOS 200'
    'Precious stones Loose JOS 2000Precious stones Loose JOS 250Precious stones Loose JOS 2800'
    'Precious stones Loose JOS 3000Precious stones Loose JOS 3600Precious stones Loose JOS 400'
    'Precious stones Loose JOS 4700Precious Stones Loose JOS 5600Precious Stones Loose JOS 600'
    'Precious Stones Loose JOS 7000'
    'Semi precious JSP 100Semi precious JSP 1000Semi precious JSP 1100Semi precious JSP 1200'
    'Semi precious JSP 1300Semi precious JSP 1400Semi precious JSP 150Semi precious JSP 1600'
    'Semi precious JSP 200Semi precious JSP 250Semi precious JSP 2500Semi precious JSP 300'
    'Semi precious JSP 350Semi precious JSP 400Semi precious JSP 450Semi precious JSP 50'
    'Semi precious JSP 500Semi precious JSP 550Semi precious JSP 600Semi precious JSP 700'
    'Semi precious JSP 750Semi precious JSP 800Semi precious JSP 850Semi precious JSP 900'
    'Synthetic JSY 100Synthetic JSY 150'
)

_EMERALD_BLOB = (
    'Customer EmeraldsEmeralds JEM 100Emeralds JEM 1000Emeralds JEM 10000Emeralds JEM 10500Emeralds JEM 1100'
    'Emeralds JEM 11500Emeralds JEM 1200Emeralds JEM 12000Emeralds JEM 12500Emeralds JEM 1300Emeralds JEM 13000'
    'Emeralds JEM 1400Emeralds JEM 14000Emeralds JEM 14500Emeralds JEM 150Emeralds JEM 1500Emeralds JEM 15000'
    'Emeralds JEM 1600Emeralds JEM 1700Emeralds JEM 1800Emeralds JEM 18500Emeralds JEM 1900Emeralds JEM 200'
    'Emeralds JEM 2000Emeralds JEM 2100Emeralds JEM 2200Emeralds JEM 2300Emeralds JEM 2400Emeralds JEM 24000'
    'Emeralds JEM 250Emeralds JEM 2500Emeralds JEM 25000Emeralds JEM 2600Emeralds JEM 2700Emeralds JEM 2800'
    'Emeralds JEM 300Emeralds JEM 3000Emeralds JEM 30000Emeralds JEM 3100Emeralds JEM 3200Emeralds JEM 3300'
    'Emeralds JEM 3400Emeralds JEM 350Emeralds JEM 3500Emeralds JEM 3600Emeralds JEM 3700Emeralds JEM 3800'
    'Emeralds JEM 3900Emeralds JEM 400Emeralds JEM 4000Emeralds JEM 40000Emeralds JEM 4100Emeralds JEM 4200'
    'Emeralds JEM 4300Emeralds JEM 4400Emeralds JEM 450Emeralds JEM 4500Emeralds JEM 4600Emeralds JEM 4700'
    'Emeralds JEM 4800Emeralds JEM 4900Emeralds JEM 50Emeralds JEM 500Emeralds JEM 5000Emeralds JEM 5200'
    'Emeralds JEM 5300Emeralds JEM 550Emeralds JEM 5600Emeralds JEM 5800Emeralds JEM 58000Emeralds JEM 600'
    'Emeralds JEM 6000Emeralds JEM 650Emeralds JEM 6500Emeralds JEM 6700Emeralds JEM 6800Emeralds JEM 700'
    'Emeralds JEM 7000Emeralds JEM 750Emeralds JEM 7500Emeralds JEM 7800Emeralds JEM 800Emeralds JEM 8000'
    'Emeralds JEM 850Emeralds JEM 8500Emeralds JEM 900Emeralds JEM 9000Emeralds JEM 950Emeralds JEM 9500'
    'Emeralds JEM Loose 22000Emeralds JEM Mix'
)

_PEARL_BLOB = (
    'Customer PearlsPearls JPS 100Pearls JPS 1000Pearls JPS 1100Pearls JPS 1200Pearls JPS 1300Pearls JPS 1400'
    'Pearls JPS 150Pearls JPS 1500Pearls JPS 1600Pearls JPS 1700Pearls JPS 1800Pearls JPS 1900Pearls JPS 200'
    'Pearls JPS 2000Pearls JPS 2100Pearls JPS 2200Pearls JPS 2400Pearls JPS 250Pearls JPS 2500Pearls JPS 2800'
    'Pearls JPS 2900Pearls JPS 300Pearls JPS 33000Pearls JPS 350Pearls JPS 3500Pearls JPS 400Pearls JPS 4000'
    'Pearls JPS 4200Pearls JPS 450Pearls JPS 50Pearls JPS 500Pearls JPS 5000Pearls JPS 550Pearls JPS 600'
    'Pearls JPS 700Pearls JPS 800Pearls JPS 8400Pearls JPS 850Pearls JPS 900'
)

_RUBY_BLOB = (
    'Customer RubiesRubies JRU 100Rubies JRU 1000Rubies JRU 10000Rubies JRU 1100Rubies JRU 11200Rubies JRU 1200'
    'Rubies JRU 1300Rubies JRU 1400Rubies JRU 14500Rubies JRU 150Rubies JRU 1500Rubies JRU 1600Rubies JRU 1700'
    'Rubies JRU 1800Rubies JRU 1900Rubies JRU 200Rubies JRU 2000Rubies JRU 20000Rubies JRU 2100Rubies JRU 2200'
    'Rubies JRU 2300Rubies JRU 2400Rubies JRU 250Rubies JRU 2500Rubies JRU 2700Rubies JRU 2800Rubies JRU 2900'
    'Rubies JRU 300Rubies JRU 3000Rubies JRU 3100Rubies JRU 3200Rubies JRU 3300Rubies JRU 3400Rubies JRU 350'
    'Rubies JRU 3500Rubies JRU 3600Rubies JRU 3700Rubies JRU 3800Rubies JRU 3900Rubies JRU 400Rubies JRU 4000'
    'Rubies JRU 4100Rubies JRU 4200Rubies JRU 4300Rubies JRU 4400Rubies JRU 450Rubies JRU 4500Rubies JRU 4700'
    'Rubies JRU 4800Rubies JRU 50Rubies JRU 500Rubies JRU 5000Rubies JRU 5100Rubies JRU 5300Rubies JRU 5400'
    'Rubies JRU 550Rubies JRU 5500Rubies JRU 600Rubies JRU 6000Rubies JRU 6300Rubies JRU 650Rubies JRU 6600'
    'Rubies JRU 700Rubies JRU 7000Rubies JRU 750Rubies JRU 800Rubies JRU 8400Rubies JRU 850Rubies JRU 900'
    'Rubies JRU Loose 33500Rubies JRU Mix'
)


def _nums(blob: str, pattern: str) -> list[int]:
    return sorted({int(x) for x in re.findall(pattern, blob, flags=re.I)})


def _loose_nums(blob: str) -> list[int]:
    return sorted({int(x) for x in re.findall(r'LOOSE\s+JOS\s+(\d+)', blob, flags=re.I)})


def main() -> None:
    catalog = {
        'version': 1,
        'rate_model': 'slab_in_product_name',
        'deviation_percent': 15,
        'accounts': {
            'JEWELS SALES ACCOUNT - COLOR STONES': {
                'customer_products': ['Customer Stones'],
                'precious_stones_jos': _nums(_COLOR_BLOB, r'(?<!LOOSE\s)JOS\s+(\d+)'),
                'precious_stones_loose_jos': _loose_nums(_COLOR_BLOB),
                'semi_precious_jsp': _nums(_COLOR_BLOB, r'JSP\s+(\d+)'),
                'synthetic_jsy': _nums(_COLOR_BLOB, r'JSY\s+(\d+)'),
            },
            'JEWELS SALES ACCOUNT - EMERALDS': {
                'customer_products': ['Customer Emeralds'],
                'emeralds_jem': _nums(_EMERALD_BLOB, r'JEM\s+(\d+)'),
                'tail_products': ['Emeralds JEM Loose 22000', 'Emeralds JEM Mix'],
            },
            'JEWELS SALES ACCOUNT - PEARLS': {
                'customer_products': ['Customer Pearls'],
                'pearls_jps': _nums(_PEARL_BLOB, r'JPS\s+(\d+)'),
            },
            'JEWELS SALES ACCOUNT - RUBIES': {
                'customer_products': ['Customer Rubies'],
                'rubies_jru': _nums(_RUBY_BLOB, r'JRU\s+(\d+)'),
                'tail_products': ['Rubies JRU Loose 33500', 'Rubies JRU Mix'],
            },
        },
    }
    _CONFIG.write_text(json.dumps(catalog, indent=2), encoding='utf-8')
    print(f'Wrote {_CONFIG}')


if __name__ == '__main__':
    main()
