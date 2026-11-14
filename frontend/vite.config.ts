import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyPrefix = env.VITE_API_PROXY_PREFIX || '/eneba-api';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/v1': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost',
          changeOrigin: true,
          rewrite: (path) => `${apiProxyPrefix}${path}`,
        },
      },
    },
  };
});
