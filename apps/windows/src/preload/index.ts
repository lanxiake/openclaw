/**
 * Preload Script - 预加载脚本
 *
 * 在渲染进程加载前执行，提供安全的 IPC 桥接
 * 使用 contextBridge 暴露 API 给渲染进程
 */

import { contextBridge, ipcRenderer } from 'electron'

// 日志输出
const log = {
  info: (...args: unknown[]) => console.log('[Preload]', ...args),
  error: (...args: unknown[]) => console.error('[Preload]', ...args),
}

log.info('预加载脚本开始执行')

/**
 * 确认请求的数据结构
 */
export interface ConfirmRequest {
  /** 唯一请求 ID */
  requestId: string
  /** 操作名称 */
  action: string
  /** 操作描述 */
  description: string
  /** 风险等级 */
  level: 'low' | 'medium' | 'high'
  /** 超时时间 (毫秒) */
  timeoutMs: number
}

/**
 * 定义暴露给渲染进程的 API 类型
 */
export interface ElectronAPI {
  // Gateway 相关
  gateway: {
    connect: (url: string, options?: { token?: string }) => Promise<void>
    disconnect: () => Promise<void>
    isConnected: () => Promise<boolean>
    call: <T>(method: string, params?: unknown) => Promise<T>
    onStatusChange: (callback: (connected: boolean) => void) => () => void
    onMessage: (callback: (message: unknown) => void) => () => void
    onConfirmRequest: (callback: (request: ConfirmRequest) => void) => () => void
  }

  // 文件操作
  file: {
    list: (dirPath: string) => Promise<unknown[]>
    read: (filePath: string) => Promise<string>
    write: (filePath: string, content: string) => Promise<void>
    move: (sourcePath: string, destPath: string) => Promise<void>
    copy: (sourcePath: string, destPath: string) => Promise<void>
    delete: (filePath: string) => Promise<void>
    createDir: (dirPath: string) => Promise<void>
    exists: (filePath: string) => Promise<boolean>
    getInfo: (filePath: string) => Promise<unknown>
    search: (dirPath: string, pattern: string, options?: unknown) => Promise<unknown[]>
  }

  // 系统信息
  system: {
    getInfo: () => Promise<unknown>
    getDiskInfo: () => Promise<unknown[]>
    getProcessList: () => Promise<unknown[]>
    killProcess: (pid: number) => Promise<void>
    launchApp: (appPath: string, args?: string[]) => Promise<void>
    executeCommand: (command: string) => Promise<{ stdout: string; stderr: string }>
    getUserPaths: () => Promise<{
      home: string
      desktop: string
      documents: string
      downloads: string
    }>
  }

  // 窗口操作
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
  }

  // 应用操作
  app: {
    getVersion: () => Promise<string>
    quit: () => void
    openExternal: (url: string) => Promise<void>
  }

  // 对话框
  dialog: {
    showOpenDialog: (options: unknown) => Promise<unknown>
    showSaveDialog: (options: unknown) => Promise<unknown>
    showMessageBox: (options: unknown) => Promise<unknown>
  }

  // 剪贴板
  clipboard: {
    readText: () => Promise<string>
    writeText: (text: string) => Promise<void>
  }
}

/**
 * 创建事件监听器移除函数
 */
function createEventListener(channel: string, callback: (...args: unknown[]) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

/**
 * 暴露给渲染进程的 API
 */
const electronAPI: ElectronAPI = {
  // Gateway 相关 API
  gateway: {
    connect: (url: string, options?: { token?: string }) =>
      ipcRenderer.invoke('gateway:connect', url, options),
    disconnect: () => ipcRenderer.invoke('gateway:disconnect'),
    isConnected: () => ipcRenderer.invoke('gateway:isConnected'),
    call: <T>(method: string, params?: unknown) =>
      ipcRenderer.invoke('gateway:call', method, params) as Promise<T>,
    onStatusChange: (callback: (connected: boolean) => void) =>
      createEventListener('gateway:status-change', callback as (...args: unknown[]) => void),
    onMessage: (callback: (message: unknown) => void) =>
      createEventListener('gateway:message', callback),
    onConfirmRequest: (callback: (request: ConfirmRequest) => void) =>
      createEventListener('confirm:request', callback as (...args: unknown[]) => void),
  },

  // 文件操作 API
  file: {
    list: (dirPath: string) => ipcRenderer.invoke('file:list', dirPath),
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    write: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
    move: (sourcePath: string, destPath: string) =>
      ipcRenderer.invoke('file:move', sourcePath, destPath),
    copy: (sourcePath: string, destPath: string) =>
      ipcRenderer.invoke('file:copy', sourcePath, destPath),
    delete: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
    createDir: (dirPath: string) => ipcRenderer.invoke('file:createDir', dirPath),
    exists: (filePath: string) => ipcRenderer.invoke('file:exists', filePath),
    getInfo: (filePath: string) => ipcRenderer.invoke('file:getInfo', filePath),
    search: (dirPath: string, pattern: string, options?: unknown) =>
      ipcRenderer.invoke('file:search', dirPath, pattern, options),
  },

  // 系统信息 API
  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
    getDiskInfo: () => ipcRenderer.invoke('system:getDiskInfo'),
    getProcessList: () => ipcRenderer.invoke('system:getProcessList'),
    killProcess: (pid: number) => ipcRenderer.invoke('system:killProcess', pid),
    launchApp: (appPath: string, args?: string[]) =>
      ipcRenderer.invoke('system:launchApp', appPath, args),
    executeCommand: (command: string) => ipcRenderer.invoke('system:executeCommand', command),
    getUserPaths: () => ipcRenderer.invoke('system:getUserPaths'),
  },

  // 窗口操作 API
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

  // 应用操作 API
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    quit: () => ipcRenderer.send('app:quit'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  },

  // 对话框 API
  dialog: {
    showOpenDialog: (options: unknown) => ipcRenderer.invoke('dialog:showOpenDialog', options),
    showSaveDialog: (options: unknown) => ipcRenderer.invoke('dialog:showSaveDialog', options),
    showMessageBox: (options: unknown) => ipcRenderer.invoke('dialog:showMessageBox', options),
  },

  // 剪贴板 API
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:readText'),
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
  },
}

// 通过 contextBridge 安全地暴露 API
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

log.info('预加载脚本执行完成，API 已暴露')

// 为 TypeScript 类型声明
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
