import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  Copy,
  FileCheck2,
  GitBranch,
  LayoutDashboard,
  LayoutGrid,
  ListTree,
  PanelLeftClose,
  PanelLeft,
  Scale,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAppUi } from '../../context/AppUiContext';
import { Badge } from '../ui/Badge';

const mainNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const scrutinyNav = [
  { to: '/scrutiny', label: 'Overview', icon: LayoutGrid, soon: false, end: true },
  { to: '/scrutiny/pan', label: 'PAN Verification', icon: FileCheck2, soon: false },
  { to: '/scrutiny/gross-weight', label: 'Gross Weight Audit', icon: Scale, soon: false },
  { to: '/scrutiny/sales-ledger', label: 'Sales Ledger', icon: BookOpen, soon: false },
  { to: '/scrutiny/gst', label: 'GST Verification', icon: Shield, soon: true },
  { to: '/scrutiny/duplicate-invoice', label: 'Duplicate Invoice Check', icon: Copy, soon: true },
  { to: '/scrutiny/vendor-reconciliation', label: 'Vendor Reconciliation', icon: Users, soon: true },
];

const vouchingNav = [
  { to: '/vouching', label: 'Overview', icon: LayoutGrid, soon: false, end: true },
  { to: '/vouching/voucher-matching', label: 'Voucher Matching', icon: GitBranch },
  { to: '/vouching/ledger-review', label: 'Ledger Review', icon: ListTree },
  { to: '/vouching/entry-verification', label: 'Entry Verification', icon: FileCheck2 },
];

function NavItem({ to, label, icon: Icon, end, soon, collapsed, disabled, onNavigate }) {
  const inner = (isActive) => (
    <span
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
        disabled && 'cursor-not-allowed opacity-45',
        !disabled && isActive && 'bg-white/10 text-white shadow-lg shadow-blue-500/10 ring-1 ring-white/10',
        !disabled && !isActive && 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left">{label}</span>
          {soon ? (
            <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
              Soon
            </span>
          ) : null}
        </>
      )}
    </span>
  );

  if (disabled) {
    return (
      <div title={collapsed ? label : undefined} className="w-full">
        {inner(false)}
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) => cn('block w-full', disabled && 'pointer-events-none')}
    >
      {({ isActive }) => inner(isActive)}
    </NavLink>
  );
}

function SectionLabel({ collapsed, children, right }) {
  if (collapsed) {
    return <div className="my-2 h-px w-8 self-center bg-slate-800" />;
  }
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-2 px-1 first:mt-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{children}</span>
      {right}
    </div>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, division, setDivision } = useAppUi();
  const [openScrutiny, setOpenScrutiny] = useState(true);
  const [openVouching, setOpenVouching] = useState(false);
  const location = useLocation();

  const vouchingDisabled = true;

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 80 : 288 }}
      transition={{ type: 'spring', stiffness: 320, damping: 38 }}
      className="relative z-20 flex h-svh shrink-0 flex-col border-r border-slate-800/80 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 shadow-2xl shadow-slate-950/50"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.18),_transparent_55%)]" />

      <div
        className={cn(
          'relative flex gap-3 px-4 py-6',
          sidebarCollapsed ? 'flex-col items-center' : 'items-start justify-between'
        )}
      >
        {!sidebarCollapsed ? (
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-300/90">Enterprise</p>
            <p className="mt-1 truncate text-lg font-semibold tracking-tight text-white">Audit Platform</p>
          </div>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold text-white shadow-lg shadow-blue-600/40">
            AP
          </div>
        )}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {!sidebarCollapsed && (
        <div className="relative mx-4 mb-4 rounded-xl border border-white/10 bg-white/5 p-1">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setDivision('scrutiny')}
              className={cn(
                'rounded-lg px-2 py-2 text-xs font-semibold transition',
                division === 'scrutiny'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Scrutiny
            </button>
            <button
              type="button"
              onClick={() => setDivision('vouching')}
              className={cn(
                'rounded-lg px-2 py-2 text-xs font-semibold transition',
                division === 'vouching'
                  ? 'bg-slate-700 text-white ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Vouching
            </button>
          </div>
        </div>
      )}

      <nav className="relative flex-1 overflow-y-auto px-3 pb-8 scrollbar-thin">
        <SectionLabel collapsed={sidebarCollapsed}>Main</SectionLabel>
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} collapsed={sidebarCollapsed} />
        ))}

        <SectionLabel collapsed={sidebarCollapsed}>Scrutiny Services</SectionLabel>
        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setOpenScrutiny((o) => !o)}
            className="mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <span>Modules</span>
            <ChevronDown className={cn('h-4 w-4 transition', openScrutiny && 'rotate-180')} />
          </button>
        )}
        <AnimatePresence initial={false}>
          {(openScrutiny || sidebarCollapsed) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-0.5 overflow-hidden"
            >
              {scrutinyNav.map((item) => (
                <NavItem
                  key={item.to}
                  {...item}
                  collapsed={sidebarCollapsed}
                  disabled={division === 'vouching'}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <SectionLabel
          collapsed={sidebarCollapsed}
          right={
            !sidebarCollapsed ? (
              <Badge tone="slate" className="!normal-case !tracking-normal !text-[9px]">
                On hold
              </Badge>
            ) : null
          }
        >
          Vouching Division
        </SectionLabel>
        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setOpenVouching((o) => !o)}
            className="mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <span>Modules</span>
            <ChevronDown className={cn('h-4 w-4 transition', openVouching && 'rotate-180')} />
          </button>
        )}
        <AnimatePresence initial={false}>
          {(openVouching || sidebarCollapsed) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-0.5 overflow-hidden"
            >
              {vouchingNav.map((item) => (
                <NavItem
                  key={item.to}
                  {...item}
                  collapsed={sidebarCollapsed}
                  disabled={vouchingDisabled && item.to !== '/vouching'}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {!sidebarCollapsed && (
        <div className="relative border-t border-white/5 px-4 py-4 text-[10px] leading-relaxed text-slate-500">
          Signed path · {location.pathname}
        </div>
      )}
    </motion.aside>
  );
}
