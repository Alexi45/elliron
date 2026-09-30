import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5185,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      // las fotos de los productos las guarda y sirve la API
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
});
