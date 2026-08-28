import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // iPad mini panels sit on older Safari builds; skip the modern-syntax output.
    target: ['es2019', 'safari13'],
  },
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': 'http://localhost:4100' },
  },
});
