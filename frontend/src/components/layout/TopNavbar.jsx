import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, UploadCloud, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

const TITLE_MAP = [
  { test: /^\/dashboard\/?$/, title: 'Dashboard' },
  { test: /^\/reports/, title: 'Reports' },
  { test: /^\/settings/, title: 'Settings' },
  { test: /^\/scrutiny$/, title: 'Scrutiny' },
  { test: /^\/scrutiny\/pan/, title: 'PAN Verification' },
  { test: /^\/scrutiny\/gross-weight/, title: 'Gross Weight Audit' },
  { test: /^\/scrutiny\/sales-ledger/, title: 'Sales Ledger' },
  { test: /^\/scrutiny\/gst/, title: 'GST Verification' },
  { test: /^\/scrutiny\/duplicate-invoice/, title: 'Duplicate Invoice Check' },
  { test: /^\/scrutiny\/vendor-reconciliation/, title: 'Vendor Reconciliation' },
  { test: /^\/vouching$/, title: 'Vouching' },
  { test: /^\/vouching\//, title: 'Vouching' },
];

function matchTitle(pathname) {
  const found = TITLE_MAP.find((m) => m.test.test(pathname));
  return found?.title ?? 'Audit Platform';
}

export function TopNavbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = useMemo(() => matchTitle(pathname), [pathname]);

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/45 backdrop-blur-2xl">
      <div className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600/80">Current view</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        </div>

        <div className="flex flex-1 flex-col gap-3 lg:max-w-3xl lg:flex-row lg:items-center lg:justify-end">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10"
              placeholder="Global search (modules, reports, history)…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  toast('Search is not wired yet — module registry coming next.', { icon: '🔎' });
                }
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="primary"
              size="md"
              className="shadow-blue-500/30"
              onClick={() => navigate('/scrutiny/pan')}
            >
              <UploadCloud className="h-4 w-4" />
              Quick upload
            </Button>

            <button
              type="button"
              className={cn(
                'rounded-full border border-indigo-200/50 bg-indigo-50/60 p-2.5 text-indigo-600/90 shadow-sm transition',
                'hover:scale-105 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md active:scale-95'
              )}
              aria-label="Notifications"
              onClick={() => toast('No new notifications.', { icon: '🔔' })}
            >
              <Bell className="h-5 w-5" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-200/50 bg-indigo-50/70 text-indigo-700 shadow-sm transition hover:scale-105 hover:shadow-md active:scale-95"
              aria-label="User menu"
              onClick={() => toast('Profile menu placeholder.', { icon: '👤' })}
            >
              <User className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
