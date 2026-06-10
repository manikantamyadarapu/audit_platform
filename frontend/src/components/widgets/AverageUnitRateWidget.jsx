import { useMemo } from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { formatNumber } from '../../utils/format';
import { BookOpen } from 'lucide-react';

export function AverageUnitRateWidget({ records }) {
  const averageUnitRates = useMemo(() => {
    if (!records || records.length === 0) return [];

    const productGroups = {};

    for (const record of records) {
      const product = record.product?.trim();
      if (!product) continue;

      const grossAmount = record.grossAmount != null && record.grossAmount !== '' ? Number(record.grossAmount) : 0;
      const quantity = record.quantity != null && record.quantity !== '' ? Number(record.quantity) : 0;

      // Skip invalid numbers
      const parsedGross = isNaN(grossAmount) ? 0 : grossAmount;
      const parsedQuantity = isNaN(quantity) ? 0 : quantity;

      if (!productGroups[product]) {
        productGroups[product] = {
          totalGrossAmount: 0,
          totalQuantity: 0,
        };
      }

      productGroups[product].totalGrossAmount += parsedGross;
      productGroups[product].totalQuantity += parsedQuantity;
    }

    const results = [];
    for (const [product, data] of Object.entries(productGroups)) {
      const { totalGrossAmount, totalQuantity } = data;

      // Exclude products where Total Quantity is 0 or null/NaN to avoid division errors
      if (totalQuantity === 0 || totalQuantity == null || isNaN(totalQuantity)) {
        continue;
      }

      const averageRate = totalGrossAmount / totalQuantity;
      results.push({
        product,
        averageRate,
      });
    }

    // Sort alphabetically by product name
    results.sort((a, b) => a.product.localeCompare(b.product));

    return results;
  }, [records]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold text-emerald-700">Average Unit Rate</h3>
          <p className="text-sm text-slate-500">
            Average unit rate grouped by product based on current audit view
          </p>
        </div>
      </CardHeader>
      <CardBody>
        {averageUnitRates.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 shadow-inner shadow-slate-200/40">
            <div className="overflow-y-auto max-h-[350px] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Product
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Average Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white/50">
                  {averageUnitRates.map((row) => (
                    <tr
                      key={row.product}
                      className="transition-colors hover:bg-emerald-50/30"
                    >
                      <td className="px-6 py-3 text-sm font-medium text-slate-800">
                        {row.product}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-mono font-semibold text-slate-900">
                        {formatNumber(row.averageRate, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No valid product data"
            description="Grouped average unit rates will display here once valid product ledger records are loaded."
            className="py-12"
          />
        )}
      </CardBody>
    </Card>
  );
}
