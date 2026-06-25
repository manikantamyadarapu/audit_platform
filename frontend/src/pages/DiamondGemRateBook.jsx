import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, RefreshCw, Diamond } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { fetchDiamondRates, saveDiamondRates } from '../services/rateBookService';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';

export default function DiamondGemRateBook() {
  const [diamondRates, setDiamondRates] = useState({});
  const [originalDiamonds, setOriginalDiamonds] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [upliftPercent, setUpliftPercent] = useState(25);
  const [deviationPercent, setDeviationPercent] = useState(15);

  const loadRates = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const diamondData = await fetchDiamondRates();
      if (diamondData.success) {
        setDiamondRates(diamondData.products || {});
        setOriginalDiamonds(diamondData.products || {});
        setUpliftPercent(diamondData.uplift_percent || 25);
        setDeviationPercent(diamondData.deviation_percent || 15);
      } else {
        throw new Error('Failed to fetch rates');
      }
    } catch (error) {
      const message = error.message || 'Failed to load rates';
      setLoadError(message);
      auditToastError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const handleDiamondChange = (productKey, field, value) => {
    setDiamondRates((prev) => ({
      ...prev,
      [productKey]: {
        ...prev[productKey],
        [field]: value === '' ? null : parseFloat(value),
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const diamondData = await saveDiamondRates({
        products: diamondRates,
        uplift_percent: upliftPercent,
        deviation_percent: deviationPercent,
      });

      if (!diamondData.success) {
        throw new Error('Save returned unsuccessful');
      }

      auditToastSuccess('Rates saved. Changes will reflect in audits immediately.');
      setOriginalDiamonds(diamondRates);
      setHasChanges(false);
    } catch (error) {
      auditToastError(error.message || 'Failed to save rates');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDiamondRates(originalDiamonds);
    setHasChanges(false);
    auditToastSuccess('Changes reset to last saved values');
  };

  const diamondProducts = useMemo(
    () => Object.entries(diamondRates).sort((a, b) => a[0].localeCompare(b[0])),
    [diamondRates]
  );

  if (loadError) {
    return (
      <EmptyState
        icon={Diamond}
        title="Could not load rate book"
        description={loadError}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="ml-3 text-slate-600">Loading rate book...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Diamond & Gemstone Rate Book
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage diamond rates. Changes reflect immediately in sales audits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges ? (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              Unsaved changes
            </div>
          ) : null}
          <Button variant="secondary" onClick={handleReset} disabled={!hasChanges || saving}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={!hasChanges}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Uplift %</label>
          <p className="text-xs text-slate-500">Applied to base rates before deviation</p>
          <Input
            type="number"
            value={upliftPercent}
            onChange={(e) => {
              setUpliftPercent(parseInt(e.target.value, 10) || 0);
              setHasChanges(true);
            }}
            className="mt-1 w-32"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Deviation %</label>
          <p className="text-xs text-slate-500">Allowed ±% from uplifted rates</p>
          <Input
            type="number"
            value={deviationPercent}
            onChange={(e) => {
              setDeviationPercent(parseInt(e.target.value, 10) || 0);
              setHasChanges(true);
            }}
            className="mt-1 w-32"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-subtle)]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-secondary)]">Product</th>
              <th className="px-4 py-3 text-right font-semibold text-[var(--color-text-secondary)]">Min Rate (₹)</th>
              <th className="px-4 py-3 text-right font-semibold text-[var(--color-text-secondary)]">Max Rate (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]">
            {diamondProducts.map(([name, rates]) => (
              <tr key={name} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{name}</td>
                <td className="px-4 py-3 text-right">
                  <Input
                    type="number"
                    value={rates.min_rate ?? ''}
                    onChange={(e) => handleDiamondChange(name, 'min_rate', e.target.value)}
                    placeholder="0"
                    className="w-32 text-right"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <Input
                    type="number"
                    value={rates.max_rate ?? ''}
                    onChange={(e) => handleDiamondChange(name, 'max_rate', e.target.value)}
                    placeholder="0"
                    className="w-32 text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
