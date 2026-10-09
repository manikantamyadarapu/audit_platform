import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatNumber } from '../../utils/format';
import { readSourceAverageRates } from '../../utils/sourceAverageRates';

function subcategoryKey(row) {
  const category = String(row?.category || '').trim() || 'Uncategorized';
  const subcategory = String(row?.subcategory || '').trim() || 'Unspecified';
  const source = String(row?.sourceBranch || '').trim() || 'source';
  return `${category}:::${subcategory}:::${source}`;
}

function subcategoryLabel(row) {
  const category = String(row?.category || '').trim();
  const subcategory = String(row?.subcategory || '').trim();
  const source = String(row?.sourceBranchLabel || row?.sourceBranch || '').trim();
  const sheet = category && subcategory ? `${category} / ${subcategory}` : subcategory || category || 'Unspecified';
  return source ? `${sheet} · ${source}` : sheet;
}

function MappingModal({ open, group, productIndex, claimedNames, onClose, onConfirm }) {
  const products = group?.products || [];
  const current = products[productIndex] || null;
  const [selected, setSelected] = useState('');

  useEffect(() => {
    setSelected('');
  }, [current?.product, current?.sourceBranch, group?.key]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const candidates = useMemo(() => {
    if (!current) return [];
    const rates = readSourceAverageRates();
    const rows = Array.isArray(rates[current.sourceBranch]) ? rates[current.sourceBranch] : [];
    const category = String(current.category || '').trim();
    return rows.filter((row) => {
      const name = String(row?.product || '').trim();
      const rowCategory = String(row?.category || '').trim();
      if (!name || claimedNames.has(name)) return false;
      if (category && rowCategory && rowCategory !== category) return false;
      return row.averageRateAmt != null && row.averageRateAmt !== '';
    });
  }, [claimedNames, current]);

  const selectedRow = candidates.find((row) => String(row.product || '').trim() === selected) || null;
  const receiptQty = Number(current?.receiptQty);
  const selectedRate = selectedRow ? Number(selectedRow.averageRateAmt) : null;
  const amount =
    selectedRate != null && Number.isFinite(receiptQty) ? receiptQty * selectedRate : null;

  if (!open || !current || !group) return null;

  function confirm() {
    if (!selectedRow) return;
    onConfirm?.({
      product: current.product,
      category: current.category || null,
      subcategory: current.subcategory || null,
      column: current.column || null,
      sourceBranch: current.sourceBranch,
      sourceBranchLabel: current.sourceBranchLabel || current.sourceBranch,
      sourceProduct: selectedRow.product,
      averageRateAmt: Number(selectedRow.averageRateAmt),
      receiptQty: current.receiptQty ?? null,
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
              Map Average Rate
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
          <p className="mt-2 text-xs text-slate-500">
            {current.column} receipt qty · {current.sourceBranchLabel || current.sourceBranch}
          </p>
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatNumber(current.receiptQty ?? 0, 4)}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {current.sourceBranchLabel || 'Source'} products
          </p>
          <p className="text-xs text-slate-500">
            Select the same product from {current.category || 'this sheet'} on{' '}
            {current.sourceBranchLabel || 'the source branch'}. The receipt amount is this qty
            times that Average Rate.
          </p>
          {candidates.length ? (
            <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {candidates.map((row) => {
                  const name = String(row.product || '').trim();
                  return (
                    <li key={`${row.category || 'sheet'}-${name}`}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/80">
                        <input
                          type="checkbox"
                          checked={selected === name}
                          onChange={() => setSelected(selected === name ? '' : name)}
                        />
                        <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                          {name}
                        </span>
                        <span className="text-xs tabular-nums text-slate-500">
                          Rate {formatNumber(row.averageRateAmt ?? 0, 4)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              No Average Rate products left in {current.category || 'this sheet'} for{' '}
              {current.sourceBranchLabel || 'the source branch'}.
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/50">
            <p className="text-[11px] text-slate-500">Receipt Qty</p>
            <p className="font-semibold tabular-nums">{formatNumber(current.receiptQty ?? 0, 4)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/50">
            <p className="text-[11px] text-slate-500">Selected Rate</p>
            <p className="font-semibold tabular-nums">
              {selectedRate == null ? '—' : formatNumber(selectedRate, 4)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/50">
            <p className="text-[11px] text-slate-500">Receipt Amount</p>
            <p className="font-semibold tabular-nums">
              {amount == null ? '—' : formatNumber(amount, 2)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="button" size="sm" disabled={!selectedRow} onClick={confirm}>
            Confirm Mapping
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ReceiptRateManualMappingPanel({ rows, onConfirmMapping }) {
  const items = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const [activeKey, setActiveKey] = useState(null);
  const [productIndex, setProductIndex] = useState(0);
  const [claimedNames, setClaimedNames] = useState(() => new Set());

  const pendingItems = useMemo(
    () => items.filter((row) => String(row?.product || '').trim()),
    [items]
  );

  const groups = useMemo(() => {
    const map = new Map();
    for (const row of pendingItems) {
      const key = subcategoryKey(row);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: subcategoryLabel(row),
          products: [],
        });
      }
      map.get(key).products.push(row);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [pendingItems]);

  const activeGroup = useMemo(
    () => groups.find((group) => group.key === activeKey) || null,
    [groups, activeKey]
  );

  useEffect(() => {
    if (!activeKey) return;
    const group = groups.find((item) => item.key === activeKey);
    if (!group || !group.products.length) {
      setActiveKey(null);
      setProductIndex(0);
    } else if (productIndex >= group.products.length) {
      setProductIndex(0);
    }
  }, [groups, activeKey, productIndex]);

  if (!pendingItems.length) return null;

  function handleConfirm(mapping) {
    setClaimedNames((prev) => {
      const next = new Set(prev);
      if (mapping.sourceProduct) next.add(String(mapping.sourceProduct).trim());
      return next;
    });
    onConfirmMapping?.(mapping);
    const remaining = (activeGroup?.products || []).filter(
      (row) =>
        !(
          String(row.product || '').trim() === String(mapping.product || '').trim() &&
          String(row.sourceBranch || '') === String(mapping.sourceBranch || '')
        )
    );
    if (!remaining.length) {
      setActiveKey(null);
      setProductIndex(0);
      return;
    }
    setProductIndex(0);
  }

  return (
    <div className="rounded-xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-violet-950 dark:text-violet-100">
            Manual Average Rate Mapping
          </h4>
          <p className="mt-0.5 text-xs text-violet-900/80 dark:text-violet-200/80">
            Map one subcategory at a time when the receipt product name does not match the source
            branch. The amount is receipt qty times the selected Average Rate.
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
              <tr key={group.key} className="border-t border-violet-100/80 dark:border-violet-900/30">
                <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                  {group.label}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">
                  {group.products.length}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button type="button" size="sm" onClick={() => { setActiveKey(group.key); setProductIndex(0); }}>
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
        claimedNames={claimedNames}
        onClose={() => {
          setActiveKey(null);
          setProductIndex(0);
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
