import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.jsx';
import { AppUiProvider } from './context/AppUiContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppUiProvider>
        <App />
        <Toaster
          position="top-right"
          gutter={12}
          toastOptions={{
            duration: 4200,
            style: {
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.97)',
              color: '#0f172a',
              border: '1px solid rgba(226,232,240,0.95)',
              boxShadow: '0 14px 40px rgba(15,23,42,0.1)',
            },
          }}
        />
      </AppUiProvider>
    </BrowserRouter>
  </StrictMode>
);
