import { Toaster } from 'react-hot-toast';

export function ThemedToaster() {
  return (
    <Toaster
      position="top-right"
      gutter={14}
      containerStyle={{ top: 20, right: 20 }}
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
