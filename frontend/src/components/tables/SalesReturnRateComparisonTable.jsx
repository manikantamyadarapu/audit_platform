import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Download, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Pagination } from '../ui/Pagination';
import { auditIssueTone } from '../../utils/auditIssueTone';
import { formatNumber } from '../../utils/format';
import { exportRowsToCsv } from '../../utils/csvExport';

const EXPORT_COLS = [
  { header: 'Product', accessor: (r) => r.product ?? '' },
  { header: 'Sales Total Gross Amount', accessor: (r) => r.salesTotalGrossAmount ?? '' },
  { header: 'Sales Total Quantity', accessor: (r) => r.salesTotalQuantity ?? '' },
  { header: 'Sales Average Rate', accessor: (r) => r.salesAverageRate ?? '' },
  { header: 'Sales Return Total Gross Amount', accessor: (r) => r.returnTotalGrossAmount ?? '' },
  { header: 'Sales Return Total Quantity', accessor: (r) => r.returnTotalQuantity ?? '' },
  { header: 'Sales Return Average Rate', accessor: (r) => r.returnAverageRate ?? '' },
  { header: 'Difference', accessor: (r) => r.difference ?? '' },
  { header: 'Issue', accessor: (r) => (r.issues || []).join('; ') },
  { header: 'Message', accessor: (r) => (r.messages || []).join('; ') },
];

function globalFilter(row, _columnId, filterValue) {
  const q = String(filterValue || '').toLowerCase().trim();
  if (!q) return true;
  const blob = Object.values(row.original)
    .map((v) => (Array.isArray(v) ? v.join(' ') : String(v ?? '')))
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
}

export function SalesReturnRateComparisonTable({ data, onExportXlsx, exporting, showExport = true }) {
  const [globalFilterState, setGlobalFilterState] = useState('');

  const columns = useMemo(
    () => [
      {
        accessorKey: 'product',
        header: 'Product',
        cell: (info) => <span className="text-sm text-slate-800">{info.getValue() || '—'}</span>,
      },
      {
        accessorKey: 'salesTotalGrossAmount',
        header: 'Sales Total Gross Amount',
        cell: (info) => (
          <span className="text-sm tabular-nums text-slate-800">{formatNumber(info.getValue(), 2)}</span>
        ),
      },
      {
        accessorKey: 'salesTotalQuantity',
        header: 'Sales Total Quantity',
        cell: (info) => (
          <span className="text-sm tabular-nums text-slate-800">{formatNumber(info.getValue(), 3)}</span>
        ),
      },
      {
        accessorKey: 'salesAverageRate',
        header: 'Sales Average Rate',
        cell: (info) => (
          <span className="text-sm tabular-nums text-slate-800">{formatNumber(info.getValue(), 2)}</span>
        ),
      },
      {
        accessorKey: 'returnTotalGrossAmount',
        header: 'Sales Return Total Gross Amount',
        cell: (info) => (
          <span className="text-sm tabular-nums text-slate-800">{formatNumber(info.getValue(), 2)}</span>
        ),
      },
      {
        accessorKey: 'returnTotalQuantity',
        header: 'Sales Return Total Quantity',
        cell: (info) => (
          <span className="text-sm tabular-nums text-slate-800">{formatNumber(info.getValue(), 3)}</span>
        ),
      },
      {
        accessorKey: 'returnAverageRate',
        header: 'Sales Return Average Rate',
        cell: (info) => (
          <span className="text-sm tabular-nums text-slate-800">{formatNumber(info.getValue(), 2)}</span>
        ),
      },
      {
        accessorKey: 'difference',
        header: 'Difference',
        cell: (info) => (
          <span className="text-sm tabular-nums text-rose-700">{formatNumber(info.getValue(), 2)}</span>
        ),
      },
      {
        accessorKey: 'issues',
        header: 'Issue',
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
      {
        accessorKey: 'messages',
        header: 'Message',
        cell: (info) => {
          const value = info.getValue();
          if (!Array.isArray(value) || value.length === 0) return <span className="text-slate-400">—</span>;
          return <span className="text-sm text-slate-600">{value.join('; ')}</span>;
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: globalFilterState },
    onGlobalFilterChange: setGlobalFilterState,
    globalFilterFn: globalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const filteredRows = () => table.getFilteredRowModel().rows.map((r) => r.original);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={globalFilterState ?? ''}
            onChange={(e) => setGlobalFilterState(e.target.value)}
            placeholder="Search products…"
            className="pl-9"
          />
        </div>
        {showExport ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              disabled={filteredRows().length === 0}
              onClick={() => exportRowsToCsv(`sales-return-rate-${Date.now()}.csv`, EXPORT_COLS, filteredRows())}
            >
              Export CSV
            </Button>
            {onExportXlsx ? (
              <Button
                variant="primary"
                size="md"
                loading={exporting}
                disabled={exporting || filteredRows().length === 0}
                onClick={onExportXlsx}
              >
                <Download className="h-4 w-4" />
                Export Excel
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/80">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination table={table} />
    </div>
  );
}
