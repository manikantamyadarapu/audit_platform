import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatNumber } from '../../utils/format';
import { auditToastError, auditToastSuccess } from '../../utils/auditToast';
import { cn } from '../../utils/cn';

const QTY_EPS = 1e-4;

function coerceNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function qtyEqual(a, b) {
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= QTY_EPS;
}

function hasNonZeroQty(value) {
  const qty = coerceNumber(value);
  return qty !== null && Math.abs(qty) > QTY_EPS;
}

function subcategoryKey(row) {
  const category = String(row?.category || '').trim() || 'Uncategorized';
  const subcategory = String(row?.subcategory || '').trim() || 'Unspecified';
  return `${category}:::${subcategory}`;
}

function subcategoryLabel(row) {
  const category = String(row?.category || '').trim();
  const subcategory = String(row?.subcategory || '').trim();
  if (category && subcategory) return `${category} / ${subcategory}`;
  return subcategory || category || 'Unspecified';
}

/**
 * Apply a confirmed manual Opening Stock mapping into process result + pivots.
 * Writes Opening Qty/Amt onto the Closing Stock layout via matched_fallback status.
 * (Logic unchanged — UI-only redesign.)
 */
export function applyManualOpeningMapping(result, mapping) {
  const {
    product,
    ruleBookProduct,
    category,
    subcategory,
    openingQty,
    openingAmt,
    previousYearProducts,
  } = mapping;

  const productKey = String(product || '').trim();
  if (!productKey || openingAmt == null) return result;

  const openingPivot = (Array.isArray(result?.openingPivot) ? result.openingPivot : []).map(
    (row) => {
      if (String(row?.product || '').trim() !== productKey) return row;
      return {
        ...row,
        product: productKey,
        ruleBookProduct: ruleBookProduct || productKey,
        category: category || null,
        subcategory: subcategory || null,
        status: 'matched_fallback',
        sumOfQuantity: openingQty,
        sumOfGross: openingAmt,
      };
    }
  );
  const existingPivot = openingPivot.some((row) => String(row?.product || '').trim() === productKey);
  if (!existingPivot) {
    openingPivot.push({
      product: productKey,
      ruleBookProduct: ruleBookProduct || productKey,
      category: category || null,
      subcategory: subcategory || null,
      status: 'matched_fallback',
      sumOfQuantity: openingQty,
      sumOfGross: openingAmt,
    });
  }

  const validatedOpening = (Array.isArray(result?.validatedOpening) ? result.validatedOpening : [])
    .map((row) => {
      if (String(row?.product || '').trim() !== productKey) return row;
      return {
        ...row,
        openingQty,
        openingAmt,
        status: 'matched_fallback',
        reason: 'matched_via_manual_mapping',
        ruleBookProduct: ruleBookProduct || productKey,
        category: category || null,
        subcategory: subcategory || null,
        previousYearProducts,
      };
    });

  const report = { ...(result?.openingStockReport || {}) };
  const manualList = Array.isArray(report.manualMappingRequired)
    ? report.manualMappingRequired.filter((row) => String(row?.product || '').trim() !== productKey)
    : [];
  const fallbackMatched = [
    ...(Array.isArray(report.fallbackMatched) ? report.fallbackMatched : []),
    {
      product: productKey,
      openingQty,
      openingAmt,
      status: 'matched_fallback',
      reason: 'matched_via_manual_mapping',
      ruleBookProduct: ruleBookProduct || productKey,
      category,
      subcategory,
      previousYearProducts,
    },
  ];

  const nextReport = {
    ...report,
    manualMappingRequired: manualList,
    manualMappingRequiredCount: manualList.length,
    previousYearMappingRequired: manualList,
    previousYearMappingRequiredCount: manualList.length,
    fallbackMatched,
    fallbackMatchedCount: fallbackMatched.length,
    matchedCount: (report.exactMatchedCount || 0) + fallbackMatched.length,
  };

  return {
    ...result,
    openingPivot,
    validatedOpening,
    openingStockReport: nextReport,
    summary: {
      ...(result?.summary || {}),
      openingStockReport: nextReport,
    },
  };
}

function CandidateSearchSelect({ candidates, selected, onToggle, disabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => String(c.product || '').toLowerCase().includes(q));
  }, [candidates, query]);

  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
        Previous-year products (same subcategory)
      </label>
      <input
        type="search"
        value={query}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder={disabled ? 'No candidates available' : 'Search and select…'}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900"
      />
      {open && !disabled ? (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {filtered.length ? (
            filtered.map((candidate) => {
              const name = String(candidate.product || '').trim();
              const checked = selected.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-violet-50 dark:hover:bg-violet-950/40',
                    checked && 'bg-violet-50 dark:bg-violet-950/30'
                  )}
                  onClick={() => onToggle(name)}
                >
                  <span className="font-medium text-slate-800 dark:text-slate-100">{name}</span>
                  <span className="tabular-nums text-slate-500">
                    Qty {formatNumber(coerceNumber(candidate.closingStockQty) ?? 0, 4)} · Amt{' '}
                    {formatNumber(coerceNumber(candidate.closingStockAmount) ?? 0, 2)}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-2 text-xs text-slate-500">No matches</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MappingModal({
  open,
  group,
  productIndex,
  claimedPrevNames,
  onClose,
  onConfirm,
}) {
  const products = group?.products || [];
  const current = products[productIndex] || null;
  const openingQty = coerceNumber(current?.openingQty);
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    setSelected(new Set());
  }, [current?.product, group?.key]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const candidates = useMemo(() => {
    const raw = Array.isArray(current?.candidateProducts) ? current.candidateProducts : [];
    return raw.filter((c) => {
      const name = String(c.product || '').trim();
      return name && !claimedPrevNames.has(name) && hasNonZeroQty(c.closingStockQty);
    });
  }, [current, claimedPrevNames]);

  const selectedRows = useMemo(
    () => candidates.filter((c) => selected.has(String(c.product || '').trim())),
    [candidates, selected]
  );
  const selectedQty = selectedRows.reduce(
    (sum, c) => sum + (coerceNumber(c.closingStockQty) || 0),
    0
  );
  const selectedAmt = selectedRows.reduce(
    (sum, c) => sum + (coerceNumber(c.closingStockAmount) || 0),
    0
  );
  const difference =
    openingQty === null ? null : Math.round((openingQty - selectedQty) * 1e6) / 1e6;
  const canConfirm = selectedRows.length > 0 && qtyEqual(openingQty, selectedQty);

  if (!open || !current || !group) return null;

  function toggle(name) {
    const key = String(name || '').trim();
    if (!key) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleConfirm() {
    if (!canConfirm) {
      auditToastError('Selected Closing Qty must exactly equal current Opening Qty.');
      return;
    }
    onConfirm({
      product: current.product,
      ruleBookProduct: current.ruleBookProduct || current.product,
      category: current.category || null,
      subcategory: current.subcategory || null,
      openingQty,
      openingAmt: selectedAmt,
      previousYearProducts: selectedRows.map((c) => c.product),
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close mapping modal"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-950">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-300">
              {group.label}
            </p>
            <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-50">
              Map Opening Stock
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Product {productIndex + 1} of {products.length} in this subcategory
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-xs text-slate-500">Current product</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{current.product}</p>
          <p className="mt-2 text-xs text-slate-500">Current Opening Qty</p>
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatNumber(openingQty ?? 0, 4)}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <CandidateSearchSelect
            candidates={candidates}
            selected={selected}
            onToggle={toggle}
            disabled={!candidates.length}
          />

          {selectedRows.length ? (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="border-b border-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 dark:border-slate-800">
                Selected previous-year products
              </div>
              <ul className="max-h-28 overflow-auto divide-y divide-slate-100 dark:divide-slate-800">
                {selectedRows.map((c) => (
                  <li
                    key={String(c.product)}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {c.product}
                    </span>
                    <span className="tabular-nums text-slate-500">
                      Qty {formatNumber(coerceNumber(c.closingStockQty) ?? 0, 4)} · Amt{' '}
                      {formatNumber(coerceNumber(c.closingStockAmount) ?? 0, 2)}
                    </span>
                    <button
                      type="button"
                      className="text-rose-600 hover:underline"
                      onClick={() => toggle(c.product)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!candidates.length ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              No previous-year products left in this subcategory.
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/50">
            <p className="text-[11px] text-slate-500">Current Qty</p>
            <p className="font-semibold tabular-nums">{formatNumber(openingQty ?? 0, 4)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/50">
            <p className="text-[11px] text-slate-500">Selected Qty</p>
            <p className="font-semibold tabular-nums">{formatNumber(selectedQty, 4)}</p>
          </div>
          <div
            className={cn(
              'rounded-lg px-2.5 py-2',
              canConfirm
                ? 'bg-emerald-50 dark:bg-emerald-950/30'
                : 'bg-rose-50 dark:bg-rose-950/30'
            )}
          >
            <p className="text-[11px] text-slate-500">Difference</p>
            <p className="font-semibold tabular-nums">{formatNumber(difference ?? 0, 4)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/50">
            <p className="text-[11px] text-slate-500">Selected Amount</p>
            <p className="font-semibold tabular-nums">{formatNumber(selectedAmt, 2)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="button" size="sm" disabled={!canConfirm} onClick={handleConfirm}>
            Confirm Mapping
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function OpeningStockManualMappingPanel({ rows, onConfirmMapping }) {
  const items = Array.isArray(rows) ? rows : [];
  const [activeKey, setActiveKey] = useState(null);
  const [productIndex, setProductIndex] = useState(0);
  const [claimedPrevNames, setClaimedPrevNames] = useState(() => new Set());
  const [resolvedProducts, setResolvedProducts] = useState(() => new Set());

  const pendingItems = useMemo(
    () =>
      items.filter((row) => {
        const name = String(row?.product || '').trim();
        return name && !resolvedProducts.has(name) && hasNonZeroQty(row.openingQty);
      }),
    [items, resolvedProducts]
  );

  const groups = useMemo(() => {
    const map = new Map();
    for (const row of pendingItems) {
      const key = subcategoryKey(row);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: subcategoryLabel(row),
          category: row.category || null,
          subcategory: row.subcategory || null,
          products: [],
        });
      }
      map.get(key).products.push(row);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [pendingItems]);

  const activeGroup = useMemo(
    () => groups.find((g) => g.key === activeKey) || null,
    [groups, activeKey]
  );

  useEffect(() => {
    // Drop local resolved markers once parent rows no longer include them.
    setResolvedProducts((prev) => {
      if (!prev.size) return prev;
      const stillPending = new Set(
        items.map((row) => String(row?.product || '').trim()).filter(Boolean)
      );
      const next = new Set();
      for (const name of prev) {
        if (stillPending.has(name)) next.add(name);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  useEffect(() => {
    if (!activeKey) return;
    const group = groups.find((g) => g.key === activeKey);
    if (!group || !group.products.length) {
      setActiveKey(null);
      setProductIndex(0);
      return;
    }
    if (productIndex >= group.products.length) {
      setProductIndex(0);
    }
  }, [groups, activeKey, productIndex]);

  if (!pendingItems.length) return null;

  function openGroup(key) {
    setActiveKey(key);
    setProductIndex(0);
  }

  function handleConfirm(mapping) {
    const productKey = String(mapping.product || '').trim();
    const used = mapping.previousYearProducts || [];

    setResolvedProducts((prev) => {
      const next = new Set(prev);
      if (productKey) next.add(productKey);
      return next;
    });
    setClaimedPrevNames((prev) => {
      const next = new Set(prev);
      for (const name of used) {
        const key = String(name || '').trim();
        if (key) next.add(key);
      }
      return next;
    });

    onConfirmMapping?.(mapping);
    auditToastSuccess(`Mapped ${mapping.product}`);

    const remainingInGroup = (activeGroup?.products || []).filter(
      (row) => String(row.product || '').trim() !== productKey
    );

    if (!remainingInGroup.length) {
      setActiveKey(null);
      setProductIndex(0);
      return;
    }

    // After local filter removes the mapped product, index 0 is the next pending product.
    setProductIndex(0);
  }

  return (
    <div className="rounded-xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-violet-950 dark:text-violet-100">
            Manual Opening Stock Mapping
          </h4>
          <p className="mt-0.5 text-xs text-violet-900/80 dark:text-violet-200/80">
            Map one subcategory at a time. Select previous-year products until Qty matches exactly.
          </p>
        </div>
        <p className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold tabular-nums text-violet-900 dark:bg-slate-900/50 dark:text-violet-100">
          {pendingItems.length} products remaining
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-violet-200/70 bg-white/90 dark:border-violet-900/40 dark:bg-slate-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-violet-50/80 text-xs uppercase tracking-wide text-slate-500 dark:bg-violet-950/30 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Subcategory</th>
              <th className="px-3 py-2 font-medium">Pending Products</th>
              <th className="px-3 py-2 font-medium text-right">Map</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr
                key={group.key}
                className="border-t border-violet-100/80 dark:border-violet-900/30"
              >
                <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                  {group.label}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">
                  {group.products.length}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button type="button" size="sm" onClick={() => openGroup(group.key)}>
                    Map
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MappingModal
        open={Boolean(activeGroup)}
        group={activeGroup}
        productIndex={Math.min(productIndex, Math.max((activeGroup?.products.length || 1) - 1, 0))}
        claimedPrevNames={claimedPrevNames}
        onClose={() => {
          setActiveKey(null);
          setProductIndex(0);
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
