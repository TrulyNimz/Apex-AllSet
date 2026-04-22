import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@':           path.resolve(__dirname, './src'),
      '@store':      path.resolve(__dirname, './src/store'),
      '@hooks':      path.resolve(__dirname, './src/hooks'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features':   path.resolve(__dirname, './src/features'),
      '@services':   path.resolve(__dirname, './src/services'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target:      'http://localhost:8080',
        changeOrigin: true,
        ws:          true,
      },
    },
  },
})
