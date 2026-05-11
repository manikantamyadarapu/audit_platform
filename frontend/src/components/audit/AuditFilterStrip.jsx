import { Button } from '../ui/Button';

/**
 * @param {object} props
 * @param {string | null} props.activeFilter
 * @param {Record<string, string>} props.labels
 * @param {number} props.count
 * @param {() => void} props.onClear
 */
export function AuditFilterStrip({ activeFilter, labels, count, onClear }) {
  const label =
    activeFilter != null && labels[activeFilter] != null ? labels[activeFilter] : labels.total;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        <span className="font-medium text-slate-800">Showing: {label}</span>
        <span className="text-slate-500"> · {count} records found</span>
      </p>
      {activeFilter != null ? (
        <Button variant="secondary" size="sm" onClick={onClear}>
          Clear filter
        </Button>
      ) : null}
    </div>
  );
}
