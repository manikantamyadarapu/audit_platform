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
  
  // Close dropdown when clicking outside
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
      {/* Left side: Page size dropdown + Total count */}
      <div className="flex items-center gap-4">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <span>{pageSize} Per Page</span>
            <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
          </button>
          
          {isOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPageSize(size)}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm transition-colors',
                    pageSize === size
                      ? 'bg-slate-100 font-medium text-emerald-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {size} Per Page
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Total count beside dropdown */}
        <p className="text-sm font-semibold text-slate-700">
          {totalLabel}: {totalRows.toLocaleString()}
        </p>
      </div>
      
      {/* Right side: Page info + Prev/Next buttons */}
      <div className="flex items-center gap-4">
        <p className="text-sm text-slate-500">
          Page <span className="font-medium text-slate-700">{pageIndex + 1}</span> of{' '}
          <span className="font-medium text-slate-700">{pageCount}</span>
        </p>
        
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
              table.getCanPreviousPage()
                ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
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
                ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
