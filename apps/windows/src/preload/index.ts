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
 * 命令执行请求的数据结构
 */
export interface CommandExecuteRequest {
  /** 唯一请求 ID */
  requestId: string
  /** 要执行的命令 */
  command: string
  /** 超时时间 (毫秒) */
  timeoutMs: number
  /** 是否需要用户确认 */
  requireConfirm: boolean
}

/**
 * Chat 事件负载
 */
export interface ChatEventPayload {
  /** 运行 ID */
  runId: string
  /** 会话 Key */
  sessionKey: string
  /** 状态: delta (流式增量), final (最终结果), error (错误) */
  state: 'delta' | 'final' | 'error'
  /** 增量内容 (state=delta 时) */
  delta?: string
  /** 完整消息 (state=final 时) */
  message?: Record<string, unknown>
  /** 错误信息 (state=error 时) */
  errorMessage?: string
}

/**
 * 设备信息
 */
export interface DeviceInfo {
  /** 设备唯一标识 */
  deviceId: string
  /** 设备名称 */
  displayName: string
  /** 平台 */
  platform: string
  /** 客户端 ID */
  clientId: string
  /** 客户端模式 */
  clientMode: string
  /** 创建时间 */
  createdAt: number
}

/**
 * 配对状态
 */
export interface PairingState {
  /** 设备信息 */
  device: DeviceInfo
  /** 配对状态 */
  status: 'unpaired' | 'pending' | 'paired'
  /** Gateway URL */
  gatewayUrl?: string
  /** 认证 Token */
  token?: string
  /** 请求 ID (配对中) */
  requestId?: string
  /** 配对时间 */
  pairedAt?: number
}

/**
 * 配对结果
 */
export interface PairingResult {
  success: boolean
  message: string
  token?: string
}

/**
 * 更新状态类型
 */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

/**
 * 更新状态
 */
export interface UpdateState {
  /** 当前状态 */
  status: UpdateStatus
  /** 当前版本 */
  currentVersion: string
  /** 可用的新版本 */
  availableVersion?: string
  /** 更新说明 */
  releaseNotes?: string
  /** 发布日期 */
  releaseDate?: string
  /** 下载进度 (0-100) */
  downloadProgress?: number
  /** 下载速度 (bytes/s) */
  downloadSpeed?: number
  /** 已下载大小 */
  downloadedBytes?: number
  /** 总大小 */
  totalBytes?: number
  /** 错误信息 */
  error?: string
  /** 最后检查时间 */
  lastCheckTime?: number
}

/**
 * 更新配置
 */
export interface UpdaterConfig {
  /** 是否自动检查更新 */
  autoCheck: boolean
  /** 自动检查间隔 (毫秒) */
  checkInterval: number
  /** 是否自动下载 */
  autoDownload: boolean
  /** 是否自动安装 */
  autoInstall: boolean
  /** 是否允许预发布版本 */
  allowPrerelease: boolean
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
    onCommandExecute: (callback: (request: CommandExecuteRequest) => void) => () => void
    onChatEvent: (callback: (payload: ChatEventPayload) => void) => () => void
  }

  // 文件操作
  file: {
    list: (dirPath: string) => Promise<unknown[]>
    read: (filePath: string) => Promise<string>
    readAsBase64: (filePath: string) => Promise<{
      content: string
      mimeType: string
      size: number
      fileName: string
    }>
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
    showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
    showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>
    showMessageBox: (options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>
  }

  // 剪贴板
  clipboard: {
    readText: () => Promise<string>
    writeText: (text: string) => Promise<void>
  }

  // 设备配对
  pairing: {
    /** 获取设备信息 */
    getDevice: () => Promise<DeviceInfo | null>
    /** 获取配对状态 */
    getStatus: () => Promise<PairingState | null>
    /** 检查是否已配对 */
    isPaired: () => Promise<boolean>
    /** 发起配对请求 */
    requestPairing: (gatewayUrl: string) => Promise<{ requestId: string; status: 'pending' }>
    /** 检查配对请求状态 */
    checkStatus: () => Promise<'unpaired' | 'pending' | 'paired'>
    /** 使用配对码配对 */
    pairWithCode: (pairingCode: string, gatewayUrl: string) => Promise<PairingResult>
    /** 取消配对 */
    unpair: () => Promise<void>
    /** 刷新 Token */
    refreshToken: () => Promise<string | null>
    /** 验证 Token */
    verifyToken: () => Promise<boolean>
    /** 重置设备 */
    resetDevice: () => Promise<DeviceInfo>
    /** 更新设备名称 */
    updateDisplayName: (displayName: string) => Promise<void>
  }

  // 自动更新
  updater: {
    /** 获取更新状态 */
    getState: () => Promise<UpdateState>
    /** 获取更新配置 */
    getConfig: () => Promise<UpdaterConfig>
    /** 更新配置 */
    updateConfig: (config: Partial<UpdaterConfig>) => Promise<UpdaterConfig>
    /** 检查更新 */
    checkForUpdates: () => Promise<UpdateState>
    /** 下载更新 */
    downloadUpdate: () => Promise<UpdateState>
    /** 安装更新 */
    installUpdate: () => void
    /** 启动自动检查 */
    startAutoCheck: () => void
    /** 停止自动检查 */
    stopAutoCheck: () => void
    /** 监听状态变化 */
    onStateChange: (callback: (state: UpdateState) => void) => () => void
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
    onCommandExecute: (callback: (request: CommandExecuteRequest) => void) =>
      createEventListener('command:execute', callback as (...args: unknown[]) => void),
    onChatEvent: (callback: (payload: ChatEventPayload) => void) =>
      createEventListener('gateway:chat', callback as (...args: unknown[]) => void),
  },

  // 文件操作 API
  file: {
    list: (dirPath: string) => ipcRenderer.invoke('file:list', dirPath),
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    readAsBase64: (filePath: string) => ipcRenderer.invoke('file:readAsBase64', filePath),
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
    showOpenDialog: (options: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke('dialog:showOpenDialog', options) as Promise<Electron.OpenDialogReturnValue>,
    showSaveDialog: (options: Electron.SaveDialogOptions) =>
      ipcRenderer.invoke('dialog:showSaveDialog', options) as Promise<Electron.SaveDialogReturnValue>,
    showMessageBox: (options: Electron.MessageBoxOptions) =>
      ipcRenderer.invoke('dialog:showMessageBox', options) as Promise<Electron.MessageBoxReturnValue>,
  },

  // 剪贴板 API
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:readText'),
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
  },

  // 设备配对 API
  pairing: {
    getDevice: () => ipcRenderer.invoke('pairing:getDevice'),
    getStatus: () => ipcRenderer.invoke('pairing:getStatus'),
    isPaired: () => ipcRenderer.invoke('pairing:isPaired'),
    requestPairing: (gatewayUrl: string) => ipcRenderer.invoke('pairing:requestPairing', gatewayUrl),
    checkStatus: () => ipcRenderer.invoke('pairing:checkStatus'),
    pairWithCode: (pairingCode: string, gatewayUrl: string) =>
      ipcRenderer.invoke('pairing:pairWithCode', pairingCode, gatewayUrl),
    unpair: () => ipcRenderer.invoke('pairing:unpair'),
    refreshToken: () => ipcRenderer.invoke('pairing:refreshToken'),
    verifyToken: () => ipcRenderer.invoke('pairing:verifyToken'),
    resetDevice: () => ipcRenderer.invoke('pairing:resetDevice'),
    updateDisplayName: (displayName: string) =>
      ipcRenderer.invoke('pairing:updateDisplayName', displayName),
  },

  // 自动更新 API
  updater: {
    getState: () => ipcRenderer.invoke('updater:getState'),
    getConfig: () => ipcRenderer.invoke('updater:getConfig'),
    updateConfig: (config: Partial<UpdaterConfig>) =>
      ipcRenderer.invoke('updater:updateConfig', config),
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
    installUpdate: () => ipcRenderer.invoke('updater:installUpdate'),
    startAutoCheck: () => ipcRenderer.invoke('updater:startAutoCheck'),
    stopAutoCheck: () => ipcRenderer.invoke('updater:stopAutoCheck'),
    onStateChange: (callback: (state: UpdateState) => void) =>
      createEventListener('updater:state-change', callback as (...args: unknown[]) => void),
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
