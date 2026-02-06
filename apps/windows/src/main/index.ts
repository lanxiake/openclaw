/**
 * OpenClaw Assistant - Windows 客户端主进程入口
 *
 * 职责：
 * - 创建和管理应用窗口
 * - 管理系统托盘
 * - 与 Gateway 建立 WebSocket 连接
 * - 处理 IPC 通信
 */

import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, shell, clipboard } from 'electron'
import { join } from 'path'
import { GatewayClient } from './gateway-client'
import { TrayManager } from './tray-manager'
import { SystemService } from './system-service'

// 日志输出
const log = {
  info: (...args: unknown[]) => console.log('[Main]', ...args),
  error: (...args: unknown[]) => console.error('[Main]', ...args),
  warn: (...args: unknown[]) => console.warn('[Main]', ...args),
}

// 全局变量
let mainWindow: BrowserWindow | null = null
let trayManager: TrayManager | null = null
let gatewayClient: GatewayClient | null = null
let systemService: SystemService | null = null

/**
 * 创建主窗口
 */
function createWindow(): void {
  log.info('创建主窗口')

  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 350,
    minHeight: 400,
    frame: false, // 无边框窗口
    transparent: false,
    resizable: true,
    show: false, // 初始不显示，等待 ready-to-show
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    log.info('窗口准备就绪')
    // 默认不显示主窗口，通过托盘图标唤起
  })

  // 关闭窗口时隐藏而不是退出
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
      log.info('窗口已隐藏到托盘')
    }
  })

  // 加载渲染进程页面
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * 初始化系统托盘
 */
function initTray(): void {
  log.info('初始化系统托盘')

  trayManager = new TrayManager({
    onShowWindow: () => {
      mainWindow?.show()
      mainWindow?.focus()
    },
    onQuit: () => {
      app.isQuitting = true
      app.quit()
    },
    onToggleConnection: async () => {
      if (gatewayClient?.isConnected()) {
        await gatewayClient.disconnect()
      } else {
        await gatewayClient?.connect()
      }
    },
  })
}

/**
 * 初始化 Gateway 客户端
 */
async function initGatewayClient(): Promise<void> {
  log.info('初始化 Gateway 客户端')

  // TODO: 从配置文件读取 Gateway 地址和认证信息
  const config = {
    url: 'ws://localhost:18789',
    token: '', // 将通过设备配对获取
  }

  gatewayClient = new GatewayClient(config)

  // 监听连接状态变化
  gatewayClient.on('connected', () => {
    log.info('已连接到 Gateway')
    trayManager?.updateConnectionStatus(true)
    mainWindow?.webContents.send('gateway:status-change', true)
  })

  gatewayClient.on('disconnected', () => {
    log.info('与 Gateway 断开连接')
    trayManager?.updateConnectionStatus(false)
    mainWindow?.webContents.send('gateway:status-change', false)
  })

  gatewayClient.on('error', (error) => {
    log.error('Gateway 连接错误:', error)
  })

  // 监听来自 Gateway 的消息
  gatewayClient.on('message', (message) => {
    mainWindow?.webContents.send('gateway:message', message)
  })

  // 监听操作确认请求
  gatewayClient.on('confirm:request', (request) => {
    log.info('收到操作确认请求:', request)
    mainWindow?.show()
    mainWindow?.webContents.send('confirm:request', request)
  })
}

/**
 * 初始化系统服务
 */
function initSystemService(): void {
  log.info('初始化系统服务')
  systemService = new SystemService()
}

/**
 * 设置 IPC 处理器
 */
function setupIpcHandlers(): void {
  log.info('设置 IPC 处理器')

  // === 窗口控制 ===
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow?.hide())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

  // === Gateway 操作 ===
  ipcMain.handle('gateway:connect', async (_event, url: string, options?: { token?: string }) => {
    if (gatewayClient) {
      gatewayClient.setUrl(url)
      if (options?.token) {
        gatewayClient.setToken(options.token)
      }
      return gatewayClient.connect()
    }
  })

  ipcMain.handle('gateway:disconnect', async () => {
    return gatewayClient?.disconnect()
  })

  ipcMain.handle('gateway:isConnected', () => {
    return gatewayClient?.isConnected() ?? false
  })

  ipcMain.handle('gateway:call', async (_event, method: string, params?: unknown) => {
    return gatewayClient?.call(method, params)
  })

  // 操作确认响应
  ipcMain.handle('confirm:response', async (_event, requestId: string, approved: boolean) => {
    return gatewayClient?.call('assistant.confirmResponse', { requestId, approved })
  })

  // === 文件操作 ===
  ipcMain.handle('file:list', async (_event, dirPath: string) => {
    return systemService?.listDirectory(dirPath)
  })

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    return systemService?.readFile(filePath)
  })

  ipcMain.handle('file:write', async (_event, filePath: string, content: string) => {
    return systemService?.writeFile(filePath, content)
  })

  ipcMain.handle('file:move', async (_event, sourcePath: string, destPath: string) => {
    return systemService?.moveFile(sourcePath, destPath)
  })

  ipcMain.handle('file:copy', async (_event, sourcePath: string, destPath: string) => {
    return systemService?.copyFile(sourcePath, destPath)
  })

  ipcMain.handle('file:delete', async (_event, filePath: string) => {
    return systemService?.deleteFile(filePath)
  })

  ipcMain.handle('file:createDir', async (_event, dirPath: string) => {
    return systemService?.createDirectory(dirPath)
  })

  ipcMain.handle('file:exists', async (_event, filePath: string) => {
    return systemService?.exists(filePath)
  })

  ipcMain.handle('file:getInfo', async (_event, filePath: string) => {
    return systemService?.getFileInfo(filePath)
  })

  ipcMain.handle('file:search', async (_event, dirPath: string, pattern: string, options?: unknown) => {
    return systemService?.searchFiles(dirPath, pattern, options as { recursive?: boolean; maxResults?: number })
  })

  // === 系统信息 ===
  ipcMain.handle('system:getInfo', () => {
    return systemService?.getSystemInfo()
  })

  ipcMain.handle('system:getDiskInfo', async () => {
    return systemService?.getDiskInfo()
  })

  ipcMain.handle('system:getProcessList', async () => {
    return systemService?.getProcessList()
  })

  ipcMain.handle('system:killProcess', async (_event, pid: number) => {
    return systemService?.killProcess(pid)
  })

  ipcMain.handle('system:launchApp', async (_event, appPath: string, args?: string[]) => {
    systemService?.launchApplication(appPath, args)
  })

  ipcMain.handle('system:executeCommand', async (_event, command: string) => {
    return systemService?.executeCommand(command)
  })

  ipcMain.handle('system:getUserPaths', () => {
    return systemService?.getUserPaths()
  })

  // === 应用操作 ===
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.on('app:quit', () => {
    app.isQuitting = true
    app.quit()
  })
  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    return shell.openExternal(url)
  })

  // === 对话框 ===
  ipcMain.handle('dialog:showOpenDialog', async (_event, options: Electron.OpenDialogOptions) => {
    return dialog.showOpenDialog(mainWindow!, options)
  })

  ipcMain.handle('dialog:showSaveDialog', async (_event, options: Electron.SaveDialogOptions) => {
    return dialog.showSaveDialog(mainWindow!, options)
  })

  ipcMain.handle('dialog:showMessageBox', async (_event, options: Electron.MessageBoxOptions) => {
    return dialog.showMessageBox(mainWindow!, options)
  })

  // === 剪贴板 ===
  ipcMain.handle('clipboard:readText', () => {
    return clipboard.readText()
  })

  ipcMain.handle('clipboard:writeText', (_event, text: string) => {
    clipboard.writeText(text)
  })
}

/**
 * 应用初始化
 */
async function initialize(): Promise<void> {
  log.info('OpenClaw Assistant 启动中...')

  // 单实例锁定
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    log.warn('已有实例在运行，退出')
    app.quit()
    return
  }

  // 第二个实例尝试启动时，聚焦到现有窗口
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // 等待 app ready
  await app.whenReady()

  log.info('应用已就绪')

  // 初始化各模块
  createWindow()
  initTray()
  initSystemService()
  setupIpcHandlers()
  await initGatewayClient()

  log.info('OpenClaw Assistant 启动完成')
}

// 扩展 app 类型
declare module 'electron' {
  interface App {
    isQuitting: boolean
  }
}

// 初始化 isQuitting 标志
app.isQuitting = false

// macOS 特殊处理
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else {
    mainWindow?.show()
  }
})

// 所有窗口关闭时（非 macOS）
app.on('window-all-closed', () => {
  // Windows/Linux 下不退出，保持托盘运行
  // macOS 下也保持运行
})

// 应用退出前清理
app.on('before-quit', async () => {
  log.info('应用即将退出，清理资源...')
  await gatewayClient?.disconnect()
  trayManager?.destroy()
})

// 启动应用
initialize().catch((error) => {
  log.error('启动失败:', error)
  app.quit()
})
