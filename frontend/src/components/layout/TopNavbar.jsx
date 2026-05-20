import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, UploadCloud, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ui/ThemeToggle';
import { cn } from '../../utils/cn';

const TITLE_MAP = [
  { test: /^\/dashboard\/?$/, title: 'Dashboard' },
  { test: /^\/reports/, title: 'Reports' },
  { test: /^\/settings/, title: 'Settings' },
  { test: /^\/scrutiny$/, title: 'Scrutiny' },
  { test: /^\/scrutiny\/pan/, title: 'PAN Verification' },
  { test: /^\/scrutiny\/gross-weight/, title: 'Gross Weight Audit' },
  { test: /^\/scrutiny\/sales-ledger/, title: 'Sales Ledger' },
  { test: /^\/scrutiny\/(rate-rules|rule-book)/, title: 'Rule Book' },
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

function greetingLine() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatToday() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

export function TopNavbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const viewTitle = useMemo(() => matchTitle(pathname), [pathname]);
  const greeting = greetingLine();
  const dateLine = formatToday();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      <div className="flex flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
            {greeting}, HAA
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">{dateLine}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Current view · {viewTitle}</p>
        </div>

        <div className="flex w-full flex-col gap-3 lg:max-w-xl lg:flex-row lg:items-center lg:justify-end">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="border-slate-200/90 bg-white pl-11"
              placeholder="Search modules, reports…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  toast('Search is not wired yet — module registry coming next.', { icon: '🔎' });
                }
              }}
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="primary" size="md" onClick={() => navigate('/scrutiny/pan')}>
              <UploadCloud className="h-4 w-4" />
              Quick upload
            </Button>

            <ThemeToggle compact />

            <button
              type="button"
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_8px_22px_rgba(15,23,42,0.08)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800'
              )}
              aria-label="Notifications"
              onClick={() => toast('No new notifications.', { icon: '🔔' })}
            >
              <Bell className="h-5 w-5" strokeWidth={1.5} />
            </button>

            <div className="flex h-14 items-center gap-3 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-5 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <User className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="hidden max-w-[7rem] truncate text-sm font-semibold text-slate-800 sm:inline">Audit operator</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
