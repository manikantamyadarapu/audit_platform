import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.VITE_BACKEND_PORT || '4001';
  const backendTarget = `http://127.0.0.1:${backendPort}`;

  return {
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(env.VITE_DEV_PORT || 4000),
    strictPort: true,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        /** Match Node → Python proxy timeout — large spreadsheets can exceed the default (~2 min). */
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
    },
  },
};
});
