import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { formatNumber } from '../../utils/format';

const QTY_EPS = 1e-4;

function qtyEqual(a, b) {
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= QTY_EPS;
}

function productKey(name) {
  return String(name || '')
    .normalize('NFKC')
    .replace(/[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/**
 * Apply a confirmed Opening Qty mapping in session state only.
 * Does not change Opening Amount, Sales, Purchases, or automatic mapping results.
 */
export function applyManualOpeningQuantityMapping(result, mapping) {
  if (!result || !mapping?.product) return result;
  const product = String(mapping.product).trim();
  const selected = Array.isArray(mapping.selectedPreviousYearProducts)
    ? mapping.selectedPreviousYearProducts
    : [];
  const claimed = new Set(selected.map((name) => productKey(name)).filter(Boolean));
  const report = {
    ...(result.openingStockReport || result.summary?.openingStockReport || {}),
  };
  const pending = (report.manualQuantityMappingRequired || []).filter(
    (row) => productKey(row.product) !== productKey(product)
  );
  const nextPending = pending.map((row) => ({
    ...row,
    candidateProducts: (row.candidateProducts || []).filter(
      (candidate) => !claimed.has(productKey(candidate.product || candidate.sheetName))
    ),
  }));
  const confirmed = [
    ...(report.manualQuantityMapped || []),
    {
      product,
      openingQty: mapping.openingQty,
      selectedPreviousYearProducts: selected,
      selectedQty: mapping.selectedQty,
      subcategory: mapping.subcategory,
      category: mapping.category,
      status: 'manual_quantity_mapped',
    },
  ];
  const nextReport = {
    ...report,
    manualQuantityMappingRequired: nextPending,
    manualQuantityMappingRequiredCount: nextPending.length,
    manualQuantityMapped: confirmed,
    manualQuantityMappedCount: confirmed.length,
  };
  return {
    ...result,
    openingStockReport: nextReport,
    summary: {
      ...(result.summary || {}),
      openingStockReport: {
        ...(result.summary?.openingStockReport || {}),
        ...nextReport,
      },
    },
  };
}

function groupBySubcategory(rows) {
  const groups = [];
  const index = new Map();
  for (const row of rows || []) {
    const subcategory = String(row.subcategory || '').trim();
    if (!subcategory) continue;
    if (!index.has(subcategory)) {
      index.set(subcategory, groups.length);
      groups.push({
        subcategory,
        category: row.category || '',
        products: [],
      });
    }
    groups[index.get(subcategory)].products.push(row);
  }
  return groups;
}

export function OpeningStockManualQuantityPanel({ rows, onConfirmMapping }) {
  const pending = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const groups = useMemo(() => groupBySubcategory(pending), [pending]);
  const remaining = pending.length;

  const [activeSubcategory, setActiveSubcategory] = useState(null);
  const [productIndex, setProductIndex] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [search, setSearch] = useState('');

  const activeGroup = useMemo(
    () => groups.find((group) => group.subcategory === activeSubcategory) || null,
    [groups, activeSubcategory]
  );
  const products = activeGroup?.products || [];
  const safeIndex = Math.min(productIndex, Math.max(products.length - 1, 0));
  const current = products[safeIndex] || null;

  useEffect(() => {
    if (activeSubcategory && !groups.some((group) => group.subcategory === activeSubcategory)) {
      setActiveSubcategory(null);
      setProductIndex(0);
      setSelectedKeys(new Set());
      setSearch('');
    }
  }, [activeSubcategory, groups]);

  useEffect(() => {
    setSelectedKeys(new Set());
    setSearch('');
  }, [current?.product, activeSubcategory]);

  const candidates = useMemo(() => {
    const list = Array.isArray(current?.candidateProducts) ? current.candidateProducts : [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) => String(row.product || '').toLowerCase().includes(q));
  }, [current, search]);

  const selectedRows = useMemo(() => {
    const list = Array.isArray(current?.candidateProducts) ? current.candidateProducts : [];
    return list.filter((row) => selectedKeys.has(productKey(row.product)));
  }, [current, selectedKeys]);

  const selectedQty = selectedRows.reduce(
    (sum, row) => sum + (Number.isFinite(Number(row.closingQty)) ? Number(row.closingQty) : 0),
    0
  );
  const openingQty = current?.openingQty == null ? null : Number(current.openingQty);
  const difference =
    openingQty == null ? null : openingQty - selectedQty;
  const canConfirm =
    current &&
    selectedRows.length > 0 &&
    openingQty != null &&
    qtyEqual(openingQty, selectedQty);

  const toggleCandidate = (product) => {
    const key = productKey(product);
    if (!key) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const closeModal = () => {
    setActiveSubcategory(null);
    setProductIndex(0);
    setSelectedKeys(new Set());
    setSearch('');
  };

  const handleConfirm = () => {
    if (!canConfirm || !current || !onConfirmMapping) return;
    onConfirmMapping({
      product: current.product,
      openingQty: current.openingQty,
      category: current.category,
      subcategory: current.subcategory,
      selectedPreviousYearProducts: selectedRows.map((row) => row.product),
      selectedQty,
    });
    const remainingInGroup = products.length - 1;
    if (remainingInGroup <= 0) {
      closeModal();
      return;
    }
    setProductIndex((idx) => Math.min(idx, remainingInGroup - 1));
    setSelectedKeys(new Set());
    setSearch('');
  };

  if (!remaining) return null;

  const modal =
    current && activeSubcategory
      ? createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="manual-qty-mapping-title"
              className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                <div>
                  <h4
                    id="manual-qty-mapping-title"
                    className="text-base font-semibold text-slate-900 dark:text-slate-50"
                  >
                    {activeSubcategory}
                  </h4>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Product {safeIndex + 1} of {products.length}
                    {' · '}
                    {remaining} product{remaining === 1 ? '' : 's'} remaining
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Close manual mapping"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="text-xs font-medium text-slate-500">Current Product</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {current.product}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="text-xs font-medium text-slate-500">Current Opening Quantity</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                      {formatNumber(current.openingQty, 4)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Previous-year products
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Select one or more from individual product sheets (Closing Balance Qty). No
                    automatic selection.
                  </p>
                  <Input
                    className="mt-2"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by name"
                  />
                  <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    {candidates.length ? (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {candidates.map((row) => {
                          const key = productKey(row.product);
                          const checked = selectedKeys.has(key);
                          return (
                            <li key={`${row.sheetName}-${row.product}`}>
                              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/80">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleCandidate(row.product)}
                                />
                                <span className="min-w-0 flex-1 text-sm text-slate-800 dark:text-slate-100">
                                  {row.product}
                                </span>
                                <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
                                  {formatNumber(row.closingQty, 4)}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="px-3 py-6 text-center text-sm text-slate-500">
                        No previous-year product sheets in this subcategory.
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-500">Selected Qty</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {formatNumber(selectedQty, 4)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-500">Difference</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {difference == null ? '—' : formatNumber(difference, 4)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-500">Selected products</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{selectedRows.length}</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
                <Button variant="secondary" size="sm" onClick={closeModal}>
                  Close
                </Button>
                <Button variant="primary" size="sm" disabled={!canConfirm} onClick={handleConfirm}>
                  Confirm
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-violet-950 dark:text-violet-100">
            Manual Opening Quantity mapping
          </h4>
          <p className="mt-0.5 text-xs text-violet-900/80 dark:text-violet-200/80">
            {remaining} product{remaining === 1 ? '' : 's'} remaining
          </p>
        </div>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-violet-200/70 bg-white/80 dark:border-violet-900/40 dark:bg-slate-900/40">
        <table className="w-full text-left text-sm">
          <thead className="bg-violet-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/80">
            <tr>
              <th className="px-3 py-2">Subcategory</th>
              <th className="px-3 py-2">Pending</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr
                key={group.subcategory}
                className="border-t border-violet-100 dark:border-slate-800"
              >
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                  {group.subcategory}
                </td>
                <td className="px-3 py-2 tabular-nums">{group.products.length}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setActiveSubcategory(group.subcategory);
                      setProductIndex(0);
                      setSelectedKeys(new Set());
                      setSearch('');
                    }}
                  >
                    Map
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal}
    </div>
  );
}
