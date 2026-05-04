import { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardBody } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';

const META = {
  '/audit-runs': {
    title: 'Audit runs',
    body: 'Run history, scheduling, and batch orchestration will connect to the python validation service here.',
  },
  '/exceptions': {
    title: 'Exceptions',
    body: 'Central triage for gross weight, PAN, and cross-module exceptions with assignee workflows.',
  },
  '/clients': {
    title: 'Clients',
    body: 'Engagement registry, data-room links, and client-specific validation profiles.',
  },
  '/team-activity': {
    title: 'Team activity',
    body: 'Live presence, reviewer load, and SLA tracking across the assurance pod.',
  },
};

export default function PlatformPlaceholder() {
  const { pathname } = useLocation();
  const meta = useMemo(
    () =>
      META[pathname] ?? {
        title: 'Workspace',
        body: 'This area is reserved for the next release of the audit operating layer.',
      },
    [pathname]
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100/90 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Audit Intelligence Center
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">{meta.title}</h2>
        <Badge tone="amber">Roadmap</Badge>
      </div>
      <Card className="border-slate-200/80 bg-white/90">
        <CardBody>
          <EmptyState icon={Sparkles} title="Shell ready for wiring" description={meta.body} />
        </CardBody>
      </Card>
    </motion.div>
  );
}
