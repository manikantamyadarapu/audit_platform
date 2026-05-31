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
  Download,
  FileText,
  Search,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Pagination } from '../ui/Pagination';
import { cn } from '../../utils/cn';
import { formatNumber } from '../../utils/format';
import { auditIssueTone } from '../../utils/auditIssueTone';
import { exportRowsToCsv } from '../../utils/csvExport';
import { exportRowsToPdf } from '../../utils/pdfExport';

const GROSS_EXPORT_COLS = [
  { header: 'SNo', accessor: (r) => r.rowNumber },
  { header: 'Voucher No', accessor: (r) => r.voucherNo ?? '' },
  { header: 'Manual Gross Wt.', accessor: (r) => r.manualGrossWeight ?? '' },
  { header: 'Auto Gross Wt.', accessor: (r) => r.autoGrossWeight ?? '' },
  { header: 'Difference in Gross Wt.', accessor: (r) => r.difference ?? '' },
  { header: 'Issue', accessor: (r) => (r.issues || []).join('; ') },
];

function grossGlobalFilter(row, _columnId, filterValue) {
  const q = String(filterValue || '').toLowerCase().trim();
  if (!q) return true;
  const r = row.original;
  const blob = Object.values(r)
    .map((v) => {
      if (Array.isArray(v)) return v.join(' ');
      if (typeof v === 'object' && v !== null) return JSON.stringify(v);
      return String(v ?? '');
    })
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
}

export function GrossWeightResultsTable({ data }) {
  const [globalFilter, setGlobalFilter] = useState('');

  // Static 6-column layout: SNo | Voucher No | Manual Gross Wt. | Auto Gross Wt. | Difference in Gross Wt. | Issue
  const columns = useMemo(() => [
    {
      accessorKey: 'rowNumber',
      header: 'SNo',
      enableSorting: true,
      cell: (info) => <span className="text-sm text-slate-700" style={{ fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif", fontVariantNumeric: 'tabular-nums' }}>{info.getValue()}</span>,
    },
    {
      accessorKey: 'voucherNo',
      header: 'Voucher No',
      enableSorting: true,
      cell: (info) => <span className="text-sm text-slate-700">{info.getValue() || '—'}</span>,
    },
    {
      accessorKey: 'manualGrossWeight',
      header: 'Manual Gross Wt.',
      enableSorting: true,
      cell: (info) => <span className="text-sm text-slate-800" style={{ fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif", fontVariantNumeric: 'tabular-nums' }}>{formatNumber(info.getValue())}</span>,
    },
    {
      accessorKey: 'autoGrossWeight',
      header: 'Auto Gross Wt.',
      enableSorting: true,
      cell: (info) => <span className="text-sm text-slate-800" style={{ fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif", fontVariantNumeric: 'tabular-nums' }}>{formatNumber(info.getValue())}</span>,
    },
    {
      accessorKey: 'difference',
      header: 'Difference in Gross Wt.',
      enableSorting: true,
      cell: (info) => <span className="text-sm text-slate-800" style={{ fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif", fontVariantNumeric: 'tabular-nums' }}>{formatNumber(info.getValue())}</span>,
    },
    {
      accessorKey: 'issues',
      header: 'Issue',
      enableSorting: false,
      cell: (info) => {
        const value = info.getValue();
        if (!Array.isArray(value) || value.length === 0) return <span className="text-slate-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((issue) => (
              <Badge key={issue} tone={auditIssueTone(issue)} caps={false} className="text-[10px] font-medium">
                {issue.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        );
      },
    },
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: grossGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const filteredRows = () => table.getFilteredRowModel().rows.map((r) => r.original);

  const exportCsv = () => {
    exportRowsToCsv(`gross-weight-results-${Date.now()}.csv`, GROSS_EXPORT_COLS, filteredRows());
  };

  const exportPdf = () => {
    exportRowsToPdf(
      `gross-weight-results-${Date.now()}.pdf`,
      'Gross weight audit — issue register',
      GROSS_EXPORT_COLS,
      filteredRows()
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search SNo, voucher, manual gross, auto gross, difference, issue..."
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="md" onClick={exportCsv} disabled={!data.length}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="secondary" size="md" onClick={exportPdf} disabled={!data.length}>
            <FileText className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 shadow-inner shadow-slate-200/40">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
          <table className="data-table min-w-max w-full text-left text-sm">
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

      <Pagination table={table} totalLabel="Total" />
    </div>
  );
}
