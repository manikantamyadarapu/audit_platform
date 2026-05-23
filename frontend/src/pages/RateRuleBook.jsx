import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { fetchRateRules, saveRateRules } from '../services/rateRuleService';
import { RULE_BOOK_PRODUCTS, RULE_BOOK_VARIATION_PCT } from '../constants/metalRateRuleBook';

function emptyForm() {
  return Object.fromEntries(RULE_BOOK_PRODUCTS.map((p) => [p, '']));
}

function toForm(data) {
  const next = emptyForm();
  const rates = data?.rates ?? data ?? {};
  for (const product of RULE_BOOK_PRODUCTS) {
    const v = rates[product];
    next[product] = v == null || v === '' ? '' : String(v);
  }
  return next;
}

function toPayload(form) {
  const rates = {};
  for (const product of RULE_BOOK_PRODUCTS) {
    const raw = form[product];
    if (raw === '' || raw == null) {
      rates[product] = null;
    } else {
      const n = Number(raw);
      rates[product] = Number.isFinite(n) && n > 0 ? n : null;
    }
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
      toast.success('Rate rule book saved');
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
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Scrutiny</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Gold & Silver Rates</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Enter today&apos;s unit rates for gold and silver products. Sales audit compares{' '}
              <strong>invoice unit rate only</strong> to ±{RULE_BOOK_VARIATION_PCT}% of the saved rate.
            </p>
          </div>
        </div>
        {updatedAt ? (
          <p className="text-xs text-slate-500">Last saved: {new Date(updatedAt).toLocaleString()}</p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Product rates</h2>
            <p className="text-sm text-slate-600">
              After saving, run{' '}
              <Link to="/scrutiny/sales-ledger" className="font-medium text-emerald-700 hover:underline">
                Sales Audit
              </Link>{' '}
              on your ledger upload.
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
                {RULE_BOOK_PRODUCTS.map((product) => (
                  <div
                    key={product}
                    className="grid gap-3 border-b border-slate-100 pb-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center"
                  >
                    <label htmlFor={`rate-${product}`} className="text-sm font-medium text-slate-800">
                      {product}
                    </label>
                    <Input
                      id={`rate-${product}`}
                      type="number"
                      min="0"
                      step="any"
                      className="w-full"
                      value={form[product]}
                      onChange={(e) => setForm((f) => ({ ...f, [product]: e.target.value }))}
                      placeholder="Rate"
                      disabled={saving}
                    />
                  </div>
                ))}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button type="submit" disabled={loading || saving} loading={saving}>
                    <Save className="h-4 w-4" />
                    Save rule book
                  </Button>
                  <Button type="button" variant="secondary" onClick={load} disabled={loading || saving}>
                    Reload
                  </Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-slate-900">Validation rule</h3>
          </CardHeader>
          <CardBody className="space-y-3 text-sm text-slate-700">
            <p>
              Allowed variation: <strong>−{RULE_BOOK_VARIATION_PCT}% to +{RULE_BOOK_VARIATION_PCT}%</strong>
            </p>
            <p>
              <code className="rounded bg-slate-100 px-1 text-xs">min</code> = rate × 0.70
              <br />
              <code className="rounded bg-slate-100 px-1 text-xs">max</code> = rate × 1.30
            </p>
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-900">
              Outside band → <strong>INVALID_RATE_DEVIATION</strong>
            </p>
            <p className="text-xs text-slate-500">
              Example: Gold Ornaments 22K rate 9000 → valid unit rates 6300–11700.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
