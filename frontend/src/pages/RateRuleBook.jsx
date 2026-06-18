import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Loader2, Save } from 'lucide-react';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { fetchRateRules, saveRateRules } from '../services/rateRuleService';
import { RULE_BOOK_PRODUCTS, RULE_BOOK_VARIATION_PCT } from '../constants/metalRateRuleBook';
import { formatSavedDateTime } from '../utils/dateTime';

function emptyForm() {
  return Object.fromEntries(RULE_BOOK_PRODUCTS.map((p) => [p, { min: '', max: '' }]));
}

function toForm(data) {
  const next = emptyForm();
  const rates = data?.rates ?? data ?? {};
  for (const product of RULE_BOOK_PRODUCTS) {
    const v = rates[product];
    if (v && typeof v === 'object') {
      next[product] = {
        min: v.min_rate == null || v.min_rate === '' ? '' : String(v.min_rate),
        max: v.max_rate == null || v.max_rate === '' ? '' : String(v.max_rate),
      };
    } else if (v != null && v !== '') {
      next[product] = { min: String(v), max: String(v) };
    }
  }
  return next;
}

function parseRate(raw) {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toPayload(form) {
  const rates = {};
  for (const product of RULE_BOOK_PRODUCTS) {
    const entry = form[product] ?? { min: '', max: '' };
    rates[product] = {
      min_rate: parseRate(entry.min),
      max_rate: parseRate(entry.max),
    };
  }
  return { rates, allowed_variation_percent: RULE_BOOK_VARIATION_PCT };
}

export default function RateRuleBook() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRateRules();
      setForm(toForm(data));
      setUpdatedAt(data.updated_at ?? null);
    } catch (e) {
      toast.error(e.message || 'Could not load rate rule book');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async () => {
    setSaving(true);
    try {
      const data = await saveRateRules(toPayload(form));
      setForm(toForm(data));
      setUpdatedAt(data.updated_at ?? null);
      auditToastSuccess('Rate rule book saved');
    } catch (e) {
      auditToastError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const setField = (product, field, value) => {
    setForm((f) => ({
      ...f,
      [product]: { ...f[product], [field]: value },
    }));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Scrutiny</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Gold & Silver Rates</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Enter min and max unit rates for gold and silver products. Sales audit compares{' '}
              <strong>invoice unit rate only</strong> after −{RULE_BOOK_VARIATION_PCT}% on min and +
              {RULE_BOOK_VARIATION_PCT}% on max.
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
            <Link to="/scrutiny/sales-ledger" className="font-medium text-emerald-700 hover:underline">
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
                {RULE_BOOK_PRODUCTS.map((product) => (
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
                      className="w-full"
                      value={form[product].min}
                      onChange={(e) => setField(product, 'min', e.target.value)}
                      disabled={saving}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      aria-label={`${product} max`}
                      placeholder="Max"
                      className="w-full"
                      value={form[product].max}
                      onChange={(e) => setField(product, 'max', e.target.value)}
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
