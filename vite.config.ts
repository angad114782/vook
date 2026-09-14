import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiOnly = env.VITE_DATA_MODE?.trim().toLowerCase() === 'api';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: apiOnly
        ? [{ find: /^\.\/mocks\/start$/, replacement: fileURLToPath(new URL('./src/config/disabledMockBootstrap.ts', import.meta.url)) }]
        : [],
    },
    server: {
      host: true,
    },
  };
});
