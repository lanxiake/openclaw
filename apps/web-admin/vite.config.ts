import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Vite 配置
 *
 * Web 管理后台构建配置
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      // 代理 API 请求到 Gateway
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 代理 WebSocket 请求
      '/ws': {
        target: 'ws://localhost:3000',
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
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          charts: ['recharts'],
        },
      },
    },
  },
})
