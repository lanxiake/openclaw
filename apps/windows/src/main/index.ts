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
import { join, extname } from 'path'
import { promises as fs } from 'fs'
import { GatewayClient, type CommandExecuteRequest } from './gateway-client'
import { TrayManager } from './tray-manager'
import { SystemService } from './system-service'
import { DevicePairingService } from './device-pairing-service'
import { UpdaterService, setupUpdaterIpcHandlers } from './updater-service'
import { ClientSkillRuntime } from './skill-runtime'
import { ApiClient } from './api-client'
import {
  validateUrl,
  validatePid,
  securityUtils,
  SecurityError,
} from './security-utils'
import { fileLogger } from './file-logger'

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
let apiClient: ApiClient | null = null
let systemService: SystemService | null = null
let devicePairingService: DevicePairingService | null = null
let updaterService: UpdaterService | null = null
let skillRuntime: ClientSkillRuntime | null = null
let isQuitting = false

/**
 * 创建主窗口
 */
function createWindow(): void {
  log.info('创建主窗口')

  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 700,
    minHeight: 600,
    frame: false, // 无边框窗口
    transparent: false,
    resizable: true,
    show: false, // 初始不显示，等待 ready-to-show
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // 需要关闭 sandbox 以支持 node 模块
    },
  })

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    log.info('窗口准备就绪')
    // 默认不显示主窗口，通过托盘图标唤起
  })

  // 关闭窗口时隐藏而不是退出
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
      log.info('窗口已隐藏到托盘')
    }
  })

  // 加载渲染进程页面
  if (process.env.ELECTRON_RENDERER_URL) {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL

    // dev 模式：renderer dev server 可能还没完全 ready，加载失败时自动重试
    let retryCount = 0
    const maxRetries = 10
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, _errorDesc) => {
      if (retryCount < maxRetries && errorCode === -102) { // ERR_CONNECTION_REFUSED
        retryCount++
        log.info(`等待 renderer dev server 就绪... (${retryCount}/${maxRetries})`)
        setTimeout(() => {
          mainWindow?.loadURL(rendererUrl)
        }, 1000)
      }
    })
    mainWindow.loadURL(rendererUrl)
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
      isQuitting = true
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
 * 初始化 Gateway 客户端（懒加载模式）
 *
 * 创建 Gateway 客户端实例并设置事件监听器，但不自动连接。
 * 等待用户通过 API Server 登录后，再由渲染进程触发连接。
 */
function initGatewayClientLazy(): void {
  log.info('初始化 Gateway 客户端（懒加载模式）')

  // 使用 127.0.0.1 而不是 localhost，避免 IPv6 解析问题
  const config = {
    url: 'ws://127.0.0.1:18789',
    token: '', // 将通过登录流程获取
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
    // 转发 chat 事件到渲染进程
    if (message.type === 'event' && message.event === 'chat') {
      log.info('[Gateway] 收到 chat 事件:', message.payload)
      mainWindow?.webContents.send('gateway:chat', message.payload)
      return
    }

    // 其他消息转发
    mainWindow?.webContents.send('gateway:message', message)
  })

  // 监听操作确认请求
  gatewayClient.on('confirm:request', (request) => {
    log.info('收到操作确认请求:', request)
    mainWindow?.show()
    mainWindow?.webContents.send('confirm:request', request)
  })

  // 监听命令执行请求
  gatewayClient.on('command:execute', async (request: CommandExecuteRequest) => {
    log.info('收到命令执行请求:', request)
    await handleCommandExecute(request)
  })

  log.info('Gateway 客户端已初始化，等待用户登录后连接')
}

/**
 * 处理远程命令执行请求
 *
 * 安全措施：
 * 1. 复用现有的确认机制请求用户授权
 * 2. 使用命令白名单验证
 * 3. 60秒执行超时
 * 4. 输出大小限制 10MB
 */
async function handleCommandExecute(request: CommandExecuteRequest): Promise<void> {
  const { requestId, command, requireConfirm } = request

  log.info(`[CommandExecute] 处理命令执行请求: ${requestId}`, { command, requireConfirm })

  // 安全验证: 检查命令是否在白名单中
  if (!securityUtils.isCommandAllowed(command)) {
    log.warn(`[CommandExecute] 命令不在白名单中: ${command}`)
    await sendCommandResult(requestId, {
      success: false,
      errorMessage: '命令不在允许列表中，请联系管理员添加到白名单',
    })
    return
  }

  try {
    // 如果需要用户确认，显示确认对话框
    if (requireConfirm) {
      mainWindow?.show()
      mainWindow?.focus()

      const confirmResult = await dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        title: '命令执行确认',
        message: '远程请求执行以下命令：',
        detail: `${command}\n\n您确定要执行此命令吗？`,
        buttons: ['取消', '执行'],
        defaultId: 0,
        cancelId: 0,
      })

      if (confirmResult.response === 0) {
        log.info(`[CommandExecute] 用户拒绝执行命令: ${requestId}`)
        await sendCommandResult(requestId, {
          success: false,
          errorMessage: '用户拒绝执行该命令',
        })
        return
      }
    }

    // 执行命令
    log.info(`[CommandExecute] 开始执行命令: ${command}`)
    const result = await systemService?.executeCommand(command)

    if (result) {
      log.info(`[CommandExecute] 命令执行成功: ${requestId}`)
      await sendCommandResult(requestId, {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
      })
    } else {
      log.warn(`[CommandExecute] 系统服务未初始化`)
      await sendCommandResult(requestId, {
        success: false,
        errorMessage: '系统服务未初始化',
      })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`[CommandExecute] 命令执行失败: ${requestId}`, error)

    // 检查是否是安全错误
    if (error instanceof SecurityError) {
      await sendCommandResult(requestId, {
        success: false,
        errorMessage: `安全错误: ${errorMessage}`,
      })
    } else {
      await sendCommandResult(requestId, {
        success: false,
        errorMessage,
        exitCode: 1,
      })
    }
  }
}

/**
 * 发送命令执行结果到 Gateway
 */
async function sendCommandResult(
  requestId: string,
  result: {
    success: boolean
    stdout?: string
    stderr?: string
    exitCode?: number
    errorMessage?: string
  }
): Promise<void> {
  if (!gatewayClient?.isConnected()) {
    log.warn('[CommandExecute] Gateway 未连接，无法发送结果')
    return
  }

  try {
    await gatewayClient.call('assistant.command.result', {
      requestId,
      ...result,
    })
    log.info(`[CommandExecute] 结果已发送: ${requestId}`)
  } catch (error) {
    log.error(`[CommandExecute] 发送结果失败: ${requestId}`, error)
  }
}

/**
 * 初始化系统服务
 */
function initSystemService(): void {
  log.info('初始化系统服务')
  systemService = new SystemService()
}

/**
 * 初始化设备配对服务
 */
async function initDevicePairingService(): Promise<void> {
  log.info('初始化设备配对服务')
  devicePairingService = new DevicePairingService()
  await devicePairingService.initialize()

  // 如果已配对，自动使用保存的 Token
  if (devicePairingService.isPaired()) {
    const token = devicePairingService.getToken()
    if (token && gatewayClient) {
      gatewayClient.setToken(token)
      log.info('已加载配对 Token')
    }
  }
}

/**
 * 初始化技能运行时
 */
async function initSkillRuntime(): Promise<void> {
  log.info('初始化技能运行时')

  // 创建技能运行时实例
  skillRuntime = new ClientSkillRuntime()

  // 设置 SystemService 引用
  if (systemService) {
    skillRuntime.setSystemService(systemService)
  }

  // 设置确认对话框处理器
  skillRuntime.setConfirmHandler(async (skillName: string, params: Record<string, unknown>) => {
    if (!mainWindow) {
      return false
    }

    mainWindow.show()
    mainWindow.focus()

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: '技能执行确认',
      message: `技能 "${skillName}" 请求执行以下操作：`,
      detail: JSON.stringify(params, null, 2),
      buttons: ['取消', '允许'],
      defaultId: 0,
      cancelId: 0,
    })

    return result.response === 1
  })

  // 初始化技能运行时
  const skillsDir = join(app.getPath('userData'), 'skills')
  await skillRuntime.initialize(skillsDir)

  // 将 SkillRuntime 设置到 GatewayClient
  if (gatewayClient) {
    gatewayClient.setSkillRuntime(skillRuntime)
  }

  log.info('技能运行时初始化完成')
}

/**
 * 初始化自动更新服务
 */
function initUpdaterService(): void {
  log.info('初始化自动更新服务')

  updaterService = new UpdaterService({
    autoCheck: true,
    checkInterval: 4 * 60 * 60 * 1000, // 4小时检查一次
    autoDownload: false,
    autoInstall: false,
    allowPrerelease: false,
  })

  // 设置主窗口引用
  if (mainWindow) {
    updaterService.setMainWindow(mainWindow)
  }

  // 设置 IPC 处理器
  setupUpdaterIpcHandlers(updaterService)

  // 生产环境下启动自动检查
  if (process.env.NODE_ENV !== 'development') {
    updaterService.startAutoCheck()
  }
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
    // 验证 URL
    const safeUrl = validateUrl(url, { allowedProtocols: ['ws:', 'wss:', 'http:', 'https:'] })

    if (gatewayClient) {
      gatewayClient.setUrl(safeUrl)
      if (options?.token) {
        // Token 验证 - 基本格式检查
        if (typeof options.token !== 'string' || options.token.length > 1000) {
          throw new Error('无效的认证 Token')
        }
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
    // 验证 method 参数
    if (typeof method !== 'string' || method.length > 200) {
      throw new Error('无效的方法名')
    }
    return gatewayClient?.call(method, params)
  })

  // 操作确认响应
  ipcMain.handle('confirm:response', async (_event, requestId: string, approved: boolean) => {
    // 验证参数
    if (typeof requestId !== 'string' || requestId.length > 100) {
      throw new Error('无效的请求 ID')
    }
    if (typeof approved !== 'boolean') {
      throw new Error('approved 必须是布尔值')
    }
    return gatewayClient?.call('assistant.confirmResponse', { requestId, approved })
  })

  // === 文件操作 ===
  // 注意：文件操作的路径验证已在 SystemService 中实现
  ipcMain.handle('file:list', async (_event, dirPath: string) => {
    if (typeof dirPath !== 'string') {
      throw new Error('路径必须是字符串')
    }
    return systemService?.listDirectory(dirPath)
  })

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    if (typeof filePath !== 'string') {
      throw new Error('路径必须是字符串')
    }
    return systemService?.readFile(filePath)
  })

  // 读取文件为 Base64 (用于图片附件)
  ipcMain.handle('file:readAsBase64', async (_event, filePath: string) => {
    if (typeof filePath !== 'string') {
      throw new Error('路径必须是字符串')
    }

    log.info(`[File] 读取文件为 Base64: ${filePath}`)

    // 获取文件扩展名和 MIME 类型
    const ext = extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
    }
    const mimeType = mimeTypes[ext] || 'application/octet-stream'

    // 验证文件大小 (限制 10MB)
    const stats = await fs.stat(filePath)
    if (stats.size > 10 * 1024 * 1024) {
      throw new Error('文件大小超出限制 (最大 10MB)')
    }

    // 读取文件内容
    const buffer = await fs.readFile(filePath)
    const content = buffer.toString('base64')

    log.info(`[File] 文件读取成功: ${filePath}, 大小: ${stats.size} 字节`)

    return {
      content,
      mimeType,
      size: stats.size,
      fileName: filePath.split(/[/\\]/).pop() || 'file',
    }
  })

  ipcMain.handle('file:write', async (_event, filePath: string, content: string) => {
    if (typeof filePath !== 'string') {
      throw new Error('路径必须是字符串')
    }
    if (typeof content !== 'string') {
      throw new Error('内容必须是字符串')
    }
    // 限制写入内容大小
    if (content.length > 10 * 1024 * 1024) {
      throw new Error('写入内容超出大小限制 (10MB)')
    }
    return systemService?.writeFile(filePath, content)
  })

  ipcMain.handle('file:move', async (_event, sourcePath: string, destPath: string) => {
    if (typeof sourcePath !== 'string' || typeof destPath !== 'string') {
      throw new Error('路径必须是字符串')
    }
    return systemService?.moveFile(sourcePath, destPath)
  })

  ipcMain.handle('file:copy', async (_event, sourcePath: string, destPath: string) => {
    if (typeof sourcePath !== 'string' || typeof destPath !== 'string') {
      throw new Error('路径必须是字符串')
    }
    return systemService?.copyFile(sourcePath, destPath)
  })

  ipcMain.handle('file:delete', async (_event, filePath: string) => {
    if (typeof filePath !== 'string') {
      throw new Error('路径必须是字符串')
    }
    return systemService?.deleteFile(filePath)
  })

  ipcMain.handle('file:createDir', async (_event, dirPath: string) => {
    if (typeof dirPath !== 'string') {
      throw new Error('路径必须是字符串')
    }
    return systemService?.createDirectory(dirPath)
  })

  ipcMain.handle('file:exists', async (_event, filePath: string) => {
    if (typeof filePath !== 'string') {
      throw new Error('路径必须是字符串')
    }
    return systemService?.exists(filePath)
  })

  ipcMain.handle('file:getInfo', async (_event, filePath: string) => {
    if (typeof filePath !== 'string') {
      throw new Error('路径必须是字符串')
    }
    return systemService?.getFileInfo(filePath)
  })

  ipcMain.handle('file:search', async (_event, dirPath: string, pattern: string, options?: unknown) => {
    if (typeof dirPath !== 'string') {
      throw new Error('路径必须是字符串')
    }
    if (typeof pattern !== 'string' || pattern.length > 100) {
      throw new Error('搜索模式无效')
    }
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
    // PID 验证在 SystemService 中实现
    const safePid = validatePid(pid)
    return systemService?.killProcess(safePid)
  })

  ipcMain.handle('system:launchApp', async (_event, appPath: string, args?: string[]) => {
    if (typeof appPath !== 'string') {
      throw new Error('应用路径必须是字符串')
    }
    if (args !== undefined && !Array.isArray(args)) {
      throw new Error('参数必须是数组')
    }
    // 验证参数数组
    if (args && args.some((arg) => typeof arg !== 'string')) {
      throw new Error('所有参数必须是字符串')
    }
    systemService?.launchApplication(appPath, args)
  })

  ipcMain.handle('system:executeCommand', async (_event, command: string) => {
    if (typeof command !== 'string') {
      throw new Error('命令必须是字符串')
    }
    if (command.length > 1000) {
      throw new Error('命令过长')
    }
    return systemService?.executeCommand(command)
  })

  ipcMain.handle('system:getUserPaths', () => {
    return systemService?.getUserPaths()
  })

  // === 应用操作 ===
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.on('app:quit', () => {
    isQuitting = true
    app.quit()
  })
  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    // 验证 URL 安全性
    const safeUrl = validateUrl(url, { allowedProtocols: ['http:', 'https:'] })
    return shell.openExternal(safeUrl)
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
    if (typeof text !== 'string') {
      throw new Error('文本必须是字符串')
    }
    // 限制剪贴板写入大小
    if (text.length > 10 * 1024 * 1024) {
      throw new Error('文本超出大小限制 (10MB)')
    }
    clipboard.writeText(text)
  })

  // === 设备配对 ===
  ipcMain.handle('pairing:getDevice', () => {
    return devicePairingService?.getDevice()
  })

  ipcMain.handle('pairing:getStatus', () => {
    return devicePairingService?.getPairingStatus()
  })

  ipcMain.handle('pairing:isPaired', () => {
    return devicePairingService?.isPaired() ?? false
  })

  ipcMain.handle('pairing:requestPairing', async (_event, gatewayUrl: string) => {
    if (!devicePairingService || !gatewayClient) {
      throw new Error('服务未初始化')
    }

    // 验证 Gateway URL
    const safeUrl = validateUrl(gatewayUrl, { allowedProtocols: ['ws:', 'wss:', 'http:', 'https:'] })

    // 先连接到 Gateway
    gatewayClient.setUrl(safeUrl)
    await gatewayClient.connect()

    // 发起配对请求
    return devicePairingService.requestPairing(safeUrl, (method, params) =>
      gatewayClient!.call(method, params)
    )
  })

  ipcMain.handle('pairing:checkStatus', async () => {
    if (!devicePairingService || !gatewayClient) {
      throw new Error('服务未初始化')
    }

    return devicePairingService.checkPairingStatus((method, params) =>
      gatewayClient!.call(method, params)
    )
  })

  ipcMain.handle('pairing:pairWithCode', async (_event, pairingCode: string, gatewayUrl: string) => {
    if (!devicePairingService || !gatewayClient) {
      throw new Error('服务未初始化')
    }

    // 验证配对码格式
    if (typeof pairingCode !== 'string' || !/^[A-Za-z0-9]{4,20}$/.test(pairingCode)) {
      throw new Error('无效的配对码格式')
    }

    // 验证 Gateway URL
    const safeUrl = validateUrl(gatewayUrl, { allowedProtocols: ['ws:', 'wss:', 'http:', 'https:'] })

    // 先连接到 Gateway
    gatewayClient.setUrl(safeUrl)
    await gatewayClient.connect()

    // 使用配对码配对
    const result = await devicePairingService.pairWithCode(pairingCode, safeUrl, (method, params) =>
      gatewayClient!.call(method, params)
    )

    // 配对成功后更新 Gateway 客户端的 Token
    if (result.success && result.token) {
      gatewayClient.setToken(result.token)
    }

    return result
  })

  ipcMain.handle('pairing:unpair', async () => {
    await devicePairingService?.unpair()
    if (gatewayClient) {
      gatewayClient.setToken('')
    }
  })

  ipcMain.handle('pairing:refreshToken', async () => {
    if (!devicePairingService || !gatewayClient) {
      throw new Error('服务未初始化')
    }

    const newToken = await devicePairingService.refreshToken((method, params) =>
      gatewayClient!.call(method, params)
    )

    if (newToken) {
      gatewayClient.setToken(newToken)
    }

    return newToken
  })

  ipcMain.handle('pairing:verifyToken', async () => {
    if (!devicePairingService || !gatewayClient) {
      throw new Error('服务未初始化')
    }

    return devicePairingService.verifyToken((method, params) =>
      gatewayClient!.call(method, params)
    )
  })

  ipcMain.handle('pairing:resetDevice', async () => {
    return devicePairingService?.resetDevice()
  })

  ipcMain.handle('pairing:updateDisplayName', async (_event, displayName: string) => {
    // 验证显示名称
    if (typeof displayName !== 'string') {
      throw new Error('显示名称必须是字符串')
    }
    if (displayName.length < 1 || displayName.length > 50) {
      throw new Error('显示名称长度必须在 1-50 字符之间')
    }
    // 移除潜在的危险字符
    const safeName = displayName.replace(/[<>]/g, '')
    return devicePairingService?.updateDisplayName(safeName)
  })
}

/**
 * 初始化 API Server 客户端
 */
function initApiClient(): void {
  log.info('初始化 API Server 客户端')

  // 从设置中读取 API Server URL，默认使用 127.0.0.1:3000（强制 IPv4）
  apiClient = new ApiClient({
    baseUrl: 'http://127.0.0.1:3000',
    timeout: 30000,
  })

  log.info('API Server 客户端初始化完成')
}

/**
 * 设置 API Server IPC 处理器
 *
 * 提供认证、设备配对、用户自服务等 HTTP API 调用
 */
function setupApiIpcHandlers(): void {
  log.info('设置 API Server IPC 处理器')

  // === 认证接口 ===
  ipcMain.handle('api:login', async (_event, params: { identifier: string; password: string }) => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    // 参数验证
    if (typeof params.identifier !== 'string' || params.identifier.length > 200) {
      throw new Error('无效的用户标识')
    }
    if (typeof params.password !== 'string' || params.password.length > 200) {
      throw new Error('无效的密码')
    }
    return apiClient.login(params)
  })

  ipcMain.handle('api:register', async (_event, params: {
    username?: string
    phone?: string
    email?: string
    password: string
    displayName?: string
  }) => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    // 参数验证
    if (typeof params.password !== 'string' || params.password.length < 6 || params.password.length > 200) {
      throw new Error('密码长度必须在 6-200 字符之间')
    }
    return apiClient.register(params)
  })

  ipcMain.handle('api:refreshToken', async (_event, refreshToken: string) => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    if (typeof refreshToken !== 'string' || refreshToken.length > 2000) {
      throw new Error('无效的刷新令牌')
    }
    return apiClient.refreshToken(refreshToken)
  })

  ipcMain.handle('api:logout', async (_event, refreshToken: string) => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    if (typeof refreshToken !== 'string') {
      throw new Error('无效的刷新令牌')
    }
    return apiClient.logout(refreshToken)
  })

  ipcMain.handle('api:sendCode', async (_event, params: {
    phone?: string
    email?: string
    type?: string
  }) => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    return apiClient.sendVerificationCode(params)
  })

  // === 设备配对接口 ===
  ipcMain.handle('api:requestPairing', async (_event, params: {
    deviceId: string
    publicKey: string
    displayName?: string
    platform?: string
  }) => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    // 参数验证
    if (typeof params.deviceId !== 'string' || params.deviceId.length > 200) {
      throw new Error('无效的设备 ID')
    }
    if (typeof params.publicKey !== 'string' || params.publicKey.length > 5000) {
      throw new Error('无效的公钥')
    }
    return apiClient.requestDevicePairing(params)
  })

  ipcMain.handle('api:checkPairingStatus', async (_event, requestId: string) => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    if (typeof requestId !== 'string' || requestId.length > 200) {
      throw new Error('无效的请求 ID')
    }
    return apiClient.checkPairingStatus(requestId)
  })

  // === 用户自服务接口 ===
  ipcMain.handle('api:getCurrentUser', async () => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    return apiClient.getCurrentUser()
  })

  ipcMain.handle('api:getUserDevices', async () => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    return apiClient.getUserDevices()
  })

  ipcMain.handle('api:updateUser', async (_event, params: {
    displayName?: string
    avatar?: string
  }) => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    return apiClient.updateUser(params)
  })

  // === 配置接口 ===
  ipcMain.handle('api:setBaseUrl', async (_event, url: string) => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    // 验证 URL 格式
    if (typeof url !== 'string' || !url.startsWith('http')) {
      throw new Error('无效的 API Server URL')
    }
    apiClient.setBaseUrl(url)
  })

  ipcMain.handle('api:getBaseUrl', async () => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    return apiClient.getBaseUrl()
  })

  ipcMain.handle('api:setAccessToken', async (_event, token: string | null) => {
    if (!apiClient) {
      throw new Error('API 客户端未初始化')
    }
    if (token !== null && (typeof token !== 'string' || token.length > 2000)) {
      throw new Error('无效的访问令牌')
    }
    apiClient.setAccessToken(token)
  })

  log.info('API Server IPC 处理器设置完成')
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

  // 初始化文件日志系统（必须在 app.whenReady() 之后）
  fileLogger.initialize()

  log.info('应用已就绪')

  // 初始化各模块
  createWindow()
  initTray()
  initSystemService()
  setupIpcHandlers()

  // 初始化 API 客户端（不需要网络连接，立即可用）
  initApiClient()
  setupApiIpcHandlers()

  // Gateway 客户端懒加载：只创建实例和事件监听，不自动连接
  // 等待用户通过 API Server 登录后，由渲染进程触发连接
  initGatewayClientLazy()

  await initDevicePairingService()
  await initSkillRuntime()  // 初始化技能运行时
  initUpdaterService()

  log.info('OpenClaw Assistant 启动完成')
}

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
  updaterService?.destroy()
  trayManager?.destroy()
  fileLogger.destroy()
})

// 启动应用
initialize().catch((error) => {
  log.error('启动失败:', error)
  app.quit()
})
