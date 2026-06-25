import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';

const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100];

export function Pagination({
  table,
  totalLabel = 'Total',
  className,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const pageSize = table.getState().pagination.pageSize;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount() || 1;
  const totalRows = table.getFilteredRowModel().rows.length;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const setPageSize = (size) => {
    table.setPageSize(size);
    setIsOpen(false);
  };

  return (
    <div className={cn('flex flex-col items-center justify-between gap-4 sm:flex-row', className)}>
      <div className="flex items-center gap-4">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] shadow-sm transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <span>{pageSize} Per Page</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-[var(--color-text-faint)] transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </button>

          {isOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-40 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] py-1 shadow-[var(--shadow-float)]">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPageSize(size)}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm transition-colors',
                    pageSize === size
                      ? 'bg-[var(--color-surface-subtle)] font-medium text-emerald-600 dark:text-emerald-400'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
                  )}
                >
                  {size} Per Page
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
          {totalLabel}: {totalRows.toLocaleString()}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Page{' '}
          <span className="font-medium text-[var(--color-text-secondary)]">{pageIndex + 1}</span> of{' '}
          <span className="font-medium text-[var(--color-text-secondary)]">{pageCount}</span>
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
              table.getCanPreviousPage()
                ? 'border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)]'
                : 'cursor-not-allowed border-[var(--color-border-soft)] bg-[var(--color-surface-subtle)] text-[var(--color-text-faint)]'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
              table.getCanNextPage()
                ? 'border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)]'
                : 'cursor-not-allowed border-[var(--color-border-soft)] bg-[var(--color-surface-subtle)] text-[var(--color-text-faint)]'
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
