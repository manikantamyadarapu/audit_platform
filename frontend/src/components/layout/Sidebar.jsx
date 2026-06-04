import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BellRing,
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Coins,
  FileSpreadsheet,
  Gem,
  GitBranch,
  LayoutDashboard,
  ListTree,
  Scale,
  Settings,
  Undo2,
  Weight,
  LogOut,
  UserCircle,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAppUi } from '../../context/AppUiContext';
import {
  clearAuthSession,
  fetchCurrentUser,
  getStoredUser,
  getUserInitials,
} from '../../utils/authUser';

const salesItems = [
  { to: '/scrutiny/pan', label: 'ID Proof Audit', icon: ClipboardCheck },
  { to: '/scrutiny/gross-weight', label: 'Gross Weight Audit', icon: Weight },
  { to: '/scrutiny/sales-ledger', label: 'Rate and Ledger Audit', icon: BookOpen },
  { to: '/scrutiny/sales-return-rate', label: 'Sales Return Audit', icon: Undo2 },
  { to: '/scrutiny/making-charges', label: 'Making Charges Audit', icon: Calculator },
];

const scrutinyItems = [
  { to: '/scrutiny/rate-rule-book', label: 'Gold & Silver Rates', icon: Coins },
  { to: '/scrutiny/diamond-gem-rates', label: 'Rate Master ', icon: Gem },
];

const vouchingItems = [
  { label: 'Voucher Matching', icon: GitBranch },
  { label: 'Ledger Review', icon: ListTree },
];

function NavItem({ to, label, icon: Icon, end, collapsed, onNavigate, nested }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all',
          nested && !collapsed && 'ml-3 h-10 w-[calc(100%-0.75rem)]',
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

function DisabledItem({ label, icon: Icon, collapsed, nested }) {
  return (
    <div
      title={collapsed ? `${label} - On hold` : undefined}
      className={cn(
        'flex h-11 w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-400 opacity-70',
        nested && !collapsed && 'ml-3 h-10 w-[calc(100%-0.75rem)]'
      )}
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

function NavGroup({ label, icon: Icon, collapsed, open, onToggle, active, badge, children, to, nested }) {
  if (collapsed) {
    if (nested) {
      return (
        <button
          type="button"
          onClick={onToggle}
          title={label}
          className={cn(
            'group flex h-11 w-full items-center justify-center rounded-lg px-3 text-sm font-medium transition-all',
            active
              ? 'bg-gradient-to-r from-[#dff5df] to-[#d8f3e9] text-[#07812f]'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
        </button>
      );
    }

    return (
      <NavLink
        to={to ?? (label === 'Scrutiny' ? '/scrutiny' : '/vouching')}
        title={label}
        className={({ isActive }) =>
          cn(
            'group flex h-11 w-full items-center justify-center rounded-lg px-3 text-sm font-medium transition-all',
            isActive || active
              ? 'bg-gradient-to-r from-[#dff5df] to-[#d8f3e9] text-[#07812f]'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
          )
        }
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
      </NavLink>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all',
          nested && 'ml-3 h-10 w-[calc(100%-0.75rem)]',
          active
            ? 'bg-gradient-to-r from-[#dff5df] to-[#d8f3e9] text-[#07812f]'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
        <span className="flex-1 truncate text-left">{label}</span>
        {badge ? (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            {badge}
          </span>
        ) : null}
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden space-y-1"
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const { sidebarCollapsed, setSidebarCollapsed, setDivision } = useAppUi();
  const { pathname } = useLocation();
  const ensureScrutiny = () => setDivision('scrutiny');

  const scrutinyActive = pathname.startsWith('/scrutiny');
  const vouchingActive = pathname.startsWith('/vouching');
  const salesChildActive = ['/scrutiny/pan', '/scrutiny/gross-weight', '/scrutiny/sales-ledger', '/scrutiny/making-charges', '/scrutiny/sales-return-rate'].some((path) => pathname.startsWith(path));

  const [scrutinyOpen, setScrutinyOpen] = useState(scrutinyActive);
  const [vouchingOpen, setVouchingOpen] = useState(vouchingActive);
  const [salesOpen, setSalesOpen] = useState(salesChildActive);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sessionUser, setSessionUser] = useState(() => getStoredUser());

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setSessionUser(stored);
    fetchCurrentUser()
      .then((user) => {
        if (user) setSessionUser(user);
      })
      .catch(() => {});
  }, [pathname]);

  const displayName = sessionUser?.name || 'User';
  const displayEmail = sessionUser?.email || '';
  const initials = getUserInitials(displayName);

  useEffect(() => {
    if (scrutinyActive) setScrutinyOpen(true);
  }, [scrutinyActive]);

  useEffect(() => {
    if (vouchingActive) setVouchingOpen(true);
  }, [vouchingActive]);

  useEffect(() => {
    if (salesChildActive) setSalesOpen(true);
  }, [salesChildActive]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 80 : 280 }}
      transition={{ type: 'spring', stiffness: 320, damping: 38 }}
      className="sticky top-0 z-20 flex h-svh shrink-0 flex-col border-r border-slate-200 bg-white shadow-[10px_0_35px_rgba(15,23,42,0.04)]"
    >
      <div className={cn('flex items-center justify-between gap-3 px-6 pb-4 pt-5', sidebarCollapsed && 'flex-col items-center px-4')}>
        {!sidebarCollapsed ? (
          <>
            <div className="flex flex-col">
              <p className="text-xl font-bold tracking-tight text-[#07812f]">HAA</p>
              <p className="text-xs font-bold uppercase tracking-wider text-[#07812f]/80">Enterprise Audit Suite</p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-6 pb-6 scrollbar-thin">
        <div className="space-y-1">
          <NavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} end collapsed={sidebarCollapsed} />

          <NavGroup
            label="Scrutiny"
            icon={Scale}
            collapsed={sidebarCollapsed}
            open={scrutinyOpen}
            onToggle={() => setScrutinyOpen((v) => !v)}
            active={scrutinyActive}
          >
            <NavGroup
              label="Sales"
              icon={FileSpreadsheet}
              collapsed={sidebarCollapsed}
              open={salesOpen}
              onToggle={() => setSalesOpen((v) => !v)}
              active={false}
              nested
            >
              {salesItems.map((item) => (
                <div key={item.to} className="ml-3">
                  <NavItem
                    {...item}
                    collapsed={sidebarCollapsed}
                    nested
                    onNavigate={ensureScrutiny}
                  />
                </div>
              ))}
            </NavGroup>
            {scrutinyItems.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                collapsed={sidebarCollapsed}
                nested
                onNavigate={ensureScrutiny}
              />
            ))}
          </NavGroup>

          <NavGroup
            label="Vouching"
            icon={GitBranch}
            collapsed={sidebarCollapsed}
            open={vouchingOpen}
            onToggle={() => setVouchingOpen((v) => !v)}
            active={vouchingActive}
            badge="Hold"
          >
            {vouchingItems.map((item) => (
              <DisabledItem key={item.label} {...item} collapsed={sidebarCollapsed} nested />
            ))}
          </NavGroup>

          <NavItem to="/reports" label="Reports" icon={BellRing} collapsed={sidebarCollapsed} />
          <NavItem to="/users" label="Users" icon={UserCircle} collapsed={sidebarCollapsed} />
          <NavItem to="/settings" label="Settings" icon={Settings} collapsed={sidebarCollapsed} />
        </div>
      </nav>

      {!sidebarCollapsed ? (
        <div className="relative mx-5 mb-5 mt-auto">
          <AnimatePresence>
            {showUserMenu ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]"
              >
                <div className="flex flex-col items-center border-b border-slate-100 bg-gradient-to-b from-emerald-50/80 to-white px-4 py-6">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white shadow-[0_12px_32px_rgba(5,150,105,0.28)] ring-4 ring-white">
                    {initials}
                  </div>
                  <p className="text-center text-sm font-bold text-slate-900">{displayName}</p>
                  {displayEmail ? (
                    <p className="mt-0.5 max-w-full truncate text-center text-xs text-slate-500">
                      {displayEmail}
                    </p>
                  ) : null}
                </div>

                <div className="py-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/profile');
                      setShowUserMenu(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-emerald-50/80 hover:text-emerald-800"
                  >
                    <UserCircle className="h-4 w-4 text-emerald-600" />
                    <span>My Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/settings');
                      setShowUserMenu(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-emerald-50/80 hover:text-emerald-800"
                  >
                    <Settings className="h-4 w-4 text-emerald-600" />
                    <span>Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearAuthSession();
                      navigate('/login');
                      setShowUserMenu(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-rose-50 hover:text-rose-700"
                  >
                    <LogOut className="h-4 w-4 text-rose-500" />
                    <span>Log Out</span>
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setShowUserMenu((v) => !v)}
            className={cn(
              'w-full rounded-full border bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition-colors',
              showUserMenu
                ? 'border-emerald-200/90 ring-2 ring-emerald-500/15'
                : 'border-slate-200 hover:border-emerald-200/80 hover:bg-slate-50/80'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                {initials}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-bold text-slate-950">{displayName}</p>
                <p className="truncate text-xs text-slate-600">{displayEmail || 'Signed in'}</p>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-slate-500 transition-transform',
                  showUserMenu && 'rotate-180'
                )}
              />
            </div>
          </button>
        </div>
      ) : null}
    </motion.aside>
  );
}
