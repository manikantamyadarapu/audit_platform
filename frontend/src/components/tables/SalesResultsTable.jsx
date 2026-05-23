import { Fragment, useMemo, useState } from 'react';
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Search,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { auditIssueTone } from '../../utils/auditIssueTone';
import { exportRowsToCsv } from '../../utils/csvExport';
import { exportRowsToPdf } from '../../utils/pdfExport';
import { SalesRateDebugPanel } from './SalesRateDebugPanel';
import { formatMessages } from '../../utils/salesXlsxExport';

const SALES_EXPORT_COLS = [
  { header: 'Row Num', accessor: (r) => r.rowNumber ?? '' },
  { header: 'Voucher No', accessor: (r) => r.voucherNo ?? '' },
  { header: 'Party / Customer', accessor: (r) => r.partyName ?? '' },
  {
    header: 'sales account',
    accessor: (r) => r.originalExcelSalesAccount ?? r.salesAccount ?? '',
  },
  { header: 'product', accessor: (r) => r.originalExcelProduct ?? r.product ?? '' },
  {
    header: 'unit rate',
    accessor: (r) => r.originalExcelUnitRate ?? r.unitRate ?? r.uploadedUnitRate ?? '',
  },
  { header: 'Issues', accessor: (r) => (r.issues || []).join('; ') },
  {
    header: 'Messages',
    accessor: (r) => formatMessages(r.messages ?? r.rateMessage),
  },
];

function salesGlobalFilter(row, _columnId, filterValue) {
  const q = String(filterValue || '').toLowerCase().trim();
  if (!q) return true;
  const r = row.original;
  const blob = [
    r.rowNumber,
    r.voucherNo,
    r.partyName,
    r.originalExcelSalesAccount,
    r.originalExcelProduct,
    r.salesAccount,
    r.product,
    r.originalExcelUnitRate,
    r.unitRate,
    ...(Array.isArray(r.issues) ? r.issues : []),
    formatMessages(r.messages ?? r.rateMessage),
  ]
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
}

export function SalesResultsTable({ data }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [expandedRowId, setExpandedRowId] = useState(null);

  const columns = useMemo(
    () => [
      {
        id: 'expand',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const id = row.original.rowId ?? row.original.rowNumber;
          const open = expandedRowId === id;
          return (
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? 'Hide rate debug' : 'Show rate debug'}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={() => setExpandedRowId(open ? null : id)}
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
            </button>
          );
        },
      },
      {
        accessorKey: 'rowNumber',
        header: 'Row Num',
        cell: (info) => (
          <span className="font-mono text-sm text-slate-700">{info.getValue()}</span>
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
        accessorKey: 'partyName',
        header: 'Party / Customer',
        cell: (info) => (
          <span className="max-w-[160px] truncate text-sm text-slate-800">{info.getValue() ?? '—'}</span>
        ),
      },
      {
        id: 'salesAccount',
        header: 'sales account',
        accessorFn: (r) => r.originalExcelSalesAccount ?? r.salesAccount ?? '',
        cell: (info) => (
          <span className="max-w-[160px] truncate text-sm text-slate-800">{info.getValue() ?? '—'}</span>
        ),
      },
      {
        id: 'product',
        header: 'product',
        accessorFn: (r) => r.originalExcelProduct ?? r.product ?? '',
        cell: (info) => (
          <span className="max-w-[160px] truncate text-sm text-slate-800">{info.getValue() ?? '—'}</span>
        ),
      },
      {
        id: 'unitRate',
        header: 'unit rate',
        accessorFn: (r) => r.originalExcelUnitRate ?? r.unitRate ?? r.uploadedUnitRate ?? '',
        cell: (info) => (
          <span className="font-mono text-sm text-slate-800">{info.getValue() ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'issues',
        header: 'Issues',
        enableSorting: false,
        cell: (info) => {
          const issues = info.getValue() || [];
          return (
            <div className="flex max-w-[220px] flex-wrap gap-1">
              {issues.map((issue) => (
                <Badge
                  key={issue}
                  tone={auditIssueTone(issue)}
                  caps={false}
                  className="text-[10px] font-medium"
                >
                  {issue.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: 'messages',
        header: 'Messages',
        enableSorting: false,
        accessorFn: (r) => formatMessages(r.messages ?? r.rateMessage),
        cell: (info) => {
          const text = info.getValue();
          if (!text) return <span className="text-slate-400">—</span>;
          return <span className="max-w-md text-sm text-slate-700">{text}</span>;
        },
      },
    ],
    [expandedRowId]
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

  const filteredRows = () => table.getFilteredRowModel().rows.map((r) => r.original);

  const exportCsv = () => {
    exportRowsToCsv(`sales-ledger-results-${Date.now()}.csv`, SALES_EXPORT_COLS, filteredRows());
  };

  const exportPdf = () => {
    exportRowsToPdf(
      `sales-ledger-results-${Date.now()}.pdf`,
      'Sales ledger audit — issue register',
      SALES_EXPORT_COLS,
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
            placeholder="Search voucher, product, issues..."
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
        <div className="scrollbar-thin overflow-x-auto">
          <table className="data-table min-w-[900px] w-full text-left text-sm">
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
                table.getRowModel().rows.map((row, i) => {
                  const id = row.original.rowId ?? row.original.rowNumber;
                  const isOpen = expandedRowId === id;
                  return (
                    <Fragment key={row.id}>
                      <tr
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
                      {isOpen ? (
                        <tr className="border-b border-slate-100/90 bg-slate-50/60">
                          <td colSpan={columns.length} className="px-4 py-3">
                            <SalesRateDebugPanel record={row.original} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
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
