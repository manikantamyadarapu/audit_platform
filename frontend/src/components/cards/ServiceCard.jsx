import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export function ServiceCard({
  title,
  description,
  icon: Icon,
  onOpen,
  delay = 0,
  tone = 'blue',
}) {
  const ring =
    tone === 'blue'
      ? 'ring-blue-500/15 hover:ring-blue-400/25'
      : tone === 'emerald'
        ? 'ring-emerald-500/15 hover:ring-emerald-400/25'
        : 'ring-violet-500/15 hover:ring-violet-400/25';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        'group relative flex flex-col rounded-2xl border border-white/70 bg-white/65 p-6 backdrop-blur-xl shadow-[var(--shadow-glass)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)] ring-1',
        ring
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/90 to-indigo-600 text-white shadow-lg shadow-blue-600/25">
        {Icon ? <Icon className="h-6 w-6" strokeWidth={1.6} /> : null}
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{description}</p>
      <div className="mt-6">
        <Button
          variant="secondary"
          size="md"
          className="w-full justify-between group-hover:border-blue-200"
          onClick={onOpen}
        >
          Open
          <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-blue-600" />
        </Button>
      </div>
    </motion.div>
  );
}
