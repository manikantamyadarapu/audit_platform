import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devPort = Number(env.VITE_DEV_PORT) || 4000;
  const backendPort = Number(env.VITE_BACKEND_PORT) || 4002;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: devPort,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
          // Large Excel: browser -> Vite -> Node -> Python can exceed default proxy/socket limits.
          timeout: 900_000,
          proxyTimeout: 900_000,
        },
      },
    },
  };
});
