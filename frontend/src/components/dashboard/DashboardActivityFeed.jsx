import { motion } from 'framer-motion';
import { AlertOctagon, CheckCircle2, Download, FileUp, Shield } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { activityFeedItems } from '../../data/dashboardDummy';

const typeMeta = {
  upload: { icon: FileUp, color: 'text-blue-600', bg: 'bg-blue-50' },
  validation: { icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  mismatch: { icon: AlertOctagon, color: 'text-amber-600', bg: 'bg-amber-50' },
  report: { icon: Download, color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

export function DashboardActivityFeed() {
  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white/80">
      <CardHeader className="border-slate-200/70 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-slate-700" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-slate-900">Activity feed</h3>
        </div>
        <p className="mt-1 text-xs text-slate-600">Recent uploads, validations, mismatches, exports</p>
      </CardHeader>
      <CardBody className="max-h-[340px] space-y-0 overflow-y-auto scrollbar-thin p-0">
        <ul className="divide-y divide-slate-100">
          {activityFeedItems.map((item, i) => {
            const meta = typeMeta[item.type] ?? typeMeta.upload;
            const Icon = meta.icon;
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex gap-3 px-5 py-4 transition hover:bg-slate-50/80"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
                  <Icon className={`h-5 w-5 ${meta.color}`} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{item.detail}</p>
                  <p className="mt-1.5 text-[11px] font-medium text-slate-400">{item.time}</p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
