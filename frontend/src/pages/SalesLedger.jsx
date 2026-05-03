import { BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardBody } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';

export default function SalesLedger() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">Sales ledger</h2>
        <Badge tone="amber">Backend wiring pending</Badge>
      </div>
      <Card>
        <CardBody>
          <EmptyState
            icon={BookOpen}
            title="Module scaffold"
            description="Rate checks and sales row validation will connect to the Python sales processor here, using the same upload and results pattern as PAN and gross weight."
          />
        </CardBody>
      </Card>
    </motion.div>
  );
}
