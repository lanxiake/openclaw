import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Vite 配置
 *
 * OpenClaw 服务端管理后台构建配置
 */
export default defineConfig({
  base: '/admin/',

  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5176,
    proxy: {
      '/api/admin': {
        target: 'http://localhost:18789',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:18789',
        ws: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-alert-dialog',
          ],
          charts: ['recharts'],
        },
      },
    },
  },
})
