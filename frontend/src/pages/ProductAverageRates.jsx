import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowLeft, Download, Loader2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import {
  exportProductAverageRates,
  fetchProductAverageRates,
} from '../services/sales.service';
import { formatNumber } from '../utils/format';
import { loadAuditSession, saveAuditSession } from '../utils/auditSessionStorage';

const PAGE_SIZE = 25;
const UI_SESSION_KEY = 'product-average-rates-ui';

function readUiSession() {
  return loadAuditSession(UI_SESSION_KEY)?.data ?? null;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function ProductAverageRates() {
  const [searchParams] = useSearchParams();
  const auditType =
    String(searchParams.get('auditType') || 'SALES').toUpperCase() === 'PURCHASE'
      ? 'PURCHASE'
      : 'SALES';
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(() => readUiSession()?.page ?? 1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(() => readUiSession()?.search ?? '');
  const [salesAccountFilter, setSalesAccountFilter] = useState(
    () => readUiSession()?.salesAccountFilter ?? ''
  );
  const [debouncedSearch, setDebouncedSearch] = useState(() => readUiSession()?.search ?? '');
  const [debouncedSalesAccount, setDebouncedSalesAccount] = useState(
    () => readUiSession()?.salesAccountFilter ?? ''
  );
  const [sorting, setSorting] = useState(
    () => readUiSession()?.sorting ?? [{ id: 'createdAt', desc: true }]
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSalesAccount(salesAccountFilter.trim()), 300);
    return () => clearTimeout(timer);
  }, [salesAccountFilter]);

  const sortBy = sorting[0]?.id || 'createdAt';
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc';

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchProductAverageRates({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        salesAccount: debouncedSalesAccount || undefined,
        sortBy,
        sortOrder,
        auditType,
      });
      setRows(result.rows);
      setMeta(result.meta ?? null);
      setTotal(result.pagination.total ?? 0);
      setTotalPages(result.pagination.totalPages ?? 1);
    } catch (error) {
      toast.error(error.message || 'Failed to load product average rates');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, debouncedSalesAccount, sortBy, sortOrder, auditType]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedSalesAccount, sortBy, sortOrder]);

  useEffect(() => {
    saveAuditSession(UI_SESSION_KEY, {
      page,
      search: debouncedSearch,
      salesAccountFilter: debouncedSalesAccount,
      sorting,
    });
  }, [page, debouncedSearch, debouncedSalesAccount, sorting]);

  const columns = useMemo(
    () => [
      { accessorKey: 'product', header: 'Product' },
      { accessorKey: 'salesAccount', header: 'Sales Account' },
      {
        accessorKey: 'totalQuantity',
        header: 'Total Quantity',
        cell: ({ getValue }) => formatNumber(getValue(), 4),
      },
      {
        accessorKey: 'totalGrossAmount',
        header: 'Total Gross Amount',
        cell: ({ getValue }) => formatNumber(getValue(), 2),
      },
      {
        accessorKey: 'averageRate',
        header: 'Average Unit Rate',
        cell: ({ getValue }) => formatNumber(getValue(), 4),
      },
      {
        accessorKey: 'transactionCount',
        header: 'Transaction Count',
        cell: ({ getValue }) => formatNumber(getValue()),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created Date',
        cell: ({ getValue }) => formatDate(getValue()),
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportProductAverageRates({
        search: debouncedSearch || undefined,
        salesAccount: debouncedSalesAccount || undefined,
        sortBy,
        sortOrder,
        auditType,
      });
      toast.success('Export downloaded');
    } catch (error) {
      toast.error(error.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/scrutiny/sales-ledger"
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sales Audit
          </Link>
          <h2 className="text-2xl font-bold text-slate-900">Product Average Rates</h2>
          <p className="mt-1 text-sm text-slate-500">
            One average per individual product SKU using SUM(Gross Amount) ÷ SUM(Quantity). Not grouped
            by category or sales account.
          </p>
          {meta?.fileName ? (
            <p className="mt-1 text-xs text-slate-500">
              Latest audit: {meta.fileName}
              {meta.verification?.totalDistinctProducts != null
                ? ` · ${formatNumber(meta.verification.totalDistinctProducts)} distinct products`
                : ''}
            </p>
          ) : null}
        </div>
        <Button variant="primary" size="md" loading={exporting} disabled={exporting} onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {meta?.verification ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-bold text-emerald-700">Verification summary</h3>
            <p className="text-sm text-slate-500">
              Distinct product SKU counts from the latest sales audit — not category-level averages.
            </p>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat label="Total rows processed" value={meta.verification.totalRowsProcessed} />
              <SummaryStat label="Total distinct products" value={meta.verification.totalDistinctProducts} />
              <SummaryStat label="DI. RA products" value={meta.verification.diRaProducts} />
              <SummaryStat label="DI. RC products" value={meta.verification.diRcProducts} />
              <SummaryStat label="Flat Polki products" value={meta.verification.flatPolkiProducts} />
              <SummaryStat label="Gold products" value={meta.verification.goldProducts} />
              <SummaryStat label="Silver products" value={meta.verification.silverProducts} />
              <SummaryStat label="Emerald products" value={meta.verification.emeraldProducts} />
              <SummaryStat label="Ruby products" value={meta.verification.rubyProducts} />
              <SummaryStat label="Color stone products" value={meta.verification.colorStoneProducts} />
              <SummaryStat label="Pearl products" value={meta.verification.pearlProducts} />
              <SummaryStat label="Other products" value={meta.verification.otherProducts} />
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product or sales account…"
                className="pl-9"
              />
            </div>
            <Input
              value={salesAccountFilter}
              onChange={(e) => setSalesAccountFilter(e.target.value)}
              placeholder="Filter by sales account…"
            />
          </div>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : rows.length ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Showing {rows.length} of {formatNumber(total)} product averages
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-[var(--color-surface-subtle)]">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="cursor-pointer px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <span className="inline-flex items-center gap-1">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {{
                                asc: ' ↑',
                                desc: ' ↓',
                              }[header.column.getIsSorted()] ?? null}
                            </span>
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]">
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="hover:bg-emerald-50/30">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-3 py-2 align-top text-sm text-slate-700">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No product averages yet"
              description="Run a Sales Audit to calculate and store product-wise average unit rates."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
        {formatNumber(value ?? 0)}
      </p>
    </div>
  );
}
