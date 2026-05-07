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
        /** Match Node → Python proxy timeout — large spreadsheets can exceed the default (~2 min). */
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
    },
  },
});
