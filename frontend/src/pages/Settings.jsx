import { motion } from 'framer-motion';
import { Moon, Shield, Sun } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAppUi } from '../context/AppUiContext';

export default function Settings() {
  const { theme } = useAppUi();
  const isDark = theme === 'dark';

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-semibold text-slate-900">Workspace settings</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Security and deployment posture for the audit workspace.
        </p>
      </motion.div>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-slate-900">Appearance</h3>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200">
                {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{isDark ? 'Dark mode' : 'Light mode'}</p>
                <p className="mt-1 text-sm text-slate-600">Choose the workspace theme.</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-slate-900">Security posture</h3>
        </CardHeader>
        <CardBody>
          <div className="flex gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5">
            <Shield className="h-10 w-10 shrink-0 text-emerald-600" strokeWidth={1.25} />
            <div>
              <p className="text-sm font-semibold text-slate-900">Internal deployment checklist</p>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-600">
                <li>Use a secure corporate entry point for the workspace.</li>
                <li>Keep developer documentation hidden in production.</li>
                <li>Limit access to trusted audit workstations.</li>
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
