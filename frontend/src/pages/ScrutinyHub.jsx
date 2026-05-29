import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Coins, Copy, FileCheck2, Scale, Shield, Users } from 'lucide-react';
import { ServiceCard } from '../components/cards/ServiceCard';
import { Badge } from '../components/ui/Badge';
import { Card, CardBody } from '../components/ui/Card';

const modules = [
  {
    title: 'PAN Verification',
    description: 'Validate PAN workbooks against policy thresholds and export mismatches.',
    path: '/scrutiny/pan',
    icon: FileCheck2,
    tone: 'blue',
  },
  {
    title: 'Gross Weight Audit',
    description: 'Compare manual vs automated gross weight with exception surfacing.',
    path: '/scrutiny/gross-weight',
    icon: Scale,
    tone: 'emerald',
  },
  {
    title: 'Sales Ledger',
    description: 'Mapping, gemstone, gold/silver, and diamond rate checks on uploaded ledgers.',
    path: '/scrutiny/sales-ledger',
    icon: BookOpen,
    tone: 'violet',
  },
  {
    title: 'Gold & Silver Rates',
    description: 'Enter daily metal unit rates for sales audit (±30%).',
    path: '/scrutiny/rate-rule-book',
    icon: Coins,
    tone: 'emerald',
  },
];

const soon = [
  { title: 'GST Verification', to: '/scrutiny/gst', Icon: Shield },
  { title: 'Duplicate Invoice Check', to: '/scrutiny/duplicate-invoice', Icon: Copy },
  { title: 'Vendor Reconciliation', to: '/scrutiny/vendor-reconciliation', Icon: Users },
];

export default function ScrutinyHub() {
  const navigate = useNavigate();

  return (
    <div className="space-y-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Scrutiny</h2>
          <Badge tone="emerald">Active division</Badge>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Deep inspection workflows for statutory and management audits. Pick a live module or preview upcoming
          scrutiny services.
        </p>
      </motion.div>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Live modules</h3>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map((m, i) => (
            <ServiceCard
              key={m.title}
              title={m.title}
              description={m.description}
              icon={m.icon}
              tone={m.tone}
              delay={0.06 * i}
              onOpen={() => navigate(m.path)}
            />
          ))}
        </div>
      </section>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Roadmap</h3>
            <p className="mt-1 text-sm text-slate-500">Staged scrutiny capabilities — same UX shell as PAN.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {soon.map((s) => (
              <button
                key={s.to}
                type="button"
                onClick={() => navigate(s.to)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-900"
              >
                <s.Icon className="h-3.5 w-3.5 text-emerald-600" />
                {s.title}
                <ArrowRight className="h-3.5 w-3.5 opacity-50" />
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
