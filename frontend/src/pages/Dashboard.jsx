import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Layers,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { KpiCard } from '../components/cards/KpiCard';
import { ServiceCard } from '../components/cards/ServiceCard';
import { DepartmentCard } from '../components/cards/DepartmentCard';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { cn } from '../utils/cn';
import { formatPercent } from '../utils/format';
import { useAppUi } from '../context/AppUiContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { sessionStats, activities } = useAppUi();

  const compliance = useMemo(() => {
    const { rowsProcessed, errorsFound } = sessionStats;
    if (!rowsProcessed) return 99.2;
    const rate = ((rowsProcessed - errorsFound) / rowsProcessed) * 100;
    return Math.max(0, Math.min(100, rate));
  }, [sessionStats]);

  const kpis = [
    {
      label: 'Total services',
      value: '12',
      hint: 'Across Scrutiny & Vouching roadmap',
      icon: Layers,
      accent: 'blue',
    },
    {
      label: 'Active modules',
      value: '3',
      hint: 'PAN · Gross weight · Sales ledger',
      icon: Sparkles,
      accent: 'violet',
    },
    {
      label: 'Files processed (session)',
      value: String(sessionStats.filesProcessed || 0),
      hint: 'This browser session',
      icon: Activity,
      accent: 'emerald',
    },
    {
      label: 'Errors flagged (session)',
      value: String(sessionStats.errorsFound || 0),
      hint: 'Aggregated from validations',
      icon: Target,
      accent: 'amber',
    },
    {
      label: 'Compliance rate',
      value: formatPercent(compliance),
      hint: 'Derived from session throughput',
      icon: TrendingUp,
      accent: 'rose',
    },
  ];

  return (
    <div className="space-y-10">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-white/90 via-white/70 to-blue-50/40 p-8 shadow-[var(--shadow-float)] backdrop-blur-xl sm:p-10"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">Welcome back</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Audit Operations Center
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Scrutiny-grade controls with a calm enterprise workspace. Upload ledgers, validate PAN exposure,
              and ship audit-ready exports without leaving the browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge tone="blue">Internal · Confidential</Badge>
            <Badge tone="emerald">Live · Scrutiny</Badge>
          </div>
        </div>
      </motion.section>

      <section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map((k, i) => (
            <KpiCard key={k.label} {...k} delay={i * 0.05} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <DepartmentCard
          title="Scrutiny"
          subtitle="Operational excellence · regulatory-ready workflows"
          status="active"
          progress={82}
          modules={['PAN verification', 'Gross weight reconciliation', 'Sales ledger analytics']}
        />
        <DepartmentCard
          title="Vouching"
          subtitle="Ledger tracing · voucher integrity"
          status="hold"
          progress={24}
          modules={['Voucher matching', 'Ledger review', 'Entry verification']}
          muted
        />
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Services</h3>
            <p className="text-sm text-slate-500">Jump directly into module workspaces</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="hidden items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900 sm:flex"
          >
            View history
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ServiceCard
            title="PAN Verification"
            description="Validate PAN Excel files against policy thresholds and export mismatches."
            icon={ShieldCheck}
            tone="blue"
            delay={0.05}
            onOpen={() => navigate('/scrutiny/pan')}
          />
          <ServiceCard
            title="Gross Weight Audit"
            description="Compare manual vs automated gross weight readings with exception surfacing."
            icon={Layers}
            tone="emerald"
            delay={0.1}
            onOpen={() => navigate('/scrutiny/gross-weight')}
          />
          <ServiceCard
            title="Sales Ledger"
            description="Spot rate mismatches and suspicious repeats before period close."
            icon={TrendingUp}
            tone="violet"
            delay={0.15}
            onOpen={() => navigate('/scrutiny/sales-ledger')}
          />
          <ServiceCard
            title="Reports"
            description="Exports, CSV snapshots, and downloadable audit packages."
            icon={Activity}
            tone="blue"
            delay={0.2}
            onOpen={() => navigate('/reports')}
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h3 className="text-base font-semibold text-slate-900">Operational runway</h3>
            <p className="text-sm text-slate-500">
              Architecture mirrors backend processors — add GST, duplicate invoice, or vendor flows without
              restructuring navigation.
            </p>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {[
              { title: 'Gateway APIs', detail: 'Node validates uploads and forwards to FastAI processors.' },
              { title: 'Shared UX primitives', detail: 'Upload zones, KPI decks, and TanStack tables reused per module.' },
              { title: 'Division awareness', detail: 'Scrutiny routes stay hot while Vouching stays visibly parked.' },
              { title: 'Exports', detail: 'Excel + CSV flows stream straight from validated JSON payloads.' },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 backdrop-blur-sm"
              >
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.detail}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-slate-900">Recent activity</h3>
            <p className="text-sm text-slate-500">Session-aware audit trail</p>
          </CardHeader>
          <CardBody className="space-y-4">
            {activities.map((a, idx) => (
              <div key={a.id} className="flex gap-3">
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    a.tone === 'success' && 'bg-emerald-500',
                    a.tone === 'warn' && 'bg-amber-500',
                    (!a.tone || a.tone === 'info') && 'bg-blue-500'
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">{a.text}</p>
                  <p className="text-xs text-slate-400">{idx === 0 ? 'Latest event' : 'Activity feed'}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
