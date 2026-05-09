import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

export default function Settings() {
  const apiBase = import.meta.env.VITE_API_BASE_URL || '(empty — Vite dev proxy /api → Node gateway)';

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-2xl font-semibold text-slate-900">Workspace settings</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Environment-facing controls for this SPA. Authentication and RBAC can layer on without restructuring routes.
        </p>
      </motion.div>

      <Card>
        <CardHeader className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">API target</h3>
          <Badge tone="emerald">Read only</Badge>
        </CardHeader>
        <CardBody className="space-y-4 max-w-2xl">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">VITE_API_BASE_URL</label>
            <Input className="mt-2 font-mono text-xs" readOnly value={apiBase} />
            <p className="mt-2 text-xs text-slate-500">
              Set in <code className="rounded bg-slate-100 px-1">.env</code> for production builds. Local dev uses the Vite proxy.
            </p>
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
                <li>Terminate TLS at your corporate ingress; forward to Node gateway.</li>
                <li>Disable Swagger on production gateways (`ENABLE_SWAGGER=false`).</li>
                <li>Scope CORS to trusted audit workstations.</li>
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
