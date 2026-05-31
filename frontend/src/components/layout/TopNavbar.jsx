import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { ThemeToggle } from '../ui/ThemeToggle';
import { cn } from '../../utils/cn';

const TITLE_MAP = [
  { test: /^\/dashboard\/?$/, title: 'Dashboard' },
  { test: /^\/reports/, title: 'Reports' },
  { test: /^\/settings/, title: 'Settings' },
  { test: /^\/scrutiny$/, title: 'Scrutiny' },
  { test: /^\/scrutiny\/pan/, title: 'PAN Verification' },
  { test: /^\/scrutiny\/gross-weight/, title: 'Gross Weight Audit' },
  { test: /^\/scrutiny\/sales-ledger/, title: 'Rate and Ledger Audit' },
  { test: /^\/scrutiny\/making-charges/, title: 'Audit for Making Charges' },
  { test: /^\/scrutiny\/sales-return-rate/, title: 'Sales Return Rate Audit' },
  { test: /^\/scrutiny\/(rate-rule-book|rate-rules|rule-book)/, title: 'Gold & Silver Rates' },
  { test: /^\/scrutiny\/diamond-gem-rates/, title: 'Diamond & Gemstone Rate Book' },
  { test: /^\/scrutiny\/gst/, title: 'GST Verification' },
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
    <header className="sticky top-0 z-10 h-20 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-5 sm:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-600">Current view · <span className="text-slate-800">{viewTitle}</span></p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle compact />

          <button
            type="button"
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800'
            )}
            aria-label="Notifications"
            onClick={() => toast('No new notifications.', { icon: '🔔' })}
          >
            <Bell className="h-5 w-5" strokeWidth={1.5} />
          </button>

          <div className="flex h-14 items-center gap-3 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <User className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="hidden max-w-[7rem] truncate text-sm font-semibold text-slate-800 sm:inline">Audit operator</span>
          </div>
        </div>
      </div>
    </header>
  );
}
