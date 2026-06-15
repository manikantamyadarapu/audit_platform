import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { User } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { NotificationBell } from './NotificationBell';

const TITLE_MAP = [
  { test: /^\/dashboard\/?$/, title: 'Dashboard' },
  { test: /^\/reports/, title: 'Reports' },
  { test: /^\/settings/, title: 'Settings' },
  { test: /^\/profile/, title: 'My Profile' },
  { test: /^\/users/, title: 'Users' },
  { test: /^\/scrutiny$/, title: 'Scrutiny' },
  { test: /^\/scrutiny\/pan/, title: 'PAN Verification' },
  { test: /^\/scrutiny\/gross-weight/, title: 'Gross Weight Audit' },
  { test: /^\/scrutiny\/sales-ledger/, title: 'Rate and Ledger Audit' },
  { test: /^\/sales-audit\/product-average-rates/, title: 'Product Average Rates' },
  { test: /^\/scrutiny\/making-charges/, title: 'Audit for Making Charges' },
  { test: /^\/scrutiny\/sales-return-rate/, title: 'Sales Return Audit' },
  { test: /^\/scrutiny\/(rate-rule-book|rate-rules|rule-book)/, title: 'Gold & Silver Rates' },
  { test: /^\/scrutiny\/diamond-gem-rates/, title: 'Diamond & Gemstone Rate Book' },
  { test: /^\/scrutiny\/duplicate-invoice/, title: 'Duplicate Invoice Check' },
  { test: /^\/scrutiny\/vendor-reconciliation/, title: 'Vendor Reconciliation' },
  { test: /^\/vouching$/, title: 'Vouching' },
  { test: /^\/vouching\//, title: 'Vouching' },
];

function matchTitle(pathname) {
  const found = TITLE_MAP.find((m) => m.test.test(pathname));
  return found?.title ?? 'Overview';
}

export function TopNavbar() {
  const { pathname } = useLocation();
  const viewTitle = useMemo(() => matchTitle(pathname), [pathname]);

  return (
    <header className="sticky top-0 z-30 h-20 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-overlay)] backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-5 sm:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-600">Current view · <span className="text-[var(--color-text-primary)]">{viewTitle}</span></p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle compact />

          <NotificationBell />

          <div className="flex h-14 items-center gap-3 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] py-1.5 pl-1.5 pr-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <User className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="hidden max-w-[7rem] truncate text-sm font-semibold text-[var(--color-text-primary)] sm:inline">Audit operator</span>
          </div>
        </div>
      </div>
    </header>
  );
}
