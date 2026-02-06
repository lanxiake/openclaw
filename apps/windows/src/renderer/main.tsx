/**
 * Renderer Main Entry - 渲染进程入口
 *
 * React 应用的入口点
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

// 日志输出
console.log('[Renderer] 渲染进程启动')

// 创建 React 根节点
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

// 渲染应用
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

console.log('[Renderer] React 应用已挂载')
