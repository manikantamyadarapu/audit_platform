import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gem, Landmark, MapPin } from 'lucide-react';
import { ServiceCard } from '../components/cards/ServiceCard';
import { Badge } from '../components/ui/Badge';

const modules = [
  {
    title: 'Basheerbagh Financials',
    description:
      'Upload the Basheerbagh folder and build that branch Closing Stock workbook. Saved Average Rates stay available to the other branches.',
    path: '/financials/basheerbagh',
    icon: Gem,
    tone: 'emerald',
  },
  {
    title: 'Kokapet Financials',
    description:
      'Upload the Kokapet folder on the same six-file flow. Receipt amounts can use Average Rates saved from the other branches.',
    path: '/financials/kokapet',
    icon: MapPin,
    tone: 'emerald',
  },
  {
    title: 'Jubilee Hills Financials',
    description:
      'Upload a Jubilee Hills folder and download the Closing Stock workbook. Receipt amounts use Average Rates saved from Basheerbagh and Kokapet.',
    path: '/financials/jubilee-hills',
    icon: Landmark,
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
          Three branch workbooks. Each page runs its own upload. Average Rates saved on one branch
          are reused when another branch calculates receipt amounts.
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

    </div>
  );
}
