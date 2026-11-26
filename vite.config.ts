import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react()],
  optimizeDeps: {
    include: ['lucide-react']
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        terminal: resolve(__dirname, 'terminal.html'),
      },
    },
  },
});
