import { useState } from 'react';
import { Scale } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/cards/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import toast from 'react-hot-toast';

export default function GrossWeight() {
  const [file, setFile] = useState(null);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">Gross weight audit</h2>
        <Badge tone="amber">Gateway wiring pending</Badge>
      </motion.div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Upload workbook</h3>
              <p className="text-sm text-slate-500">
                Compare <code className="rounded bg-slate-100 px-1 font-mono text-xs">manual_gross_weight</code> vs{' '}
                <code className="rounded bg-slate-100 px-1 font-mono text-xs">auto_gross_weight</code> once the Node route is exposed.
              </p>
            </div>
            <Button
              variant="secondary"
              size="md"
              onClick={() => toast('Backend endpoint not connected yet — UI scaffold only.', { icon: '⚖️' })}
            >
              Run comparison
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <FileUploadZone file={file} onFileChange={setFile} />
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Rows scanned" value="—" hint="Placeholder" icon={Scale} accent="blue" />
        <KpiCard label="Mismatches" value="—" hint="Awaiting API" icon={Scale} accent="amber" />
        <KpiCard label="Within tolerance" value="—" hint="Configurable %" icon={Scale} accent="emerald" />
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-slate-900">Mismatch register</h3>
          <p className="text-sm text-slate-500">Will reuse shared TanStack table + CSV export pattern.</p>
        </CardHeader>
        <CardBody>
          <EmptyState
            icon={Scale}
            title="No comparison yet"
            description="Upload flow mirrors PAN Verification — wire POST /api/v1/process/gross-weight when the gateway is ready."
          />
        </CardBody>
      </Card>
    </div>
  );
}
