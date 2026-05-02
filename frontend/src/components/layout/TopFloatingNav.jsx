import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FileCheck,
  ShieldCheck,
  BarChart3,
  Settings,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAppUi } from '../../context/AppUiContext';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/vouching', label: 'Vouching', icon: FileCheck, key: 'vouching' },
  { to: '/scrutiny', label: 'Scrutiny', icon: ShieldCheck, key: 'scrutiny' },
  { to: '/reports', label: 'Reports', icon: BarChart3, key: 'reports' },
  { to: '/settings', label: 'Settings', icon: Settings, key: 'settings' },
];

function isFloatingNavActive(pathname, item) {
  if (item.key === 'dashboard') {
    return pathname === '/dashboard' || pathname === '/';
  }
  if (item.key === 'scrutiny') return pathname === '/scrutiny' || pathname.startsWith('/scrutiny/');
  if (item.key === 'vouching') return pathname === '/vouching' || pathname.startsWith('/vouching/');
  if (item.key === 'reports') return pathname === '/reports' || pathname.startsWith('/reports/');
  if (item.key === 'settings') return pathname === '/settings' || pathname.startsWith('/settings/');
  return pathname === item.to;
}

export function TopFloatingNav() {
  const { pathname } = useLocation();
  const { setDivision } = useAppUi();

  const handleNavClick = (key) => {
    if (key === 'scrutiny') setDivision('scrutiny');
    if (key === 'vouching') setDivision('vouching');
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-3 sm:top-5">
      <nav
        aria-label="Primary"
        className="pointer-events-auto w-full max-w-[min(100%,40rem)] rounded-full border border-indigo-200/45 bg-white/50 px-1.5 py-1.5 shadow-[0_10px_40px_rgba(15,23,42,0.07),0_2px_12px_rgba(79,70,229,0.06)] backdrop-blur-2xl sm:px-3 sm:py-2"
      >
        <ul
          role="list"
          className="flex items-stretch gap-0 overflow-x-auto scrollbar-thin pb-0.5 sm:justify-center sm:gap-0.5 sm:pb-0 md:gap-1"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isFloatingNavActive(pathname, item);

            return (
              <li key={item.key} className="shrink-0">
                <NavLink
                  to={item.to}
                  onClick={() => handleNavClick(item.key)}
                  className="group relative flex flex-col items-center rounded-2xl px-2.5 py-1 outline-none transition-transform duration-200 sm:px-4 sm:py-1.5 md:px-5 md:py-2 hover:scale-[1.05] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="relative flex h-10 w-10 items-center justify-center sm:h-11 sm:w-11">
                    {active ? (
                      <motion.span
                        layoutId="top-floating-nav-disc"
                        className="absolute inset-0 rounded-full bg-[#0a1628] shadow-[0_4px_16px_rgba(10,22,40,0.42),0_0_0_1px_rgba(255,255,255,0.07)]"
                        transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                      />
                    ) : null}
                    <Icon
                      className={cn(
                        'relative z-10 h-[1.125rem] w-[1.125rem] transition-colors duration-200 sm:h-5 sm:w-5',
                        active ? 'text-white' : 'text-indigo-600/78 group-hover:text-indigo-900'
                      )}
                      strokeWidth={active ? 2 : 1.75}
                      aria-hidden
                    />
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 max-w-[4.5rem] truncate text-center text-[10px] font-semibold tracking-tight transition-colors duration-200 sm:max-w-[5.5rem] sm:text-[11px]',
                      active ? 'text-[#0a1628]' : 'text-slate-500 group-hover:text-slate-800'
                    )}
                  >
                    {item.label}
                  </span>

                  <span
                    role="tooltip"
                    className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[110] hidden -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900/95 px-2.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-xl transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 sm:block"
                  >
                    {item.label}
                  </span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
