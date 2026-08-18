"""
Rate Book Router - Diamond & Gemstone Rate Management
Provides endpoints for auditors to view and edit all diamond and gemstone rates.
Changes are persisted and immediately reflected in sales audits.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.utils.logger import get_logger

log = get_logger('rate-book')

router = APIRouter(prefix='/api/rate-book', tags=['rate-book'])
gateway_router = APIRouter(prefix='/api/v1/rate-book', tags=['rate-book'])

# Config paths
# router is at app/routers/rate_book_router.py
# config is at app/engines/sales_engine/config/
_CONFIG_DIR = Path(__file__).resolve().parents[1] / 'engines' / 'sales_engine' / 'config'
_DIAMOND_BOOK_PATH = _CONFIG_DIR / 'diamond_rate_book.json'
_GEMSTONE_BOOK_PATH = _CONFIG_DIR / 'gemstone_rate_book.json'

# Load hardcoded defaults for initialization (these are the source files)
_DIAMOND_DEFAULTS_PATH = _CONFIG_DIR / 'diamond_hardcoded_rates.json'
_GEMSTONE_DEFAULTS_PATH = _CONFIG_DIR / 'gemstone_product_catalog.json'

log.info('Rate book config dir: {}', _CONFIG_DIR)
log.info('Diamond defaults exists: {}', _DIAMOND_DEFAULTS_PATH.exists())
log.info('Gemstone defaults exists: {}', _GEMSTONE_DEFAULTS_PATH.exists())


# ============ Models ============

class DiamondRateEntry(BaseModel):
    min_rate: float | None = None
    max_rate: float | None = None
    min_only: bool = False


class DiamondRateBookPayload(BaseModel):
    products: dict[str, DiamondRateEntry] = Field(default_factory=dict)
    uplift_percent: int = 25
    deviation_percent: int = 15


class GemstoneAccountEntry(BaseModel):
    slabs: dict[str, float | None] = Field(default_factory=dict)


class GemstoneRateBookPayload(BaseModel):
    accounts: dict[str, GemstoneAccountEntry] = Field(default_factory=dict)
    deviation_percent: int = 15


# ============ Helper Functions ============

def _success(data: dict[str, Any]) -> dict[str, Any]:
    return {'success': True, **data}


def _load_json(path: Path, default: dict | None = None) -> dict:
    if not path.exists():
        return default or {}
    return json.loads(path.read_text(encoding='utf-8'))


def _save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding='utf-8')


# ============ Diamond Rate Book ============

def _initialize_diamond_book() -> dict[str, Any]:
    """Initialize from hardcoded defaults if no custom book exists."""
    defaults = _load_json(_DIAMOND_DEFAULTS_PATH, {'products': {}})
    products = {}
    
    for name, spec in defaults.get('products', {}).items():
        products[name] = {
            'min_rate': spec.get('min_rate'),
            'max_rate': spec.get('max_rate'),
            'min_only': spec.get('min_only', False),
        }
    
    return {
        'products': products,
        'uplift_percent': 25,
        'deviation_percent': 15,
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }


@router.get('/diamonds')
@gateway_router.get('/diamonds')
async def get_diamond_rates() -> dict[str, Any]:
    """Get all diamond rates including min/max for each product."""
    # Always start with hardcoded defaults to ensure ALL products are shown
    defaults = _initialize_diamond_book()
    default_products = defaults.get('products', {})
    
    if not _DIAMOND_BOOK_PATH.exists():
        # Initialize from hardcoded defaults
        data = defaults
        _save_json(_DIAMOND_BOOK_PATH, data)
        log.info('Created new diamond rate book with {} products', len(default_products))
    else:
        data = _load_json(_DIAMOND_BOOK_PATH)
        current_products = data.get('products', {})
        
        # Check if rate book is empty or missing products - re-initialize if needed
        if not current_products or len(current_products) < len(default_products):
            log.info(
                'Merging diamonds: current={}, defaults={}',
                len(current_products),
                len(default_products),
            )
            # Merge with defaults to ensure ALL products are included
            merged_products = {**default_products, **current_products}
            data['products'] = merged_products
            data['uplift_percent'] = data.get('uplift_percent', 25)
            data['deviation_percent'] = data.get('deviation_percent', 15)
            _save_json(_DIAMOND_BOOK_PATH, data)
            log.info('Saved merged diamond rate book with {} products', len(merged_products))
    
    final_products = data.get('products', {})
    log.info('Returning {} diamond products', len(final_products))
    
    return _success({
        'products': final_products,
        'uplift_percent': data.get('uplift_percent', 25),
        'deviation_percent': data.get('deviation_percent', 15),
        'updated_at': data.get('updated_at'),
    })


@router.post('/diamonds')
@gateway_router.post('/diamonds')
async def save_diamond_rates(payload: DiamondRateBookPayload) -> dict[str, Any]:
    """Save diamond rates. Changes take effect immediately in audits."""
    data = {
        'products': {
            key: {
                'min_rate': entry.min_rate,
                'max_rate': entry.max_rate,
                'min_only': entry.min_only,
            }
            for key, entry in payload.products.items()
        },
        'uplift_percent': payload.uplift_percent,
        'deviation_percent': payload.deviation_percent,
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    _save_json(_DIAMOND_BOOK_PATH, data)
    
    # Clear any caches to ensure immediate effect
    from app.engines.sales_engine.config.loader import clear_metal_rate_caches
    clear_metal_rate_caches()
    
    return _success({
        'products': data['products'],
        'uplift_percent': data['uplift_percent'],
        'deviation_percent': data['deviation_percent'],
        'updated_at': data['updated_at'],
    })


# ============ Gemstone Rate Book ============

def _initialize_gemstone_book() -> dict[str, Any]:
    """Initialize from gemstone catalog defaults."""
    defaults = _load_json(_GEMSTONE_DEFAULTS_PATH, {'accounts': {}, 'deviation_percent': 15})
    
    accounts = {}
    for account_name, account_data in defaults.get('accounts', {}).items():
        slabs = {}
        # Extract slab rates from the account configuration
        for key in ['precious_stones_jos', 'color_stones', 'slabs']:
            if key in account_data:
                for slab_value in account_data[key]:
                    slab_str = str(slab_value)
                    # Default rate based on slab value
                    slabs[slab_str] = float(slab_value)
        
        accounts[account_name] = {'slabs': slabs}
    
    return {
        'accounts': accounts,
        'deviation_percent': defaults.get('deviation_percent', 15),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }


@router.get('/gemstones')
@gateway_router.get('/gemstones')
async def get_gemstone_rates() -> dict[str, Any]:
    """Get all gemstone rates organized by account and slab."""
    # Always start with defaults to ensure ALL accounts/slabs are shown
    defaults = _initialize_gemstone_book()
    default_accounts = defaults.get('accounts', {})
    
    if not _GEMSTONE_BOOK_PATH.exists():
        data = defaults
        _save_json(_GEMSTONE_BOOK_PATH, data)
        total_slabs = sum(len(acc.get('slabs', {})) for acc in default_accounts.values())
        log.info(
            'Created new gemstone rate book with {} accounts, {} slabs',
            len(default_accounts),
            total_slabs,
        )
    else:
        data = _load_json(_GEMSTONE_BOOK_PATH)
        current_accounts = data.get('accounts', {})
        
        # Check if rate book is empty or missing accounts - merge if needed
        current_total_slabs = sum(len(acc.get('slabs', {})) for acc in current_accounts.values())
        default_total_slabs = sum(len(acc.get('slabs', {})) for acc in default_accounts.values())
        
        if not current_accounts or current_total_slabs < default_total_slabs:
            log.info(
                'Merging gemstones: current={} slabs, defaults={} slabs',
                current_total_slabs,
                default_total_slabs,
            )
            # Merge with defaults to ensure ALL accounts are included
            merged_accounts = {}
            for account_name in {**default_accounts, **current_accounts}.keys():
                default_slabs = default_accounts.get(account_name, {}).get('slabs', {})
                current_slabs = current_accounts.get(account_name, {}).get('slabs', {})
                # Merge: current values override defaults, but missing defaults are added
                merged_slabs = {**default_slabs, **current_slabs}
                merged_accounts[account_name] = {'slabs': merged_slabs}
            
            data['accounts'] = merged_accounts
            data['deviation_percent'] = data.get('deviation_percent', 15)
            _save_json(_GEMSTONE_BOOK_PATH, data)
            merged_total = sum(len(acc.get('slabs', {})) for acc in merged_accounts.values())
            log.info(
                'Saved merged gemstone rate book with {} accounts, {} slabs',
                len(merged_accounts),
                merged_total,
            )
    
    final_accounts = data.get('accounts', {})
    final_total_slabs = sum(len(acc.get('slabs', {})) for acc in final_accounts.values())
    log.info(
        'Returning {} gemstone accounts with {} total slabs',
        len(final_accounts),
        final_total_slabs,
    )
    
    return _success({
        'accounts': final_accounts,
        'deviation_percent': data.get('deviation_percent', 15),
        'updated_at': data.get('updated_at'),
    })


@router.post('/gemstones')
@gateway_router.post('/gemstones')
async def save_gemstone_rates(payload: GemstoneRateBookPayload) -> dict[str, Any]:
    """Save gemstone rates. Changes take effect immediately in audits."""
    data = {
        'accounts': {
            account: {
                'slabs': entry.slabs
            }
            for account, entry in payload.accounts.items()
        },
        'deviation_percent': payload.deviation_percent,
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    _save_json(_GEMSTONE_BOOK_PATH, data)
    
    # Clear caches
    from app.engines.sales_engine.config.loader import clear_metal_rate_caches
    clear_metal_rate_caches()
    
    return _success({
        'accounts': data['accounts'],
        'deviation_percent': data['deviation_percent'],
        'updated_at': data['updated_at'],
    })


# ============ Combined Rate Book ============

@router.get('')
@gateway_router.get('')
async def get_full_rate_book() -> dict[str, Any]:
    """Get complete rate book with diamonds and gemstones."""
    diamond_data = await get_diamond_rates()
    gemstone_data = await get_gemstone_rates()
    
    return _success({
        'diamonds': diamond_data,
        'gemstones': gemstone_data,
    })
