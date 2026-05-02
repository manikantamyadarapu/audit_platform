import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';

export default function SalesLedger() {
  const [file, setFile] = useState(null);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">Sales ledger</h2>
        <Badge tone="amber">Gateway wiring pending</Badge>
      </motion.div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Ledger ingestion</h3>
              <p className="text-sm text-slate-500">
                Future checks: <span className="font-medium text-slate-700">rate mismatch</span>,{' '}
                <span className="font-medium text-slate-700">duplicate sales rows</span>, tolerance bands vs booked rates.
              </p>
            </div>
            <Button
              variant="secondary"
              size="md"
              onClick={() => toast('Sales route not exposed on gateway yet.', { icon: '📒' })}
            >
              Run validation
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <FileUploadZone file={file} onFileChange={setFile} />
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Rows imported" value="—" icon={BookOpen} accent="blue" />
        <KpiCard label="Rate mismatches" value="—" icon={BookOpen} accent="rose" />
        <KpiCard label="Duplicate suspects" value="—" icon={BookOpen} accent="amber" />
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-slate-900">Exception queue</h3>
          <p className="text-sm text-slate-500">Designed for the same glass cards + data table stack as PAN.</p>
        </CardHeader>
        <CardBody>
          <EmptyState
            icon={BookOpen}
            title="Awaiting sales processor"
            description="Hook this page to POST /api/v1/process/sales when your gateway forwards the FastAPI sales audit."
          />
        </CardBody>
      </Card>
    </div>
  );
}
