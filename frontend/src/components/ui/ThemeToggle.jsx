import { Moon, Sun } from 'lucide-react';
import { useAppUi } from '../../context/AppUiContext';
import { cn } from '../../utils/cn';

export function ThemeToggle({ compact = false, className }) {
  const { theme, toggleTheme } = useAppUi();
  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      onClick={toggleTheme}
      className={cn(
        'inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_8px_22px_rgba(15,23,42,0.08)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
        compact ? 'w-12' : 'gap-2 px-4',
        className
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.8} />
      {!compact ? <span className="text-sm font-semibold">{isDark ? 'Light' : 'Dark'}</span> : null}
    </button>
  );
}
