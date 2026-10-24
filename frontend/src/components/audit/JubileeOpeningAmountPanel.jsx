import { useMemo } from 'react';
import { formatNumber } from '../../utils/format';
import { readOpeningStockMappings, saveOpeningStockMapping } from '../../utils/financialsOpeningMappings';
import { OpeningStockManualMappingPanel } from './OpeningStockManualMappingPanel';

const JUBILEE_BRANCH = 'jubilee-hills';

export function loadJubileeOpeningMappings() {
  return readOpeningStockMappings(JUBILEE_BRANCH);
}

export function saveJubileeOpeningMapping(product, previousYearProducts) {
  const names = (Array.isArray(previousYearProducts) ? previousYearProducts : [previousYearProducts])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return saveOpeningStockMapping(JUBILEE_BRANCH, {
    product,
    previousYearProducts: names,
  });
}

export function JubileeOpeningAmountPanel({ match, onConfirm, scopeId = '' }) {
  const rows = useMemo(
    () => (Array.isArray(match?.manualMappingRequiredRows) ? match.manualMappingRequiredRows : []),
    [match]
  );

  if (!match) return null;

  const counts = [
    ['Exact matches', match.exactMatches],
    ['Alphanumeric matches', match.alphanumericMatches],
    ['Core/code matches', match.coreCodeMatches],
    ['Prefix matches', match.prefixMatches],
    ['Quantity-verified matches', match.quantityVerifiedMatches],
    ['Saved mappings reused', match.savedMappingsReused],
    ['Manual mappings required', match.manualMappingRequired],
    ['Quantity mismatches', match.quantityMismatches],
    ['Multiple-candidate matches', match.multipleCandidateMatches],
    ['Still unresolved', match.unresolvedProductCount],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {counts.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-sky-200/70 bg-white/80 px-3 py-2.5 dark:border-sky-900/50 dark:bg-slate-900/40"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {formatNumber(value ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <OpeningStockManualMappingPanel
        scopeId={scopeId}
        rows={rows.map((row) => {
          const category = String(row?.category || '').trim();
          const options = Array.isArray(row?.candidateProducts) ? row.candidateProducts : [];
          return {
            ...row,
            candidateProducts: options.filter((item) => {
              const itemCategory = String(item?.category || '').trim();
              return !category || !itemCategory || itemCategory === category;
            }),
          };
        })}
        candidateScope="category"
        onConfirmMapping={(mapping) => {
          const names = (mapping.previousYearProducts || [])
            .map((item) => String(item || '').trim())
            .filter(Boolean);
          onConfirm?.({
            product: mapping.product,
            category: mapping.category,
            subcategory: mapping.subcategory,
            previousYearProduct: names[0] || '',
            previousYearProducts: names,
            amount: mapping.openingAmt,
          });
        }}
      />
    </div>
  );
}
