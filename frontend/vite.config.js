import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        // Large Excel: browser → Vite → Node → Python can exceed default proxy/socket limits.
        timeout: 900_000,
        proxyTimeout: 900_000,
      },
    },
  },
});
