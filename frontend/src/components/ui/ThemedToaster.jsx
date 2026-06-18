import { Toaster } from 'react-hot-toast';

/** Navbar is h-20 (80px); sit toasts just below it so they do not cover the user chip. */
const TOAST_TOP_OFFSET = 88;

export function ThemedToaster() {
  return (
    <Toaster
      position="top-right"
      gutter={10}
      containerStyle={{
        top: TOAST_TOP_OFFSET,
        right: 20,
        zIndex: 9999,
      }}
      toastOptions={{
        duration: 4200,
        style: {
          background: 'transparent',
          boxShadow: 'none',
          padding: 0,
        },
      }}
    />
  );
}
