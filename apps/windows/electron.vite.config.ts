import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        // 只外部化 electron，其他依赖（electron-updater, ws）内联打包
        // 这样可以避免 pnpm 的传递依赖（如 fs-extra）无法被 electron-builder 正确打包的问题
        // bufferutil / utf-8-validate 是 ws 的可选原生模块，必须外部化（无法被 bundler 打包）
        exclude: ['electron-updater', 'ws', 'bufferutil', 'utf-8-validate']
      })
    ],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        },
        external: ['bufferutil', 'utf-8-validate']
      }
    },
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    server: {
      port: 5174,
      host: '127.0.0.1' // 确保监听 IPv4，避免 Electron 在 Windows 上无法连接 IPv6-only 的 Vite
    },
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    plugins: [react()]
  }
})
