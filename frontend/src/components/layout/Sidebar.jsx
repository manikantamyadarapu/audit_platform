import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Coins,
  FileSpreadsheet,
  Folder,
  Gem,
  GitBranch,
  LayoutDashboard,
  ListTree,
  Scale,
  Settings,
  Undo2,
  Wallet,
  Landmark,
  Weight,
  LogOut,
  UserCircle,
  ShoppingCart,
  Receipt,
  Percent,
  FileText,
} from 'lucide-react';
import { logoutRequest } from '../../services/auth.service';
import { cn } from '../../utils/cn';
import { preloadAuditRoute } from '../../utils/auditRoutePreload';
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
];

const purchaseItems = [
  { to: '/scrutiny/purchase/gross-weight', label: 'Gross Weight Audit', icon: Weight },
  { to: '/scrutiny/purchase/rate-ledger', label: 'Rate and Ledger Audit', icon: BookOpen },
  { to: '/scrutiny/purchase/return-rate', label: 'Purchase Return Audit', icon: Undo2 },
];

const scrutinyItems = [
  { to: '/scrutiny/rate-rule-book', label: 'Gold & Silver Rates', icon: Coins },
  { to: '/scrutiny/diamond-gem-rates', label: 'Rate Master ', icon: Gem },
];

const tdsItems = [
  { to: '/scrutiny/tds/party-wise-summary', label: 'Party Wise Summary', icon: Receipt },
  { to: '/scrutiny/tds/rate-0.1', label: 'TDS @ 0.1%', icon: Percent },
  { to: '/scrutiny/tds/rule-book', label: 'TDS Rule Book', icon: FileText },
];

const vouchingItems = [
  { label: 'Voucher Matching', icon: GitBranch },
  { label: 'Ledger Review', icon: ListTree },
];

const navActive =
  'bg-[color-mix(in_srgb,var(--color-accent-soft)_55%,var(--color-surface-elevated))] text-emerald-700 dark:text-emerald-400';
const navIdle =
  'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]';

function isAdminRole(role) {
  return String(role || '').toUpperCase() === 'ADMIN';
}

function isAdminOnlyBadge(badge) {
  const normalized = String(badge || '').toUpperCase();
  return normalized === 'PENDING' || normalized === 'HOLD';
}

function resolveSidebarBadge(badge, role) {
  if (!badge) return undefined;
  if (isAdminOnlyBadge(badge)) {
    return isAdminRole(role) ? badge : undefined;
  }
  return badge;
}

function canShowAdminOnlyFeature(role) {
  return isAdminRole(role);
}

function NavItem({ to, label, icon: Icon, end, collapsed, onNavigate, nested, badge, userRole }) {
  const displayBadge = resolveSidebarBadge(badge, userRole);
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      onMouseEnter={() => preloadAuditRoute(to)}
      onFocus={() => preloadAuditRoute(to)}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all',
          nested && !collapsed && 'ml-3 h-10 w-[calc(100%-0.75rem)]',
          isActive ? navActive : navIdle
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
      {!collapsed ? (
        <>
          <span className={cn('truncate', displayBadge && 'flex-1')}>{label}</span>
          {displayBadge ? (
            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              {displayBadge}
            </span>
          ) : null}
        </>
      ) : null}
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

function NavGroup({ label, icon: Icon, collapsed, open, onToggle, active, badge, userRole, children, to, nested }) {
  const displayBadge = resolveSidebarBadge(badge, userRole);
  if (collapsed) {
    if (nested) {
      return (
        <button
          type="button"
          onClick={onToggle}
          title={label}
          className={cn(
            'group flex h-11 w-full items-center justify-center rounded-lg px-3 text-sm font-medium transition-all',
            active ? navActive : navIdle
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
            isActive || active ? navActive : navIdle
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
          active ? navActive : navIdle
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
        <span className="flex-1 truncate text-left">{label}</span>
        {displayBadge ? (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            {displayBadge}
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
  const purchaseChildActive = ['/scrutiny/purchase/gross-weight', '/scrutiny/purchase/rate-ledger', '/scrutiny/purchase/return-rate'].some((path) => pathname.startsWith(path));
  const tdsChildActive = ['/scrutiny/tds/party-wise-summary', '/scrutiny/tds/rate-0.1', '/scrutiny/tds/rule-book'].some((path) => pathname.startsWith(path));
  const otherFeaturesChildActive = pathname.startsWith('/scrutiny/section44ab');

  const [scrutinyOpen, setScrutinyOpen] = useState(scrutinyActive);
  const [vouchingOpen, setVouchingOpen] = useState(vouchingActive);
  const [salesOpen, setSalesOpen] = useState(salesChildActive);
  const [purchaseOpen, setPurchaseOpen] = useState(purchaseChildActive);
  const [otherFeaturesOpen, setOtherFeaturesOpen] = useState(otherFeaturesChildActive);
  const [tdsOpen, setTdsOpen] = useState(tdsChildActive);
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
  const userRole = sessionUser?.role;
  const isAdmin = canShowAdminOnlyFeature(userRole);

  useEffect(() => {
    if (scrutinyActive) setScrutinyOpen(true);
  }, [scrutinyActive]);

  useEffect(() => {
    if (vouchingActive) setVouchingOpen(true);
  }, [vouchingActive]);

  useEffect(() => {
    if (salesChildActive) setSalesOpen(true);
  }, [salesChildActive]);

  useEffect(() => {
    if (purchaseChildActive) setPurchaseOpen(true);
  }, [purchaseChildActive]);

  useEffect(() => {
    if (otherFeaturesChildActive) setOtherFeaturesOpen(true);
  }, [otherFeaturesChildActive]);

  useEffect(() => {
    if (tdsChildActive) setTdsOpen(true);
  }, [tdsChildActive]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 80 : 280 }}
      transition={{ type: 'spring', stiffness: 320, damping: 38 }}
      className="sticky top-0 z-20 flex h-svh shrink-0 flex-col border-r border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-glass)]"
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)]"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)]"
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
            <NavGroup
              label="Purchase"
              icon={ShoppingCart}
              collapsed={sidebarCollapsed}
              open={purchaseOpen}
              onToggle={() => setPurchaseOpen((v) => !v)}
              active={false}
              nested
            >
              {purchaseItems.map((item) => (
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
            <NavItem
              to="/scrutiny/cash-ledger"
              label="Cash"
              icon={Wallet}
              collapsed={sidebarCollapsed}
              nested
              onNavigate={ensureScrutiny}
            />
            <NavGroup
              label="Other Features"
              icon={Folder}
              collapsed={sidebarCollapsed}
              open={otherFeaturesOpen}
              onToggle={() => setOtherFeaturesOpen((v) => !v)}
              active={false}
              nested
            >
              <div className="ml-3">
                <NavItem
                  to="/scrutiny/section44ab"
                  label="Section 44AB"
                  icon={Calculator}
                  collapsed={sidebarCollapsed}
                  nested
                  onNavigate={ensureScrutiny}
                />
              </div>
            </NavGroup>
            {isAdmin ? (
              <NavGroup
                label="TDS Audit"
                icon={Calculator}
                collapsed={sidebarCollapsed}
                open={tdsOpen}
                onToggle={() => setTdsOpen((v) => !v)}
                active={false}
                nested
                badge="PENDING"
                userRole={userRole}
              >
                {tdsItems.map((item) => (
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
            ) : null}
            {isAdmin ? (
              <NavItem
                to="/scrutiny/negative-bank"
                label="Negative Bank"
                icon={Landmark}
                collapsed={sidebarCollapsed}
                nested
                onNavigate={ensureScrutiny}
                badge="PENDING"
                userRole={userRole}
              />
            ) : null}
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

          {isAdmin ? (
            <NavGroup
              label="Vouching"
              icon={GitBranch}
              collapsed={sidebarCollapsed}
              open={vouchingOpen}
              onToggle={() => setVouchingOpen((v) => !v)}
              active={vouchingActive}
              badge="Hold"
              userRole={userRole}
            >
              {vouchingItems.map((item) => (
                <DisabledItem key={item.label} {...item} collapsed={sidebarCollapsed} nested />
              ))}
            </NavGroup>
          ) : null}

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
                className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-float)]"
              >
                <div className="flex flex-col items-center border-b border-[var(--color-border-soft)] bg-gradient-to-b from-emerald-50/80 to-[var(--color-surface-elevated)] px-4 py-6 dark:from-emerald-950/40 dark:to-[var(--color-surface-elevated)]">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white shadow-[0_12px_32px_rgba(5,150,105,0.28)] ring-4 ring-[var(--color-surface-elevated)]">
                    {initials}
                  </div>
                  <p className="text-center text-sm font-bold text-[var(--color-text-primary)]">{displayName}</p>
                  {displayEmail ? (
                    <p className="mt-0.5 max-w-full truncate text-center text-xs text-[var(--color-text-muted)]">
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
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-emerald-50/80 hover:text-emerald-800 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
                  >
                    <UserCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>My Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/settings');
                      setShowUserMenu(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-emerald-50/80 hover:text-emerald-800 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
                  >
                    <Settings className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await logoutRequest();
                      } catch {
                        // Clear local session even if server logout fails.
                      }
                      clearAuthSession();
                      navigate('/login');
                      setShowUserMenu(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                  >
                    <LogOut className="h-4 w-4 text-rose-500 dark:text-rose-400" />
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
              'w-full rounded-full border bg-[var(--color-surface-elevated)] px-4 py-3 shadow-[var(--shadow-glass)] transition-colors',
              showUserMenu
                ? 'border-emerald-200/90 ring-2 ring-emerald-500/15 dark:border-emerald-800/60'
                : 'border-[var(--color-border-soft)] hover:border-emerald-200/80 hover:bg-[var(--color-surface-subtle)] dark:hover:border-emerald-800/60'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                {initials}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{displayName}</p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">{displayEmail || 'Signed in'}</p>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform',
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
