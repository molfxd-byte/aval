import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
    watch: {
      // Scrapers/backfills rewrite these catalogs often; HMR would remount the form and wipe inputs.
      ignored: ['**/src/data/**/*.json'],
    },
  },
});
