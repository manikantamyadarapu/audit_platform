import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardBody } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';

const COPY = {
  gst: {
    title: 'GST verification',
    body: 'Indian GST pattern checks, reconciliation windows, and multi-sheet ingestion will land here next.',
  },
  'duplicate-invoice': {
    title: 'Duplicate invoice detection',
    body: 'Fuzzy vendor matching + numeric fingerprinting for recurring invoice clusters.',
  },
  'vendor-reconciliation': {
    title: 'Vendor reconciliation',
    body: 'Three-way match between PO, GRN, and vendor ledger — sharing PAN module UX primitives.',
  },
};

export default function ModuleSoon() {
  const { pathname } = useLocation();
  const slug = useMemo(() => pathname.split('/').filter(Boolean).pop() ?? '', [pathname]);
  const meta = COPY[slug] ?? {
    title: 'Module roadmap',
    body: 'This scrutiny workflow is staged on the architecture backlog.',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">{meta.title}</h2>
        <Badge tone="amber">Coming soon</Badge>
      </div>
      <Card>
        <CardBody>
          <EmptyState
            icon={Sparkles}
            title="Blueprint ready"
            description={meta.body}
          />
        </CardBody>
      </Card>
    </motion.div>
  );
}
