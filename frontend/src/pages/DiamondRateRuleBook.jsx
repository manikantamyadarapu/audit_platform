import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gem, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { fetchDiamondRateRules, saveDiamondRateRules } from '../services/diamondRateRuleService';
import { DIAMOND_RULE_BOOK_EDITABLE_PRODUCTS } from '../constants/diamondRuleBookEditable';
import { formatSavedDateTime } from '../utils/dateTime';

function emptyForm() {
  return Object.fromEntries(DIAMOND_RULE_BOOK_EDITABLE_PRODUCTS.map((p) => [p, { min_rate: '', max_rate: '' }]));
}

function toForm(data) {
  const products = data?.products ?? {};
  const form = emptyForm();
  for (const product of DIAMOND_RULE_BOOK_EDITABLE_PRODUCTS) {
    const spec = products[product] ?? {};
    const min = spec.min_rate;
    const max = spec.max_rate;
    form[product] = {
      min_rate: min == null || min === '' ? '' : String(min),
      max_rate: max == null || max === '' ? '' : String(max),
    };
  }
  return form;
}

function parseRate(raw) {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toPayload(form, upliftPercent, deviationPercent) {
  const products = {};
  for (const product of DIAMOND_RULE_BOOK_EDITABLE_PRODUCTS) {
    const row = form[product] ?? {};
    products[product] = {
      min_rate: parseRate(row.min_rate),
      max_rate: parseRate(row.max_rate),
    };
  }
  return {
    products,
    uplift_percent: upliftPercent,
    deviation_percent: deviationPercent,
  };
}

export default function DiamondRateRuleBook() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [upliftPercent, setUpliftPercent] = useState(25);
  const [deviationPercent, setDeviationPercent] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDiamondRateRules();
      setForm(toForm(data));
      setUpliftPercent(data.uplift_percent ?? 25);
      setDeviationPercent(data.deviation_percent ?? 30);
      setUpdatedAt(data.updated_at ?? null);
    } catch (e) {
      toast.error(e.message || 'Could not load diamond rule book');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (product, field, value) => {
    setForm((f) => ({
      ...f,
      [product]: { ...(f[product] ?? { min_rate: '', max_rate: '' }), [field]: value },
    }));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const data = await saveDiamondRateRules(toPayload(form, upliftPercent, deviationPercent));
      setForm(toForm(data));
      setUpdatedAt(data.updated_at ?? null);
      toast.success('Diamond rule book saved');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Gem className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Scrutiny</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Diamond Rule Book</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Rule-book products only (Chakri, Flat polki FP, selected loose RA, Di. RC 14/30). Di. RA,
              other RC, SD, and Mix use hardcoded sheet ranges in the engine. Audit: +25% then ±30% on
              invoice unit rate.
            </p>
          </div>
        </div>
        {updatedAt ? <p className="text-xs text-slate-500">Last saved: {formatSavedDateTime(updatedAt)}</p> : null}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Rule book ranges</h2>
          <p className="text-sm text-slate-600">
            Edit base min/max, then run{' '}
            <Link to="/scrutiny/sales-ledger" className="font-medium text-violet-700 hover:underline">
              Sales Audit
            </Link>
            .
          </p>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                onSave();
              }}
            >
              <div className="hidden gap-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[minmax(0,1fr)_120px_120px]">
                <span>Product</span>
                <span>Min</span>
                <span>Max</span>
              </div>
              <div className="space-y-3">
                {DIAMOND_RULE_BOOK_EDITABLE_PRODUCTS.map((product) => (
                  <div
                    key={product}
                    className="grid gap-2 border-b border-slate-100 pb-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_120px_120px] sm:items-center sm:gap-3"
                  >
                    <span className="text-sm font-medium text-slate-800">{product}</span>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      aria-label={`${product} min`}
                      placeholder="Min"
                      value={form[product]?.min_rate ?? ''}
                      onChange={(e) => setField(product, 'min_rate', e.target.value)}
                      disabled={saving}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      aria-label={`${product} max`}
                      placeholder="Max"
                      value={form[product]?.max_rate ?? ''}
                      onChange={(e) => setField(product, 'max_rate', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit" disabled={loading || saving} loading={saving}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button type="button" variant="secondary" onClick={load} disabled={loading || saving}>
                  Reload
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
