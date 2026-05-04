import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  PanelLeft,
  PanelLeftClose,
  Scale,
  Settings,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAppUi } from '../../context/AppUiContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/scrutiny', label: 'Upload Files', icon: Upload, end: true },
  { to: '/audit-runs', label: 'Audit Runs', icon: Activity },
  { to: '/exceptions', label: 'Exceptions', icon: AlertTriangle },
  { to: '/scrutiny/pan', label: 'PAN Validation', icon: ShieldCheck },
  { to: '/scrutiny/gross-weight', label: 'Gross Weight Validation', icon: Scale },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/clients', label: 'Clients', icon: Building2 },
  { to: '/team-activity', label: 'Team Activity', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavItem({ to, label, icon: Icon, end, collapsed, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-gradient-to-r from-blue-600/95 to-indigo-600/95 text-white shadow-md shadow-blue-500/20 ring-1 ring-white/20'
            : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {!collapsed ? <span className="flex-1 truncate text-left">{label}</span> : null}
    </NavLink>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, setDivision } = useAppUi();
  const location = useLocation();

  const ensureScrutiny = () => setDivision('scrutiny');

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 80 : 280 }}
      transition={{ type: 'spring', stiffness: 340, damping: 36 }}
      className="relative z-20 flex h-svh shrink-0 flex-col border-r border-slate-200/80 bg-white/55 shadow-[8px_0_32px_-12px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,rgba(255,255,255,0.9)_0%,rgba(248,250,252,0.5)_100%)]" />

      <div
        className={cn(
          'relative flex gap-3 border-b border-slate-200/60 px-4 py-5',
          sidebarCollapsed ? 'flex-col items-center' : 'items-start justify-between'
        )}
      >
        {!sidebarCollapsed ? (
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Assurance</p>
            <p className="mt-1 truncate text-lg font-semibold tracking-tight text-slate-900">Audit Platform</p>
          </div>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-lg shadow-blue-600/25">
            AP
          </div>
        )}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="shrink-0 rounded-xl border border-slate-200/80 bg-white/80 p-2 text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <p className={cn('mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400', sidebarCollapsed && 'sr-only')}>
          Navigation
        </p>
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              collapsed={sidebarCollapsed}
              onNavigate={() => {
                if (item.to.startsWith('/scrutiny')) ensureScrutiny();
              }}
            />
          ))}
        </div>

        {!sidebarCollapsed ? (
          <div className="mt-8 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-inner">
            <div className="flex items-center gap-2 text-slate-700">
              <FileSpreadsheet className="h-4 w-4 text-blue-600" strokeWidth={1.75} />
              <p className="text-xs font-semibold">Scrutiny hub</p>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
              Deep modules (sales ledger, GST shells) stay on the classic scrutiny overview.
            </p>
            <NavLink
              to="/scrutiny"
              onClick={ensureScrutiny}
              className="mt-3 inline-flex text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              Open hub →
            </NavLink>
          </div>
        ) : null}
      </nav>

      {!sidebarCollapsed ? (
        <div className="relative border-t border-slate-200/70 px-4 py-3 text-[10px] leading-relaxed text-slate-400">
          {location.pathname}
        </div>
      ) : null}
    </motion.aside>
  );
}
