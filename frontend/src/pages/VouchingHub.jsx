import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileCheck2, GitBranch, ListTree, PauseCircle } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card, CardBody } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';

const links = [
  { label: 'Voucher Matching', to: '/vouching/voucher-matching', icon: GitBranch },
  { label: 'Ledger Review', to: '/vouching/ledger-review', icon: ListTree },
  { label: 'Entry Verification', to: '/vouching/entry-verification', icon: FileCheck2 },
];

export default function VouchingHub() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Vouching</h2>
          <Badge tone="slate">On hold</Badge>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Division navigation stays visible for continuity. Sub-modules open placeholder screens until business resumes
          the workstream.
        </p>
      </motion.div>

      <Card>
        <CardBody>
          <EmptyState
            icon={PauseCircle}
            title="Paused by business priority"
            description="Resume voucher integrity workflows when finance re-opens this division. Quick links below jump to staged module shells."
          >
            <div className="flex flex-wrap justify-center gap-2">
              {links.map((l) => {
                const Icon = l.icon;
                return (
                  <Button key={l.to} variant="secondary" size="sm" onClick={() => navigate(l.to)}>
                    <Icon className="h-4 w-4" />
                    {l.label}
                  </Button>
                );
              })}
            </div>
          </EmptyState>
        </CardBody>
      </Card>
    </div>
  );
}
