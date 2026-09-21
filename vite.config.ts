import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const isAndroidBuild =
  process.env.BUILD_TARGET === 'android';

export default defineConfig({
  base: isAndroidBuild ? './' : '/',

  plugins: [react()],

  server: {
    port: 3000,
    host: '0.0.0.0',
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});