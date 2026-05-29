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

// Fixed 24 columns for sales audit output
const SALES_TABLE_COLS = [
  { key: 'sNo', header: 'SNo' },
  { key: 'date', header: 'Date' },
  { key: 'voucherNo', header: 'Voucher No' },
  { key: 'nameOfParty', header: 'Name of Party' },
  { key: 'salesAccount', header: 'Sales Account' },
  { key: 'otherAccount', header: 'Other Account' },
  { key: 'product', header: 'Product' },
  { key: 'uom', header: 'UOM' },
  { key: 'quantity', header: 'Quantity' },
  { key: 'freeQuantity', header: 'Free Quantity' },
  { key: 'unitRate', header: 'Unit Rate' },
  { key: 'grossAmount', header: 'Gross Amount' },
  { key: 'cgst', header: 'CGST' },
  { key: 'sgst', header: 'SGST' },
  { key: 'igst', header: 'IGST' },
  { key: 'gstAmount', header: 'GST Amount' },
  { key: 'netAmount', header: 'Net Amount' },
  { key: 'manualGrossWt', header: 'Manual Gross Wt.' },
  { key: 'autoGrossWt', header: 'Auto Gross Wt.' },
  { key: 'differenceInGrossWt', header: 'Difference in Gross wt' },
  { key: 'pan', header: 'PAN' },
  { key: 'addressProof', header: 'Address Proof' },
  { key: 'address', header: 'Address' },
  { key: 'messages', header: 'messages' },
];

// Export columns (same order as table)
const SALES_EXPORT_COLS = SALES_TABLE_COLS.map((c) => ({
  header: c.header,
  accessor: (r) => r[c.key] ?? '',
}));

function salesGlobalFilter(row, _columnId, filterValue) {
  const q = String(filterValue || '').toLowerCase().trim();
  if (!q) return true;
  const r = row.original;
  // Search only the 24 visible columns
  const searchableKeys = SALES_TABLE_COLS.map((c) => c.key);
  const blob = searchableKeys
    .map((k) => {
      const v = r[k];
      if (Array.isArray(v)) return v.join(' ');
      if (typeof v === 'object' && v !== null) return JSON.stringify(v);
      return String(v ?? '');
    })
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
}

function getCellClass(key) {
  if (key === 'sNo') return 'font-mono text-sm text-slate-700';
  if (key === 'messages') return '';
  // Numeric columns
  const numericCols = ['unitRate', 'quantity', 'freeQuantity', 'grossAmount', 'cgst', 'sgst', 'igst', 'gstAmount', 'netAmount', 'manualGrossWt', 'autoGrossWt', 'differenceInGrossWt'];
  if (numericCols.includes(key)) return 'font-mono text-sm text-slate-800 text-right';
  return 'text-sm text-slate-700';
}

function formatValue(value, key) {
  if (value == null || value === '') return '—';
  if (key === 'issues') {
    if (!Array.isArray(value) || value.length === 0) return <span className="text-slate-400">—</span>;
    return (
      <div className="flex max-w-[220px] flex-wrap gap-1">
        {value.map((issue) => (
          <Badge key={issue} tone={auditIssueTone(issue)} caps={false} className="text-[10px] font-medium">
            {issue.replace(/_/g, ' ')}
          </Badge>
        ))}
      </div>
    );
  }
  if (key === 'messages') {
    const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
    if (!text) return <span className="text-slate-400">—</span>;
    return <span className="max-w-md text-sm text-slate-700">{text}</span>;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function SalesResultsTable({ data }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [expandedRowId, setExpandedRowId] = useState(null);

  const columns = useMemo(() => {
    // Fixed 24 columns - no dynamic generation
    const fixedCols = SALES_TABLE_COLS.map((col) => ({
      accessorKey: col.key,
      header: col.header,
      enableSorting: col.key !== 'messages',
      cell: (info) => {
        const value = info.getValue();
        const formatted = formatValue(value, col.key);
        return <span className={getCellClass(col.key)}>{formatted}</span>;
      },
    }));
    // Prepend expand column
    return [
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
      ...fixedCols,
    ];
  }, [expandedRowId]);

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
