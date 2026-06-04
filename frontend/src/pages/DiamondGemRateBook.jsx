import { useEffect, useMemo, useState } from 'react';
import { Save, RefreshCw, Diamond } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { cn } from '../utils/cn';
import { formatNumber } from '../utils/format';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function DiamondGemRateBook() {
  const [activeTab, setActiveTab] = useState('diamonds');
  const [diamondRates, setDiamondRates] = useState({});
  const [originalDiamonds, setOriginalDiamonds] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [upliftPercent, setUpliftPercent] = useState(25);
  const [deviationPercent, setDeviationPercent] = useState(15);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const diamondRes = await fetch(`${API_BASE}/api/rate-book/diamonds`);

      if (!diamondRes.ok) {
        throw new Error('Failed to fetch rates');
      }

      const diamondData = await diamondRes.json();

      if (diamondData.success) {
        setDiamondRates(diamondData.products || {});
        setOriginalDiamonds(diamondData.products || {});
        setUpliftPercent(diamondData.uplift_percent || 25);
        setDeviationPercent(diamondData.deviation_percent || 15);
      }
    } catch (error) {
      toast.error('Failed to load rates: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleGemstoneChange = (account, slab, value) => {
    setGemstoneRates((prev) => ({
      ...prev,
      [account]: {
        ...prev[account],
        slabs: {
          ...prev[account]?.slabs,
          [slab]: value === '' ? null : parseFloat(value),
        },
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const [diamondRes, gemRes] = await Promise.all([
        fetch(`${API_BASE}/api/rate-book/diamonds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            products: diamondRates,
            uplift_percent: upliftPercent,
            deviation_percent: deviationPercent,
          }),
        }),
        fetch(`${API_BASE}/api/rate-book/gemstones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accounts: gemstoneRates,
            deviation_percent: gemstoneDeviation,
          }),
        }),
      ]);

      if (!diamondRes.ok || !gemRes.ok) {
        throw new Error('Failed to save rates');
      }

      const diamondData = await diamondRes.json();
      const gemData = await gemRes.json();

      if (diamondData.success && gemData.success) {
        toast.success('Rates saved successfully! Changes will reflect in audits immediately.', {
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          duration: 4000,
        });
        setOriginalDiamonds(diamondRates);
        setOriginalGemstones(gemstoneRates);
        setHasChanges(false);
      } else {
        throw new Error('Save returned unsuccessful');
      }
    } catch (error) {
      toast.error('Failed to save: ' + error.message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDiamondRates(originalDiamonds);
    setHasChanges(false);
    toast('Changes reset to last saved values', { icon: '↩️' });
  };

  const diamondProducts = useMemo(() => {
    return Object.entries(diamondRates).sort((a, b) => a[0].localeCompare(b[0]));
  }, [diamondRates]);


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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Diamond & Gemstone Rate Book</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage all diamond and gemstone rates. Changes reflect immediately in sales audits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertCircle className="h-4 w-4" />
              <span>Unsaved changes</span>
            </div>
          )}
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('diamonds')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'diamonds'
              ? 'border-b-2 border-emerald-600 text-emerald-700'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Diamond className="h-4 w-4" />
          Diamonds ({diamondProducts.length})
        </button>
      </div>

      {/* Global Settings */}
      {activeTab === 'diamonds' && (
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Uplift %</label>
            <p className="text-xs text-slate-500">Applied to base rates before deviation</p>
            <Input
              type="number"
              value={upliftPercent}
              onChange={(e) => {
                setUpliftPercent(parseInt(e.target.value) || 0);
                setHasChanges(true);
              }}
              className="mt-1 w-32"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Deviation %</label>
            <p className="text-xs text-slate-500">Allowed ±% from uplifted rates</p>
            <Input
              type="number"
              value={deviationPercent}
              onChange={(e) => {
                setDeviationPercent(parseInt(e.target.value) || 0);
                setHasChanges(true);
              }}
              className="mt-1 w-32"
            />
          </div>
        </div>
      )}

      {/* Diamond Rates Table */}
      {activeTab === 'diamonds' && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Product</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Min Rate (₹)</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Max Rate (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {diamondProducts.map(([name, rates]) => (
                  <tr key={name} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{name}</td>
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
      )}

    </div>
  );
}
