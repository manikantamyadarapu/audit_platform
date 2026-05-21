import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3,
  BellRing,
  Bot,
  ClipboardCheck,
  FileCheck2,
  FileSpreadsheet,
  Coins,
  GitBranch,
  LayoutDashboard,
  ListTree,
  PanelLeftClose,
  Settings,
  Weight,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { HaaLogoMark } from '../ui/HaaLogoMark';
import { useAppUi } from '../../context/AppUiContext';

const menuItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/reports', label: 'Reports', icon: BellRing },
  { to: '/team-activity', label: 'Analytics', icon: BarChart3 },
  { to: '/clients', label: 'AI Insights', icon: Bot },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const scrutinyItems = [
  { to: '/scrutiny/pan', label: 'PAN Audit', icon: ClipboardCheck },
  { to: '/scrutiny/gross-weight', label: 'Gross Weight Audit', icon: Weight },
  { to: '/scrutiny/sales-ledger', label: 'Sales Audit', icon: FileSpreadsheet },
  { to: '/scrutiny/rate-rule-book', label: 'Rate Rule Book', icon: Coins },
];

const vouchingItems = [
  { label: 'Voucher Matching', icon: GitBranch },
  { label: 'Ledger Review', icon: ListTree },
  { label: 'Entry Verification', icon: FileCheck2 },
];

function SectionTitle({ children, collapsed, badge }) {
  if (collapsed) {
    return <div className="my-4 h-px w-8 self-center bg-slate-200" />;
  }

  return (
    <div className="mb-3 mt-7 flex items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</p>
      {badge ? (
        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function NavItem({ to, label, icon: Icon, end, collapsed, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all',
          isActive
            ? 'bg-gradient-to-r from-[#dff5df] to-[#d8f3e9] text-[#07812f]'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </NavLink>
  );
}

function DisabledItem({ label, icon: Icon, collapsed }) {
  return (
    <div
      title={collapsed ? `${label} - On hold` : undefined}
      className="flex h-11 w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-400 opacity-70"
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
      {!collapsed ? (
        <>
          <span className="flex-1 truncate">{label}</span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Hold</span>
        </>
      ) : null}
    </div>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, setDivision } = useAppUi();
  const ensureScrutiny = () => setDivision('scrutiny');

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 84 : 300 }}
      transition={{ type: 'spring', stiffness: 320, damping: 38 }}
      className="sticky top-0 z-20 flex h-svh shrink-0 flex-col border-r border-slate-200 bg-white shadow-[10px_0_35px_rgba(15,23,42,0.04)]"
    >
      <div className={cn('flex items-start gap-3 px-8 pb-8 pt-9', sidebarCollapsed && 'flex-col items-center px-4')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#37c96b] to-[#1fa64f] text-white shadow-lg shadow-green-500/20">
          <HaaLogoMark className="h-[22px] w-[22px]" />
        </div>
        {!sidebarCollapsed ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold tracking-tight text-slate-950">HAA Audit</p>
              <p className="text-xs font-medium text-slate-600">Audit Management System</p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_8px_22px_rgba(15,23,42,0.08)] transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_8px_22px_rgba(15,23,42,0.08)] transition hover:border-slate-300 hover:bg-slate-50"
            aria-label="Expand sidebar"
          >
            <PanelLeftClose className="h-4 w-4 rotate-180" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-7 pb-7 scrollbar-thin">
        <SectionTitle collapsed={sidebarCollapsed}>Menu</SectionTitle>
        <div className="space-y-1">
          {menuItems.map((item) => (
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

        <SectionTitle collapsed={sidebarCollapsed}>Scrutiny</SectionTitle>
        <div className="space-y-1">
          {scrutinyItems.map((item) => (
            <NavItem key={item.to} {...item} collapsed={sidebarCollapsed} onNavigate={ensureScrutiny} />
          ))}
        </div>

        <SectionTitle collapsed={sidebarCollapsed} badge="Hold">
          Vouching
        </SectionTitle>
        <div className="space-y-1">
          {vouchingItems.map((item) => (
            <DisabledItem key={item.label} {...item} collapsed={sidebarCollapsed} />
          ))}
        </div>

      </nav>

      {!sidebarCollapsed ? (
        <div className="m-7">
          <div className="rounded-full border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                AD
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-950">Admin User</p>
                <p className="truncate text-xs text-slate-600">admin@haa.com</p>
              </div>
              <span className="text-sm text-slate-500">v</span>
            </div>
          </div>
        </div>
      ) : null}
    </motion.aside>
  );
}
