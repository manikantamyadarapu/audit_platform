import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { TopFloatingNav } from './TopFloatingNav';

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-svh w-full">
      <TopFloatingNav />
      <Sidebar />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col pt-[4.75rem] sm:pt-[5.25rem]">
        <TopNavbar />
        <main className="relative flex-1 overflow-x-hidden px-4 py-8 sm:px-6 lg:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.06),_transparent_50%)]" />
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="relative mx-auto max-w-[1400px]"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
