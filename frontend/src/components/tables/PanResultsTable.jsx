import { useCallback, useMemo, useState } from 'react';
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
import { Pagination } from '../ui/Pagination';
import { cn } from '../../utils/cn';
import { exportRowsToCsv } from '../../utils/csvExport';
import { exportRowsToPdf } from '../../utils/pdfExport';

const PAN_EXPORT_COLS = [
  { header: 'Row Number', accessor: (r) => r.rowNumber },
  { header: 'Date', accessor: (r) => r.date ?? '' },
  { header: 'Voucher No', accessor: (r) => r.voucherNo ?? '' },
  { header: 'Party', accessor: (r) => r.party ?? '' },
  { header: 'Issues', accessor: (r) => (r.issues || []).map(formatIssueLabel).join('; ') },
  { header: 'Messages', accessor: (r) => (Array.isArray(r.messages) ? r.messages.join('; ') : '') },
];

const ISSUE_LABELS = {
  MISSING_FORM_60: 'Form 60',
};

function formatIssueLabel(issue) {
  return ISSUE_LABELS[issue] ?? String(issue).replace(/_/g, ' ');
}

function normalizeSearchValue(value) {
  if (value == null) return '';
  const text = Array.isArray(value) ? value.join(' ') : String(value);
  return text.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function valueForColumn(row, column) {
  if (typeof column.accessorFn === 'function') {
    return column.accessorFn(row.original, row.index);
  }
  if (column.accessorKey) {
    return row.original?.[column.accessorKey];
  }
  return '';
}

function getCellClass(key) {
  if (key === 'rowNumber') return 'font-mono text-sm text-slate-700';
  if (key === 'issues') return '';
  if (key === 'messages') return '';
  return 'text-sm text-slate-700';
}

function formatValue(value, key) {
  if (value == null || value === '') return '—';
  if (key === 'issues') {
    if (!Array.isArray(value) || value.length === 0) return <span className="text-slate-400">—</span>;
    // Single-line rendering (no wrapping) for the PAN audit widgets.
    const issues = value.map(formatIssueLabel);
    const text = issues.join('; ');
    return (
      <span className="block max-w-[420px] overflow-hidden text-ellipsis whitespace-nowrap" title={text}>
        {text}
      </span>
    );
  }
  if (key === 'messages') {
    if (!Array.isArray(value) || value.length === 0) return <span className="text-slate-400">—</span>;
    // Single-line rendering (no wrapping) for the PAN audit widgets.
    const text = value.join('; ');
    return (
      <span className="block max-w-[520px] overflow-hidden text-ellipsis whitespace-nowrap" title={text}>
        {text}
      </span>
    );
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function toHeaderLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export function PanResultsTable({ data }) {
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    const allKeys = new Set();
    data.forEach((row) => Object.keys(row).forEach((k) => allKeys.add(k)));
    const priority = ['rowNumber', 'date', 'voucherNo', 'party', 'issues', 'messages'];
    const sortedKeys = [
      ...priority.filter((k) => allKeys.has(k)),
      ...Array.from(allKeys).filter((k) => !priority.includes(k)).sort(),
    ];
    return sortedKeys.map((key) => ({
      accessorKey: key,
      header: toHeaderLabel(key),
      enableSorting: key !== 'issues' && key !== 'messages',
      cell: (info) => {
        const value = info.getValue();
        const formatted = formatValue(value, key);
        return <span className={getCellClass(key)}>{formatted}</span>;
      },
    }));
  }, [data]);

  const panGlobalFilter = useCallback(
    (row, _columnId, filterValue) => {
      const q = normalizeSearchValue(filterValue);
      if (!q) return true;

      const visibleText = columns.map((column) => normalizeSearchValue(valueForColumn(row, column))).join(' ');
      return visibleText.includes(q);
    },
    [columns]
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

  const filteredRows = () => table.getFilteredRowModel().rows.map((r) => r.original);

  const exportCsv = () => {
    exportRowsToCsv(`pan-results-${Date.now()}.csv`, PAN_EXPORT_COLS, filteredRows());
  };

  const exportPdf = () => {
    exportRowsToPdf(`pan-results-${Date.now()}.pdf`, 'PAN audit — issue register', PAN_EXPORT_COLS, filteredRows());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search row, date, voucher, total value, PAN, issues, messages..."
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
                        'whitespace-nowrap overflow-hidden text-ellipsis px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500',
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
                        <div className="whitespace-nowrap overflow-hidden text-ellipsis">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
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
