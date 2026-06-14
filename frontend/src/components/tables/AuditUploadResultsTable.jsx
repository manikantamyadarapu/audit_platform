import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { Input } from '../ui/Input';
import { Pagination } from '../ui/Pagination';
import {
  auditCellValue,
  columnHeaderLabel,
  resolveAuditColumnOrder,
} from '../../utils/auditTableColumns';

function globalFilter(row, _columnId, filterValue) {
  const q = String(filterValue || '').toLowerCase().trim();
  if (!q) return true;
  const blob = Object.values(row.original)
    .map((v) => (Array.isArray(v) ? v.join(' ') : String(v ?? '')))
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
}

export function AuditUploadResultsTable({
  data = [],
  columnOrder = null,
  exportColumns = null,
  columnDisplayHeaders = null,
  searchPlaceholder = 'Search rows…',
}) {
  const [globalFilterState, setGlobalFilterState] = useState('');

  const resolvedOrder = useMemo(
    () =>
      columnOrder?.length
        ? columnOrder
        : resolveAuditColumnOrder(data, exportColumns, columnDisplayHeaders),
    [data, columnOrder, exportColumns, columnDisplayHeaders]
  );

  const columns = useMemo(() => {
    if (!data.length || !resolvedOrder.length) return [];
    return resolvedOrder.map((key) => ({
      accessorKey: key,
      header: columnHeaderLabel(key),
      cell: (info) => {
        const value =
          key === 'Message' || key === 'messages'
            ? auditCellValue(info.row.original, 'Message')
            : auditCellValue(info.row.original, key);
        if (value === '') {
          return <span className="text-[var(--color-text-faint)]">—</span>;
        }
        return (
          <span className="block max-w-[320px] whitespace-normal text-sm text-[var(--color-text-primary)]">
            {value}
          </span>
        );
      },
    }));
  }, [data, resolvedOrder]);

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

  if (!data.length) return null;

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-faint)]" />
        <Input
          value={globalFilterState ?? ''}
          onChange={(e) => setGlobalFilterState(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border-soft)]">
        <table className="min-w-max w-full divide-y divide-slate-200">
          <thead className="bg-[var(--color-surface-subtle)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 bg-[var(--color-surface-elevated)]">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-[var(--color-surface-subtle)]">
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

/** @deprecated Use AuditUploadResultsTable */
export const SalesReturnExceptionTable = AuditUploadResultsTable;
