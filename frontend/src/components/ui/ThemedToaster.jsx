import { Toaster } from 'react-hot-toast';
import { useAppUi } from '../../context/AppUiContext';

export function ThemedToaster() {
  const { theme } = useAppUi();
  const isDark = theme === 'dark';

  return (
    <Toaster
      position="top-right"
      gutter={12}
      toastOptions={{
        duration: 4200,
        style: {
          borderRadius: '16px',
          background: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
          color: isDark ? '#e2e8f0' : '#0f172a',
          border: isDark ? '1px solid rgba(51,65,85,0.95)' : '1px solid rgba(226,232,240,0.95)',
          boxShadow: isDark ? '0 14px 40px rgba(0,0,0,0.38)' : '0 14px 40px rgba(15,23,42,0.1)',
        },
      }}
    />
  );
}
