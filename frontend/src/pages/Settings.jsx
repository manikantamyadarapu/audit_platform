import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export default function Settings() {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">Workspace settings</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          Security and deployment posture for the audit workspace.
        </p>
      </motion.div>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Appearance</h3>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-subtle)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Theme</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Applies across dashboard, scrutiny, users, and login.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Security posture</h3>
        </CardHeader>
        <CardBody>
          <div className="flex gap-4 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-subtle)] p-5">
            <Shield className="h-10 w-10 shrink-0 text-emerald-600" strokeWidth={1.25} />
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Internal deployment checklist</p>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-[var(--color-text-secondary)]">
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
