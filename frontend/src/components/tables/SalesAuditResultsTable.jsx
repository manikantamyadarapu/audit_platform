import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDownUp, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { exportRowsToCsv } from '../../utils/csvExport';

function salesGlobalFilter(row, _columnId, filterValue) {
  const q = String(filterValue || '').toLowerCase().trim();
  if (!q) return true;
  const r = row.original;
  const blob = [
    r.voucherNo,
    r.salesAccount,
    r.product,
    r.expectedCategory,
    r.predictedCategory,
    r.status,
    ...(Array.isArray(r.issues) ? r.issues : []),
  ]
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
}

export function SalesAuditResultsTable({ data }) {
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo(
    () => [
      {
        accessorKey: 'voucherNo',
        header: 'Voucher No',
        cell: (info) => <span className="font-mono text-sm text-slate-800">{info.getValue() ?? '—'}</span>,
      },
      {
        accessorKey: 'salesAccount',
        header: 'Sales Account',
        cell: (info) => <span className="max-w-[280px] truncate text-sm text-slate-800">{info.getValue() ?? '—'}</span>,
      },
      {
        accessorKey: 'product',
        header: 'Product',
        cell: (info) => <span className="max-w-[240px] truncate text-sm text-slate-800">{info.getValue() ?? '—'}</span>,
      },
      {
        accessorKey: 'expectedCategory',
        header: 'Expected',
        cell: (info) => (
          <span className="font-mono text-xs uppercase text-slate-600">{info.getValue() ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'predictedCategory',
        header: 'Predicted',
        cell: (info) => (
          <span className="font-mono text-xs uppercase text-slate-600">{info.getValue() ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const ok = info.getValue() === 'valid';
          return (
            <Badge tone={ok ? 'emerald' : 'rose'} caps={false} className="text-[10px] font-semibold">
              {ok ? 'Valid' : 'Invalid'}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'issues',
        header: 'Issues',
        enableSorting: false,
        cell: (info) => {
          const issues = info.getValue() || [];
          if (!issues.length) return <span className="text-xs text-slate-400">—</span>;
          return (
            <div className="flex max-w-xs flex-wrap gap-1">
              {issues.map((issue) => (
                <Badge key={issue} tone="amber" caps={false} className="text-[10px] font-medium">
                  {issue}
                </Badge>
              ))}
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: salesGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const exportCsv = () => {
    const cols = [
      { header: 'Voucher No', accessor: (r) => r.voucherNo ?? '' },
      { header: 'Sales Account', accessor: (r) => r.salesAccount ?? '' },
      { header: 'Product', accessor: (r) => r.product ?? '' },
      { header: 'Status', accessor: (r) => r.status ?? '' },
      { header: 'Issues', accessor: (r) => (r.issues || []).join('; ') },
    ];
    exportRowsToCsv(`sales-audit-results-${Date.now()}.csv`, cols, table.getFilteredRowModel().rows.map((r) => r.original));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search voucher, sales account, product, status..."
            className="pl-10"
          />
        </div>
        <Button variant="secondary" size="md" onClick={exportCsv} disabled={!data.length}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 shadow-inner shadow-slate-200/40">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="data-table min-w-[1040px] w-full text-left text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-slate-200/80 bg-slate-50/90">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        'whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500',
                        header.column.getCanSort() && 'cursor-pointer select-none hover:text-slate-800'
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() ? <ArrowDownUp className="h-3.5 w-3.5 opacity-40" /> : null}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16 text-center text-slate-500">
                    No rows match your filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-slate-100/90 transition-colors hover:bg-blue-50/40',
                      i % 2 === 1 && 'bg-slate-50/40'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-slate-500">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1} ·{' '}
          {table.getFilteredRowModel().rows.length} rows
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button variant="secondary" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
