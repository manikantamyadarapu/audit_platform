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
  Sparkles,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
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
        'group flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-medium transition-colors duration-150',
        disabled && 'cursor-not-allowed opacity-40',
        !disabled &&
          isActive &&
          'bg-emerald-50 font-semibold text-emerald-900 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]',
        !disabled && !isActive && 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900'
      )}
    >
      <Icon
        className={cn(
          'h-[18px] w-[18px] shrink-0 stroke-[1.75]',
          !disabled && isActive && 'text-emerald-700',
          !disabled && !isActive && 'text-slate-400 group-hover:text-slate-600'
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left">{label}</span>
          {soon ? (
            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
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
      className="block w-full"
    >
      {({ isActive }) => inner(isActive)}
    </NavLink>
  );
}

function SectionLabel({ collapsed, children, right }) {
  if (collapsed) {
    return <div className="my-2 h-px w-8 self-center bg-slate-200" />;
  }
  return (
    <div className="mb-2 mt-5 flex items-center justify-between gap-2 px-1 first:mt-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{children}</span>
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
      animate={{ width: sidebarCollapsed ? 80 : 274 }}
      transition={{ type: 'spring', stiffness: 320, damping: 38 }}
      className="relative z-20 flex h-svh shrink-0 flex-col border-r border-slate-200/90 bg-[var(--color-sidebar)]"
    >
      <div
        className={cn(
          'flex gap-3 border-b border-slate-200/60 px-4 py-6',
          sidebarCollapsed ? 'flex-col items-center' : 'items-start justify-between'
        )}
      >
        {!sidebarCollapsed ? (
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 shadow-md shadow-emerald-500/25">
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-tight text-slate-900">Audit Platform</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">Scrutiny suite</p>
            </div>
          </div>
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 text-sm font-bold text-white shadow-md">
            AP
          </div>
        )}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="shrink-0 rounded-[12px] border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {!sidebarCollapsed && (
        <div className="mx-4 mt-4 rounded-[14px] border border-slate-200/80 bg-white p-1 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setDivision('scrutiny')}
              className={cn(
                'rounded-xl px-2 py-2 text-xs font-semibold transition',
                division === 'scrutiny'
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              Scrutiny
            </button>
            <button
              type="button"
              onClick={() => setDivision('vouching')}
              className={cn(
                'rounded-xl px-2 py-2 text-xs font-semibold transition',
                division === 'vouching'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              Vouching
            </button>
          </div>
        </div>
      )}

      <nav className="flex flex-1 flex-col overflow-y-auto px-3 pb-6 pt-4 scrollbar-thin">
        <SectionLabel collapsed={sidebarCollapsed}>Menu</SectionLabel>
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} collapsed={sidebarCollapsed} />
        ))}

        <SectionLabel collapsed={sidebarCollapsed}>Scrutiny</SectionLabel>
        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setOpenScrutiny((o) => !o)}
            className="mb-1 flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-xs font-semibold text-slate-500 transition hover:bg-slate-100/80 hover:text-slate-800"
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
              <Badge tone="neutral" className="!normal-case !tracking-normal !text-[9px]">
                On hold
              </Badge>
            ) : null
          }
        >
          Vouching
        </SectionLabel>
        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setOpenVouching((o) => !o)}
            className="mb-1 flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-xs font-semibold text-slate-400 transition hover:bg-slate-100/80 hover:text-slate-700"
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

        <div className="mt-auto flex flex-col gap-2 pt-6">
          {!sidebarCollapsed ? (
            <>
              <button
                type="button"
                className="w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => toast('Release notes ship with deployment tags.', { icon: '📝' })}
              >
                Release notes
              </button>
              <button
                type="button"
                className="w-full rounded-[14px] px-3 py-2 text-left text-xs font-semibold text-slate-400 transition hover:text-slate-600"
                onClick={() => toast('Connect SSO to enable sign-out from this workspace.', { icon: '🔐' })}
              >
                Log out
              </button>
            </>
          ) : null}
        </div>
      </nav>

      {!sidebarCollapsed && (
        <div className="border-t border-slate-200/80 px-4 py-3 text-[10px] leading-relaxed text-slate-400">
          {location.pathname}
        </div>
      )}
    </motion.aside>
  );
}
