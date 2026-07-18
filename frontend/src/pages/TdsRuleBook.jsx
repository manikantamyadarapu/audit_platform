import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { auditToastError, auditToastSuccess } from '../utils/auditToast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { fetchTdsRules, saveTdsRules } from '../services/tdsRuleService';
import { TDS_RULE_BOOK_SECTIONS } from '../constants/tdsRuleBook';
import { formatSavedDateTime } from '../utils/dateTime';

// A section uses split rates when it has rate_individual / rate_others instead of a flat rate
function hasSplitRates(sectionDef) {
  return sectionDef.rate_individual != null || sectionDef.rate_others != null;
}

function emptyForm() {
  return Object.fromEntries(
    TDS_RULE_BOOK_SECTIONS.map((s) => [
      s.section,
      {
        description: s.description ?? '',
        threshold: s.threshold ?? '',
        rate: s.rate ?? '',
        rate_individual: s.rate_individual ?? '',
        rate_others: s.rate_others ?? '',
        special_rule: s.special_rule ?? '',
      },
    ]),
  );
}

function toForm(data) {
  const next = emptyForm();
  const rules = data?.rules ?? data ?? {};
  for (const s of TDS_RULE_BOOK_SECTIONS) {
    const v = rules[s.section];
    if (v && typeof v === 'object') {
      next[s.section] = {
        description: v.description ?? s.description ?? '',
        threshold: v.threshold ?? s.threshold ?? '',
        rate: v.rate ?? s.rate ?? '',
        rate_individual: v.rate_individual ?? s.rate_individual ?? '',
        rate_others: v.rate_others ?? s.rate_others ?? '',
        special_rule: v.special_rule ?? s.special_rule ?? '',
      };
    }
  }
  return next;
}

function toPayload(form) {
  const rules = {};
  for (const s of TDS_RULE_BOOK_SECTIONS) {
    const e = form[s.section];
    rules[s.section] = {
      description: e.description || null,
      threshold: e.threshold || null,
      rate: e.rate || null,
      rate_individual: e.rate_individual || null,
      rate_others: e.rate_others || null,
      special_rule: e.special_rule || null,
    };
  }
  return { rules };
}

// Column header label component
function ColLabel({ children }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</span>
  );
}

export default function TdsRuleBook() {
  const location = useLocation();
  const returnTo = location.state?.returnTo ?? '/scrutiny';
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTdsRules();
      setForm(toForm(data));
      setUpdatedAt(data.updated_at ?? null);
    } catch (e) {
      auditToastError(e.message || 'Could not load TDS rule book');
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
      const data = await saveTdsRules(toPayload(form));
      setForm(toForm(data));
      setUpdatedAt(data.updated_at ?? null);
      auditToastSuccess('TDS rule book saved');
    } catch (e) {
      auditToastError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const setField = (section, field, value) => {
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
  };

  return (
    <div className="space-y-8">
      <Link
        to={returnTo}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        <span>Back to audit</span>
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Scrutiny</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">TDS Rule Book</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Manage TDS deduction rules for each section. Changes here are applied during TDS audit
            validation. Sections with split rates (e.g. 194C) accept individual and others rates
            separately.
          </p>
        </div>
        {updatedAt ? (
          <p className="shrink-0 text-xs text-slate-500">Last saved: {formatSavedDateTime(updatedAt)}</p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">TDS Section Rules</h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <form
              className="space-y-0"
              onSubmit={(e) => {
                e.preventDefault();
                onSave();
              }}
            >
              {/* Table header — hidden on mobile */}
              <div className="mb-2 hidden border-b border-slate-200 pb-2 lg:grid lg:grid-cols-[100px_1fr_1fr_90px_90px_90px_1fr] lg:gap-3">
                <ColLabel>Section</ColLabel>
                <ColLabel>Description</ColLabel>
                <ColLabel>Threshold</ColLabel>
                <ColLabel>Rate</ColLabel>
                <ColLabel>Individual</ColLabel>
                <ColLabel>Others</ColLabel>
                <ColLabel>Special Rule</ColLabel>
              </div>

              <div className="divide-y divide-slate-100">
                {TDS_RULE_BOOK_SECTIONS.map((sectionDef) => {
                  const key = sectionDef.section;
                  const row = form[key];
                  const splitRates = hasSplitRates(sectionDef);

                  return (
                    <div key={key} className="py-3">
                      {/* Desktop row */}
                      <div className="hidden lg:grid lg:grid-cols-[100px_1fr_1fr_90px_90px_90px_1fr] lg:items-center lg:gap-3">
                        {/* Section badge */}
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                          {key}
                        </span>

                        <Input
                          type="text"
                          aria-label={`${key} description`}
                          placeholder="Description"
                          value={row.description}
                          onChange={(e) => setField(key, 'description', e.target.value)}
                          disabled={saving}
                        />

                        <Input
                          type="text"
                          aria-label={`${key} threshold`}
                          placeholder="Threshold"
                          value={row.threshold}
                          onChange={(e) => setField(key, 'threshold', e.target.value)}
                          disabled={saving}
                        />

                        {/* Flat rate — greyed out for split-rate sections */}
                        <Input
                          type="text"
                          aria-label={`${key} rate`}
                          placeholder={splitRates ? '—' : 'e.g. 10%'}
                          value={splitRates ? '' : (row.rate ?? '')}
                          onChange={(e) => !splitRates && setField(key, 'rate', e.target.value)}
                          disabled={saving || splitRates}
                          className={splitRates ? 'opacity-40' : ''}
                        />

                        {/* Individual rate — only relevant for split-rate sections */}
                        <Input
                          type="text"
                          aria-label={`${key} rate individual`}
                          placeholder={splitRates ? 'e.g. 1%' : '—'}
                          value={splitRates ? (row.rate_individual ?? '') : ''}
                          onChange={(e) => splitRates && setField(key, 'rate_individual', e.target.value)}
                          disabled={saving || !splitRates}
                          className={!splitRates ? 'opacity-40' : ''}
                        />

                        {/* Others rate — only relevant for split-rate sections */}
                        <Input
                          type="text"
                          aria-label={`${key} rate others`}
                          placeholder={splitRates ? 'e.g. 2%' : '—'}
                          value={splitRates ? (row.rate_others ?? '') : ''}
                          onChange={(e) => splitRates && setField(key, 'rate_others', e.target.value)}
                          disabled={saving || !splitRates}
                          className={!splitRates ? 'opacity-40' : ''}
                        />

                        <Input
                          type="text"
                          aria-label={`${key} special rule`}
                          placeholder="Special rule (optional)"
                          value={row.special_rule ?? ''}
                          onChange={(e) => setField(key, 'special_rule', e.target.value)}
                          disabled={saving}
                        />
                      </div>

                      {/* Mobile card layout */}
                      <div className="space-y-2 lg:hidden">
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                          {key}
                        </span>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
                            <Input
                              type="text"
                              aria-label={`${key} description`}
                              placeholder="Description"
                              value={row.description}
                              onChange={(e) => setField(key, 'description', e.target.value)}
                              disabled={saving}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500">Threshold</label>
                            <Input
                              type="text"
                              aria-label={`${key} threshold`}
                              placeholder="Threshold"
                              value={row.threshold}
                              onChange={(e) => setField(key, 'threshold', e.target.value)}
                              disabled={saving}
                            />
                          </div>
                          {splitRates ? (
                            <>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-500">
                                  Rate (Individual / HUF)
                                </label>
                                <Input
                                  type="text"
                                  aria-label={`${key} rate individual`}
                                  placeholder="e.g. 1%"
                                  value={row.rate_individual ?? ''}
                                  onChange={(e) => setField(key, 'rate_individual', e.target.value)}
                                  disabled={saving}
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-500">
                                  Rate (Others)
                                </label>
                                <Input
                                  type="text"
                                  aria-label={`${key} rate others`}
                                  placeholder="e.g. 2%"
                                  value={row.rate_others ?? ''}
                                  onChange={(e) => setField(key, 'rate_others', e.target.value)}
                                  disabled={saving}
                                />
                              </div>
                            </>
                          ) : (
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-500">Rate</label>
                              <Input
                                type="text"
                                aria-label={`${key} rate`}
                                placeholder="e.g. 10%"
                                value={row.rate ?? ''}
                                onChange={(e) => setField(key, 'rate', e.target.value)}
                                disabled={saving}
                              />
                            </div>
                          )}
                          {(row.special_rule || sectionDef.special_rule) ? (
                            <div className="sm:col-span-2">
                              <label className="mb-1 block text-xs font-medium text-slate-500">Special Rule</label>
                              <Input
                                type="text"
                                aria-label={`${key} special rule`}
                                placeholder="Special rule (optional)"
                                value={row.special_rule ?? ''}
                                onChange={(e) => setField(key, 'special_rule', e.target.value)}
                                disabled={saving}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-3 pt-4">
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
