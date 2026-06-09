import { FileDown, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { useAppUi } from '../context/AppUiContext';

export default function Reports() {
  const { sessionStats } = useAppUi();

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-semibold text-slate-900">Reports &amp; exports</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Central place for downloadable packages. Session counters below update as you validate PAN workbooks and pull Excel
          exports.
        </p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <History className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Session validations</p>
              <p className="font-mono text-2xl font-semibold text-slate-900">{sessionStats.filesProcessed}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700">
              <FileDown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exports downloaded</p>
              <p className="font-mono text-2xl font-semibold text-slate-900">{sessionStats.exportsDownloaded}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
              <History className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rows reviewed</p>
              <p className="font-mono text-2xl font-semibold text-slate-900">{sessionStats.rowsProcessed}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">Archive</h3>
          <Badge tone="blue">Coming soon</Badge>
        </CardHeader>
        <CardBody>
          <EmptyState
            icon={FileDown}
            title="Persistent history not configured"
            description="Saved report history is coming soon. Until then, use browser downloads for each export."
          />
        </CardBody>
      </Card>
    </div>
  );
}
