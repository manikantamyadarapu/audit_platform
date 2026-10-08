import { readSourceAverageRates } from '../../utils/sourceAverageRates';

const BRANCH_LABELS = {
  basheerbagh: 'Basheerbagh',
  kokapet: 'Kokapet',
  jubileeHills: 'Jubilee Hills',
};

/**
 * Shows which other branches already saved Average Rates in this browser session.
 * Processing still sends the same saved rates; this only explains the existing link.
 */
export function SourceAverageRatesHint({ branch }) {
  const saved = readSourceAverageRates();
  const names = Object.entries(saved)
    .filter(([key, rows]) => key !== branch && Array.isArray(rows) && rows.length > 0)
    .map(([key]) => BRANCH_LABELS[key] || key);

  if (!names.length) return null;

  return (
    <p className="mt-2 max-w-3xl text-sm text-emerald-800 dark:text-emerald-300">
      Receipt amounts on this page use Average Rates already saved from {names.join(' and ')}.
    </p>
  );
}
