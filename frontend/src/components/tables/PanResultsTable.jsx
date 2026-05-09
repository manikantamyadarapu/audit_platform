import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { formatNumber, effectivePan } from '../../utils/format';
import { exportRowsToCsv } from '../../utils/csvExport';

function issueTone(code) {
  if (code?.includes('MISSING')) return 'amber';
  if (code?.includes('INVALID')) return 'rose';
  return 'blue';
}

function panGlobalFilter(row, _columnId, filterValue) {
  const q = String(filterValue || '').toLowerCase().trim();
  if (!q) return true;
  const r = row.original;
  const blob = [
    r.rowNumber,
    r.date,
    r.voucherNo,
    r.party,
    r.totalValue,
    r.pan,
    r.pan1,
    ...(Array.isArray(r.issues) ? r.issues : []),
    ...(Array.isArray(r.messages) ? r.messages : []),
  ]
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
}

export function PanResultsTable({ data }) {
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo(
    () => [
      {
        accessorKey: 'rowNumber',
        header: 'Row',
        cell: (info) => (
          <span className="font-mono text-sm text-slate-700">{info.getValue()}</span>
        ),
      },
      {
        accessorKey: 'date',
        header: 'Date',
        cell: (info) => (
          <span className="text-sm text-slate-700">{info.getValue() ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'voucherNo',
        header: 'Voucher No',
        cell: (info) => (
          <span className="text-sm text-slate-700">{info.getValue() ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'party',
        header: 'Party',
        cell: (info) => (
          <span className="max-w-[200px] truncate text-sm text-slate-800">{info.getValue() ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'totalValue',
        header: 'Total Value',
        cell: (info) => (
          <span className="font-mono text-sm text-slate-800">{formatNumber(info.getValue())}</span>
        ),
      },
      {
        id: 'effectivePan',
        header: 'Effective PAN',
        accessorFn: (row) => effectivePan(row),
        cell: (info) => (
          <span className="font-mono text-xs uppercase tracking-wide text-slate-800">
            {info.getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'issues',
        header: 'Issues',
        enableSorting: false,
        cell: (info) => {
          const issues = info.getValue() || [];
          return (
            <div className="flex flex-wrap gap-1">
              {issues.map((issue) => (
                <Badge key={issue} tone={issueTone(issue)} caps={false} className="text-[10px] font-medium">
                  {issue.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        accessorKey: 'messages',
        header: 'Messages',
        enableSorting: false,
        cell: (info) => {
          const msgs = info.getValue();
          if (!Array.isArray(msgs) || msgs.length === 0) return <span className="text-slate-400">—</span>;
          return (
            <ul className="max-w-xs list-disc space-y-1 pl-4 text-xs text-slate-700">
              {msgs.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
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
    globalFilterFn: panGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const exportCsv = () => {
    const cols = [
      { header: 'Row Number', accessor: (r) => r.rowNumber },
      { header: 'Date', accessor: (r) => r.date ?? '' },
      { header: 'Voucher No', accessor: (r) => r.voucherNo ?? '' },
      { header: 'Party', accessor: (r) => r.party ?? '' },
      { header: 'Total Value', accessor: (r) => r.totalValue ?? '' },
      { header: 'PAN', accessor: (r) => r.pan ?? '' },
      { header: 'PAN1', accessor: (r) => r.pan1 ?? '' },
      { header: 'Issues', accessor: (r) => (r.issues || []).join('; ') },
      { header: 'Messages', accessor: (r) => (Array.isArray(r.messages) ? r.messages.join('; ') : '') },
    ];
    exportRowsToCsv(`pan-results-${Date.now()}.csv`, cols, table.getFilteredRowModel().rows.map((r) => r.original));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search party, voucher, PAN, issues..."
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
          <table className="data-table min-w-[880px] w-full text-left text-sm">
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
                        {header.column.getCanSort() ? (
                          <ArrowDownUp className="h-3.5 w-3.5 opacity-40" />
                        ) : null}
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
                      'border-b border-slate-100/90 transition-colors hover:bg-emerald-50/35',
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
          <Button
            variant="secondary"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
