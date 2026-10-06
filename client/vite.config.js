import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:5050';

export default defineConfig({
  plugins: [react()],
  server: {
    // 5173 is taken by another app on this machine; strictPort keeps the address fixed.
    port: Number(process.env.PORT) || 5174,
    strictPort: true,
    proxy: {
      '/api': apiTarget,
      '/uploads': apiTarget,
      '/robots.txt': apiTarget,
      '/sitemap.xml': apiTarget,
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          pdf: ['jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
