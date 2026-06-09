import { PauseCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardBody } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';

export default function VouchingHold() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">Vouching division</h2>
        <Badge tone="neutral">On hold</Badge>
      </div>
      <Card>
        <CardBody>
          <EmptyState
            icon={PauseCircle}
            title="Paused by business priority"
            description="Navigation entries stay visible for continuity. Resume voucher matching, ledger review, and entry verification when finance re-opens the workstream."
          />
        </CardBody>
      </Card>
    </motion.div>
  );
}
