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
              borderRadius: '14px',
              background: 'rgba(15,23,42,0.94)',
              color: '#f8fafc',
              border: '1px solid rgba(148,163,184,0.25)',
              boxShadow: '0 18px 40px rgba(15,23,42,0.35)',
            },
          }}
        />
      </AppUiProvider>
    </BrowserRouter>
  </StrictMode>
);
