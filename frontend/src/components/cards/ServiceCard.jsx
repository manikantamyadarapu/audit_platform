import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

const toneIconWrap = {
  blue: 'from-sky-50 to-blue-50 text-sky-600 ring-sky-100/90',
  emerald: 'from-emerald-50 to-teal-50 text-emerald-600 ring-emerald-100/90',
  violet: 'from-violet-50 to-purple-50 text-violet-600 ring-violet-100/90',
};

export function ServiceCard({
  title,
  description,
  icon: Icon,
  onOpen,
  delay = 0,
  tone = 'blue',
}) {
  const iconRing = toneIconWrap[tone] || toneIconWrap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        'group relative flex flex-col rounded-[18px] border border-slate-200/70 bg-white p-6 shadow-[var(--shadow-glass)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]'
      )}
    >
      <div
        className={cn(
          'mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ring-1',
          iconRing
        )}
      >
        {Icon ? <Icon className="h-6 w-6" strokeWidth={1.6} /> : null}
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{description}</p>
      <div className="mt-6">
        <Button variant="secondary" size="md" className="w-full justify-between" onClick={onOpen}>
          Open
          <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-emerald-600" />
        </Button>
      </div>
    </motion.div>
  );
}
