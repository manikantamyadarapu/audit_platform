import { useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { formatNumber } from '../../utils/format';
import { cn } from '../../utils/cn';

const PURCHASE_PIVOTS = [
  { key: 'purchasesPivot', label: 'Purchases', amountLabel: 'Sum of Gross Amount' },
  { key: 'purchaseReturnPivot', label: 'Purchase Return', amountLabel: 'Sum of Gross Amount' },
  {
    key: 'supplierDebitNotePivot',
    label: 'Debit Notes from Suppliers',
    amountLabel: 'Debit Amount',
    hideQuantity: true,
  },
  {
    key: 'supplierCreditNotePivot',
    label: 'Credit Notes from Suppliers',
    amountLabel: 'Credit Amount',
    hideQuantity: true,
  },
];

const OTHER_PIVOTS = [
  { key: 'salesPivot', label: 'Sales' },
  { key: 'salesReturnPivot', label: 'Sales Return' },
  { key: 'netSalesPivot', label: 'Net Sales' },
  { key: 'netPurchasesPivot', label: 'Net Purchases' },
];

function rowsFor(result, key) {
  return Array.isArray(result?.[key]) ? result[key] : [];
}

function matchesQuery(product, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return String(product || '').toLowerCase().includes(needle);
}

function sortedByProduct(rows) {
  return [...rows].sort((left, right) =>
    String(left?.product || '').localeCompare(String(right?.product || ''), 'en', {
      sensitivity: 'base',
      numeric: true,
    })
  );
}

function measure(value, decimals) {
  if (value == null || value === '') return '—';
  return formatNumber(value, decimals);
}

function PivotTable({ rows, amountLabel = 'Sum of Gross Amount', hideQuantity = false }) {
  const columnCount = hideQuantity ? 2 : 3;
  return (
    <div className="max-h-72 overflow-auto rounded-xl border border-slate-200/80 dark:border-slate-700">
      <table className="min-w-full text-left text-xs">
        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
          <tr>
            <th className="px-3 py-2 font-semibold">Product</th>
            {hideQuantity ? null : <th className="px-3 py-2 font-semibold">Sum of Quantity</th>}
            <th className="px-3 py-2 font-semibold">{amountLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={`${row.product}-${index}`} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-1.5">{row.product}</td>
                {hideQuantity ? null : (
                  <td className="px-3 py-1.5 tabular-nums">{formatNumber(row.sumOfQuantity ?? 0, 4)}</td>
                )}
                <td className="px-3 py-1.5 tabular-nums">{formatNumber(row.sumOfGross ?? 0, 2)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-3 text-slate-500" colSpan={columnCount}>
                No products in this pivot.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function purchaseFinalRows(result) {
  const products = result?.salesPurchaseNet?.products;
  if (Array.isArray(products) && products.length) {
    return products.filter(
      (row) =>
        row.purchaseQty != null ||
        row.purchaseAmount != null ||
        row.purchaseReturnQty != null ||
        row.purchaseReturnAmount != null ||
        row.debitAmount != null ||
        row.creditAmount != null
    );
  }
  return rowsFor(result, 'netPurchasesPivot').map((row) => ({
    product: row.product,
    netPurchaseQty: row.sumOfQuantity,
    netPurchaseAmount: row.sumOfGross,
  }));
}

export function JubileePivotPreview({ result }) {
  const [query, setQuery] = useState('');
  const [activeKey, setActiveKey] = useState(OTHER_PIVOTS[0].key);

  const finals = useMemo(() => {
    return sortedByProduct(purchaseFinalRows(result).filter((row) => matchesQuery(row.product, query)));
  }, [query, result]);

  const otherRows = sortedByProduct(
    rowsFor(result, activeKey).filter((row) => matchesQuery(row.product, query))
  );

  return (
    <div id="jubilee-hills-pivots" className="space-y-8">
      <Card>
        <CardHeader>
          <h3 className="text-base font-bold text-emerald-700">Purchase pivots</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            These four files are the purchase calculation. Sheet Purchases Qty is Purchases
            quantity minus Purchase Return quantity. Sheet Purchases Amt is Purchases amount plus
            Debit Amount, minus Credit Amount, minus Purchase Return amount.
          </p>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a product"
            aria-label="Find a product in the purchase pivots"
          />
          <div className="grid gap-4 xl:grid-cols-2">
            {PURCHASE_PIVOTS.map((pivot) => {
              const rows = sortedByProduct(
                rowsFor(result, pivot.key).filter((row) => matchesQuery(row.product, query))
              );
              return (
                <section key={pivot.key} className="space-y-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{pivot.label}</h4>
                    <p className="text-xs text-slate-500">{formatNumber(rows.length)} products</p>
                  </div>
                  <PivotTable
                    rows={rows}
                    amountLabel={pivot.amountLabel}
                    hideQuantity={pivot.hideQuantity}
                  />
                </section>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-bold text-emerald-700">Final purchases on the sheet</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Sheet Qty and Sheet Amt are the Purchases Qty and Purchases Amt written on each product
            row.
          </p>
        </CardHeader>
        <CardBody>
          <div className="max-h-96 overflow-auto rounded-xl border border-slate-200/80 dark:border-slate-700">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 font-semibold">Purchases Qty</th>
                  <th className="px-3 py-2 font-semibold">Purchases Amt</th>
                  <th className="px-3 py-2 font-semibold">Return Qty</th>
                  <th className="px-3 py-2 font-semibold">Return Amt</th>
                  <th className="px-3 py-2 font-semibold">Debit Amt</th>
                  <th className="px-3 py-2 font-semibold">Credit Amt</th>
                  <th className="px-3 py-2 font-semibold">Sheet Qty</th>
                  <th className="px-3 py-2 font-semibold">Sheet Amt</th>
                </tr>
              </thead>
              <tbody>
                {finals.length ? (
                  finals.map((row, index) => (
                    <tr
                      key={`${row.product}-${index}`}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-3 py-1.5">{row.product}</td>
                      <td className="px-3 py-1.5 tabular-nums">{measure(row.purchaseQty, 4)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{measure(row.purchaseAmount, 2)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{measure(row.purchaseReturnQty, 4)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{measure(row.purchaseReturnAmount, 2)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{measure(row.debitAmount, 2)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{measure(row.creditAmount, 2)}</td>
                      <td className="px-3 py-1.5 font-semibold tabular-nums">{measure(row.netPurchaseQty, 4)}</td>
                      <td className="px-3 py-1.5 font-semibold tabular-nums">{measure(row.netPurchaseAmount, 2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={9}>
                      {query.trim() ? 'No product matches that name.' : 'No purchase products.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-bold text-emerald-700">Other pivots</h3>
          <div
            className="mt-4 flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1 dark:border-slate-700 dark:bg-slate-900/30"
            role="tablist"
            aria-label="Other Jubilee Hills pivots"
          >
            {OTHER_PIVOTS.map((pivot) => {
              const selected = pivot.key === activeKey;
              const count = rowsFor(result, pivot.key).length;
              return (
                <button
                  key={pivot.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveKey(pivot.key)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                    selected
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-emerald-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-200'
                  )}
                >
                  {pivot.label}
                  <span className={cn('ml-1.5 text-xs font-medium', selected ? 'text-emerald-100' : 'text-slate-400')}>
                    ({formatNumber(count)})
                  </span>
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardBody>
          <PivotTable rows={otherRows} />
        </CardBody>
      </Card>
    </div>
  );
}
