import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AppUiProvider } from './context/AppUiContext.jsx';
import { ThemedToaster } from './components/ui/ThemedToaster.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppUiProvider>
        <App />
        <ThemedToaster />
      </AppUiProvider>
    </BrowserRouter>
  </StrictMode>
);
