import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gem } from 'lucide-react';
import { ServiceCard } from '../components/cards/ServiceCard';
import { Badge } from '../components/ui/Badge';
import { Card, CardBody } from '../components/ui/Card';

const modules = [
  {
    title: 'Closing Stock',
    description:
      'Upload Sales and Purchases, build product pivots, download verification pivots, and generate the blank Closing Stock working-paper template.',
    path: '/financials/closing-stock',
    icon: Gem,
    tone: 'emerald',
  },
];

export default function FinancialsHub() {
  const navigate = useNavigate();

  return (
    <div className="space-y-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Financials</h2>
          <Badge tone="emerald">Active division</Badge>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Financial statement workflows. Closing Stock starts with independent Sales and Purchases
          product pivots and a blank jewels working-paper template; calculations land step by step.
        </p>
      </motion.div>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Live modules</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
        <CardBody>
          <h3 className="text-base font-semibold text-slate-900">Next steps</h3>
          <p className="mt-1 text-sm text-slate-500">
            Opening Stock, Purchases, Receipts (including Kokapet), Issues, Sales, Average Rate,
            Gross Profit, and Deviation will be wired onto this template in follow-up tasks.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
