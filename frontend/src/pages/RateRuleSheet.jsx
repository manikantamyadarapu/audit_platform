import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Calculator,
  CheckCircle2,
  CircleAlert,
  FileSpreadsheet,
  Gem,
  Loader2,
  Save,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { KpiCard } from '../components/cards/KpiCard';
import { fetchRateRules, saveRateRules } from '../services/rateRuleService';

const VARIATION_PCT = 30;

const METAL_RATE_FIELDS = [
  { key: 'gold_14k_rate', label: 'Gold 14K', account: 'GOLD SALES ACCOUNT - 14K', products: 'Gold Ornaments 14K' },
  { key: 'gold_18k_rate', label: 'Gold 18K', account: 'GOLD SALES ACCOUNT - 18K', products: 'Gold Ornaments 18K' },
  { key: 'gold_22k_rate', label: 'Gold 22K', account: 'GOLD SALES ACCOUNT - 22K', products: 'Gold Ornaments 22K' },
  { key: 'gold_jadau_rate', label: 'Gold Jadau', account: 'GOLD SALES ACCOUNT - JADAU', products: 'Gold Ornaments Jadau' },
  { key: 'gold_24k_rate', label: 'Gold 24K', account: 'GOLD SALES ACCOUNT - 24K', products: 'Standard Gold 24K' },
  { key: 'silver_rate', label: 'Silver', account: 'SILVER SALES ACCOUNT', products: 'Silver articles' },
];

const SKIP_RATE_PRODUCTS = [
  'Black beads',
  'Dori',
  'Lac',
  'Wax, Dori Etc',
  'Customer Gold Ornaments (all carats)',
];

const GEMSTONE_FAMILIES = [
  'Rubies (JRU slab from product name)',
  'Emeralds (JEM)',
  'Pearls (JPS)',
  'Color stones (JOS / JSP / loose JOS when slab parsed)',
  'Semi precious (JSP)',
];

function emptyForm() {
  return Object.fromEntries(METAL_RATE_FIELDS.map(({ key }) => [key, '']));
}

function toForm(data) {
  const next = emptyForm();
  if (!data) return next;
  for (const { key } of METAL_RATE_FIELDS) {
    const v = data[key];
    next[key] = v == null || v === '' ? '' : String(v);
  }
  return next;
}

function toPayload(form) {
  const payload = {};
  for (const { key } of METAL_RATE_FIELDS) {
    const raw = form[key];
    if (raw === '' || raw == null) {
      payload[key] = null;
    } else {
      const n = Number(raw);
      payload[key] = Number.isFinite(n) && n > 0 ? n : null;
    }
  }
  return payload;
}

function bandPreview(rate, pct = VARIATION_PCT) {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return null;
  const delta = n * (pct / 100);
  return {
    min: Math.round((n - delta) * 100) / 100,
    max: Math.round((n + delta) * 100) / 100,
  };
}

function formatRate(value) {
  if (value === '' || value == null) return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-IN') : String(value);
}

function RateFieldRow({ field, value, onChange, disabled }) {
  const band = useMemo(() => bandPreview(value), [value]);

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{field.label}</p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">{field.account}</p>
        </div>
        {band ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
            <CheckCircle2 className="h-3 w-3" />
            Band set
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
            <CircleAlert className="h-3 w-3" />
            No rate
          </span>
        )}
      </div>
      <label className="mt-3 mb-1.5 block text-xs font-medium text-slate-600">Current market rate (per unit)</label>
      <Input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder="e.g. 9000"
      />
      <p className="mt-1.5 text-xs text-slate-500">{field.products}</p>
      {band ? (
        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <div>
            <dt className="text-slate-500">Min (−{VARIATION_PCT}%)</dt>
            <dd className="font-semibold text-slate-800">{band.min.toLocaleString('en-IN')}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Max (+{VARIATION_PCT}%)</dt>
            <dd className="font-semibold text-slate-800">{band.max.toLocaleString('en-IN')}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Market</dt>
            <dd className="font-semibold text-emerald-700">{formatRate(value)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

export default function RateRuleSheet() {
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
      toast.error(e.message || 'Could not load rule book');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const configuredCount = useMemo(
    () => METAL_RATE_FIELDS.filter(({ key }) => bandPreview(form[key]) != null).length,
    [form]
  );

  const allConfigured = configuredCount === METAL_RATE_FIELDS.length;

  const onSave = async () => {
    setSaving(true);
    try {
      const data = await saveRateRules(toPayload(form));
      setForm(toForm(data));
      setUpdatedAt(data.updated_at ?? null);
      toast.success('Rule book saved — sales audit will use these rates');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
            <BookOpen className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Scrutiny · Rule book</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Sales Rule Book</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Set today&apos;s gold and silver market rates before running{' '}
              <Link to="/scrutiny/sales-ledger" className="font-medium text-emerald-700 hover:underline">
                Sales Audit
              </Link>
              . Only <strong>invoice unit rate</strong> is checked (±{VARIATION_PCT}%).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {updatedAt ? (
            <p className="text-xs text-slate-500">Last saved: {new Date(updatedAt).toLocaleString()}</p>
          ) : null}
          <Button type="button" variant="secondary" size="md" onClick={load} disabled={loading || saving}>
            Reload
          </Button>
          <Button type="button" size="md" onClick={onSave} disabled={loading || saving} loading={saving}>
            <Save className="h-4 w-4" />
            Save rule book
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Metal rates configured"
          value={`${configuredCount} / ${METAL_RATE_FIELDS.length}`}
          icon={Calculator}
          accent={allConfigured ? 'emerald' : 'amber'}
          hint={allConfigured ? 'Ready for sales audit' : 'Fill missing rates before audit'}
        />
        <KpiCard
          label="Allowed variation"
          value={`±${VARIATION_PCT}%`}
          icon={ShieldCheck}
          accent="blue"
          hint="Fixed band for gold, silver, and gemstones"
        />
        <KpiCard
          label="Gemstone rules"
          value="Slab ±30%"
          icon={Gem}
          accent="violet"
          hint="Rate from number in product name"
        />
        <KpiCard
          label="Next step"
          value="Sales Audit"
          icon={FileSpreadsheet}
          accent="emerald"
          hint="Upload ledger after saving rates"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Gold &amp; silver market rates</h2>
                <p className="text-sm text-slate-600">
                  Employee-entered rates drive ±{VARIATION_PCT}% validation on the next ledger upload.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="flex items-center gap-2 py-12 text-sm text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                Loading rule book…
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {METAL_RATE_FIELDS.map((field) => (
                  <RateFieldRow
                    key={field.key}
                    field={field}
                    value={form[field.key]}
                    disabled={saving}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                  />
                ))}
              </div>
            )}
            {!allConfigured && !loading ? (
              <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                <CircleAlert className="mr-1.5 inline h-4 w-4 align-text-bottom" />
                Some accounts have no market rate — gold/silver rate checks are skipped until you save a value.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-slate-900">Unit rate formula</h3>
              <p className="text-sm text-slate-600">Same rule for metal and gemstones.</p>
            </CardHeader>
            <CardBody className="space-y-3 text-sm text-slate-700">
              <p>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">min</code> = market × (1 −{' '}
                {VARIATION_PCT}%)
              </p>
              <p>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">max</code> = market × (1 +{' '}
                {VARIATION_PCT}%)
              </p>
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-900">
                Outside band → <strong>INVALID_RATE_DEVIATION</strong>
                <br />
                <span className="text-xs">Unit rate is outside the allowed ±30% deviation band.</span>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-slate-900">Gemstone slab rules</h3>
              <p className="text-sm text-slate-600">No entry here — slab comes from the product name.</p>
            </CardHeader>
            <CardBody>
              <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-700">
                {GEMSTONE_FAMILIES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-slate-900">Rate check skipped</h3>
              <p className="text-sm text-slate-600">Mapping only — any unit rate allowed if mapping OK.</p>
            </CardHeader>
            <CardBody>
              <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-700">
                {SKIP_RATE_PRODUCTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                <li>Diamonds (all SKUs)</li>
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-slate-900">Example (22K @ 9000)</h3>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>Min allowed: <strong>6,300</strong></li>
                <li>Max allowed: <strong>11,700</strong></li>
                <li className="text-rose-700">
                  Invoice unit rate <strong>5,800</strong> → invalid
                </li>
              </ul>
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
