import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { cn } from '../../utils/cn';

const COLUMNS = [
  { accessorKey: 'rowNumber', header: 'Row Number' },
  { accessorKey: 'voucherNo', header: 'Voucher No' },
  { accessorKey: 'party', header: 'Party' },
  { accessorKey: 'salesReturnAccount', header: 'Sales Return Account' },
  { accessorKey: 'product', header: 'Product' },
  { accessorKey: 'quantity', header: 'Quantity' },
  { accessorKey: 'freeQuantity', header: 'Free Quantity' },
  { accessorKey: 'unitRate', header: 'Unit Rate' },
  { accessorKey: 'grossAmount', header: 'Gross Amount' },
  { accessorKey: 'uom', header: 'UOM' },
  { accessorKey: 'issues', header: 'Issue' },
  { accessorKey: 'messages', header: 'Message' },
];

function cellValue(value) {
  if (value == null || value === '') return '—';
  return String(value);
}

export function SalesReturnExceptionTable({ data, totalCount }) {
  const columns = useMemo(
    () =>
      COLUMNS.map((col) => ({
        ...col,
        cell: ({ getValue }) => (
          <span className="whitespace-pre-wrap break-words text-sm text-slate-700">
            {cellValue(getValue())}
          </span>
        ),
      })),
    []
  );

  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const shown = data?.length ?? 0;
  const total = totalCount ?? shown;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Showing {shown} exception row{shown === 1 ? '' : 's'}
        {total !== shown ? ` of ${total}` : ''}.
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white/80">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50/90">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-emerald-50/30">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      'px-3 py-2 align-top',
                      cell.column.id === 'issues' && 'font-medium text-rose-700',
                      cell.column.id === 'messages' && 'max-w-xs'
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
