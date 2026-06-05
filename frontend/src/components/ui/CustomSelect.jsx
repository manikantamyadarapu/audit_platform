import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export function CustomSelect({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select...',
  disabled = false,
  className,
  triggerClassName,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-200 focus:outline-none',
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)]',
          triggerClassName
        )}
      >
        <span className={selectedOption ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-[var(--color-text-muted)] transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-float)]">
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-sm transition-colors duration-150',
                  value === option.value
                    ? 'bg-[var(--color-surface-subtle)] font-semibold text-emerald-600 dark:text-emerald-400'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
