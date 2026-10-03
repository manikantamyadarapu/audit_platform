import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { CLOSING_STOCK_CATEGORIES } from '../../config/closingStockLayout';
import { formatNumber } from '../../utils/format';

/**
 * Products that did not land on a sheet. The user chooses the sheet.
 */
export function UnmappedSheetMappingPanel({ products, sheetCategories, onMapProduct }) {
  const rows = Array.isArray(products) ? products : [];
  const sheets = useMemo(() => {
    const extras = (sheetCategories || []).filter(
      (category) => category && !CLOSING_STOCK_CATEGORIES.includes(category)
    );
    return [...CLOSING_STOCK_CATEGORIES, ...extras];
  }, [sheetCategories]);
  const [choices, setChoices] = useState({});
  const [customNames, setCustomNames] = useState({});

  if (!rows.length) return null;

  function mapRow(row) {
    const product = String(row?.product || '').trim();
    const custom = String(customNames[product] || '').trim();
    const category = custom || choices[product] || sheets[0];
    if (!product || !category) return;
    onMapProduct?.({ product, category });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-amber-900/80 dark:text-amber-200/80">
        These products are not on a sheet. Choose a sheet, or type a new category, then map them.
        Gold and silver products stay off this list.
      </p>
      <ul className="space-y-2">
        {rows.map((row) => {
          const product = String(row?.product || '').trim();
          const qty = row?.sumOfQuantity;
          const amt = row?.sumOfGross;
          return (
            <li
              key={`${row?.source || 'row'}-${product}`}
              className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-white/80 p-3 dark:border-amber-900/40 dark:bg-slate-900/40 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {product}
                </p>
                <p className="text-xs text-slate-500">
                  {row?.source ? `${row.source}` : 'Unmapped'}
                  {qty != null ? ` · Qty ${formatNumber(qty, 4)}` : ''}
                  {amt != null ? ` · Amt ${formatNumber(amt, 2)}` : ''}
                </p>
              </div>
              <select
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                value={choices[product] || sheets[0] || ''}
                onChange={(event) =>
                  setChoices((prev) => ({ ...prev, [product]: event.target.value }))
                }
                aria-label={`Sheet for ${product}`}
              >
                {sheets.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                placeholder="New category"
                value={customNames[product] || ''}
                onChange={(event) =>
                  setCustomNames((prev) => ({ ...prev, [product]: event.target.value }))
                }
                aria-label={`New category for ${product}`}
              />
              <Button type="button" size="sm" onClick={() => mapRow(row)}>
                Map
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
