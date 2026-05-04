import { motion } from 'framer-motion';
import { GlassKpiCard } from '../components/dashboard/GlassKpiCard';
import { DashboardUploadCard } from '../components/dashboard/DashboardUploadCard';
import { DashboardActivityFeed } from '../components/dashboard/DashboardActivityFeed';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { WeeklyAuditTrendChart } from '../charts/WeeklyAuditTrendChart';
import { ExceptionDonutChart } from '../charts/ExceptionDonutChart';
import { TeamProductivityChart } from '../charts/TeamProductivityChart';
import { ClientAuditProgressChart } from '../charts/ClientAuditProgressChart';
import { AuditUploadsTable } from '../tables/AuditUploadsTable';
import { RecentRunsTable } from '../tables/RecentRunsTable';
import {
  auditUploadsRows,
  kpiMetrics,
  recentRunsRows,
} from '../data/dashboardDummy';

export default function Dashboard() {
  return (
    <div className="space-y-10 pb-12">
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-2xl border border-white/90 bg-gradient-to-br from-white/95 via-white/80 to-slate-100/50 p-8 shadow-[var(--shadow-glass)] backdrop-blur-2xl sm:p-10"
      >
        <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-blue-400/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Command surface</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Audit Intelligence Center</h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
            Monitor validations, uploads, exceptions and recovery opportunities — built for heavy ledgers and tight close
            weeks.
          </p>
        </div>
      </motion.header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpiMetrics.map((kpi, index) => (
          <GlassKpiCard key={kpi.id} {...kpi} index={index} />
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden border-slate-200/70 bg-white/75 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lg">
          <CardHeader className="border-slate-200/60">
            <h2 className="text-sm font-semibold text-slate-900">Weekly audit trend</h2>
            <p className="mt-0.5 text-xs text-slate-600">Started vs resolved validations</p>
          </CardHeader>
          <CardBody className="pt-0">
            <WeeklyAuditTrendChart />
          </CardBody>
        </Card>

        <Card className="overflow-hidden border-slate-200/70 bg-white/75 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lg">
          <CardHeader className="border-slate-200/60">
            <h2 className="text-sm font-semibold text-slate-900">Exception categories</h2>
            <p className="mt-0.5 text-xs text-slate-600">Distribution by exception type</p>
          </CardHeader>
          <CardBody className="pt-0">
            <ExceptionDonutChart />
          </CardBody>
        </Card>

        <Card className="overflow-hidden border-slate-200/70 bg-white/75 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lg">
          <CardHeader className="border-slate-200/60">
            <h2 className="text-sm font-semibold text-slate-900">Team productivity</h2>
            <p className="mt-0.5 text-xs text-slate-600">Runs closed per reviewer (rolling)</p>
          </CardHeader>
          <CardBody className="pt-0">
            <TeamProductivityChart />
          </CardBody>
        </Card>

        <Card className="overflow-hidden border-slate-200/70 bg-white/75 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lg">
          <CardHeader className="border-slate-200/60">
            <h2 className="text-sm font-semibold text-slate-900">Client audit status</h2>
            <p className="mt-0.5 text-xs text-slate-600">Progress toward sign-off readiness</p>
          </CardHeader>
          <CardBody className="pt-0">
            <ClientAuditProgressChart />
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <DashboardUploadCard />
        </div>
        <div className="lg:col-span-3">
          <DashboardActivityFeed />
        </div>
      </section>

      <AuditUploadsTable rows={auditUploadsRows} />
      <RecentRunsTable rows={recentRunsRows} />
    </div>
  );
}
