import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import { router } from './routes'
import { Toaster } from './components/ui/toaster'
import { gateway } from './services'
import './styles/globals.css'

/**
 * TanStack Query 客户端配置
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 分钟
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * 初始化 Gateway 连接
 * 在应用启动时自动连接
 */
gateway.connect().catch((error) => {
  console.error('[main] Gateway 连接失败:', error)
})

/**
 * 应用入口
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>
)
