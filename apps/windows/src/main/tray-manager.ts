/**
 * TrayManager - 系统托盘管理
 *
 * 管理 Windows 系统托盘图标和菜单
 */

import { Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'

// 日志输出
const log = {
  info: (...args: unknown[]) => console.log('[TrayManager]', ...args),
  error: (...args: unknown[]) => console.error('[TrayManager]', ...args),
}

/**
 * 托盘管理器配置
 */
export interface TrayManagerConfig {
  /** 显示窗口回调 */
  onShowWindow: () => void
  /** 退出应用回调 */
  onQuit: () => void
  /** 切换连接状态回调 */
  onToggleConnection: () => void
}

/**
 * 托盘管理器类
 */
export class TrayManager {
  private tray: Tray | null = null
  private config: TrayManagerConfig
  private isConnected = false

  constructor(config: TrayManagerConfig) {
    this.config = config
    this.createTray()
  }

  /**
   * 创建系统托盘
   */
  private createTray(): void {
    log.info('创建系统托盘')

    // 创建托盘图标
    const iconPath = this.getIconPath()
    const icon = nativeImage.createFromPath(iconPath)

    this.tray = new Tray(icon.resize({ width: 16, height: 16 }))
    this.tray.setToolTip('OpenClaw Assistant')

    // 设置右键菜单
    this.updateContextMenu()

    // 点击托盘图标显示窗口
    this.tray.on('click', () => {
      this.config.onShowWindow()
    })

    // 双击也显示窗口
    this.tray.on('double-click', () => {
      this.config.onShowWindow()
    })
  }

  /**
   * 获取图标路径
   */
  private getIconPath(): string {
    // 开发环境和生产环境的图标路径不同
    if (process.env.NODE_ENV === 'development') {
      return join(__dirname, '../../assets/icon.png')
    }
    return join(process.resourcesPath, 'assets/icon.png')
  }

  /**
   * 更新右键菜单
   */
  private updateContextMenu(): void {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示窗口',
        click: () => this.config.onShowWindow(),
      },
      { type: 'separator' },
      {
        label: this.isConnected ? '断开连接' : '连接 Gateway',
        click: () => this.config.onToggleConnection(),
      },
      {
        label: this.isConnected ? '🟢 已连接' : '🔴 未连接',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '设置',
        click: () => {
          // TODO: 打开设置窗口
          log.info('打开设置窗口')
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => this.config.onQuit(),
      },
    ])

    this.tray?.setContextMenu(contextMenu)
  }

  /**
   * 更新连接状态
   */
  updateConnectionStatus(connected: boolean): void {
    log.info(`连接状态更新: ${connected ? '已连接' : '未连接'}`)
    this.isConnected = connected

    // 更新图标提示
    this.tray?.setToolTip(
      `OpenClaw Assistant - ${connected ? '已连接' : '未连接'}`
    )

    // 更新菜单
    this.updateContextMenu()
  }

  /**
   * 显示通知
   */
  showNotification(title: string, body: string): void {
    // 使用 Electron 的 Notification API
    if (this.tray) {
      this.tray.displayBalloon({
        title,
        content: body,
        iconType: 'info',
      })
    }
  }

  /**
   * 销毁托盘
   */
  destroy(): void {
    log.info('销毁系统托盘')
    this.tray?.destroy()
    this.tray = null
  }
}
