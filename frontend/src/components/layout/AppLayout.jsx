import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { PageContentSkeleton } from './AppShellSkeleton';

export function AppLayout() {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/';

  return (
    <div className="flex min-h-svh w-full bg-transparent text-[var(--color-text-primary)]">
      <Sidebar />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        {!isDashboard ? <TopNavbar /> : null}
        <main className="relative flex-1 overflow-x-hidden bg-transparent px-5 py-6 lg:px-7">
          <AnimatePresence mode="sync">
            <motion.div
              key={location.pathname}
              initial={isDashboard ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={isDashboard ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="relative w-full"
            >
              <Suspense
                fallback={
                  <PageContentSkeleton variant={isDashboard ? 'dashboard' : 'default'} />
                }
              >
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
