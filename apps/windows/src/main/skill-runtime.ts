/**
 * ClientSkillRuntime - 客户端技能运行时
 *
 * 在 Windows 客户端本地执行技能
 * 支持权限检查、用户确认、超时控制等功能
 */

import { dialog, BrowserWindow } from 'electron'
import { EventEmitter } from 'events'
import type { SystemService } from './system-service'
import { SkillSandbox, createDefaultSandbox } from './skill-sandbox'

// 日志输出
const log = {
  info: (...args: unknown[]) => console.log('[SkillRuntime]', ...args),
  error: (...args: unknown[]) => console.error('[SkillRuntime]', ...args),
  warn: (...args: unknown[]) => console.warn('[SkillRuntime]', ...args),
  debug: (...args: unknown[]) => console.log('[SkillRuntime:Debug]', ...args),
}

// ============================================================================
// 类型定义 (与 gateway/protocol/skill-execution.ts 保持一致)
// ============================================================================

/**
 * 技能执行模式
 */
export type SkillRunMode = 'server' | 'local' | 'hybrid'

/**
 * 技能执行请求
 */
export interface SkillExecuteRequest {
  requestId: string
  skillId: string
  skillName?: string
  params: Record<string, unknown>
  requireConfirm: boolean
  confirmMessage?: string
  timeoutMs: number
  runMode: SkillRunMode
  priority?: number
  metadata?: Record<string, unknown>
}

/**
 * 技能执行结果
 */
export interface SkillExecuteResult {
  requestId: string
  success: boolean
  result?: unknown
  error?: SkillExecuteError
  executionTimeMs: number
  resourceUsage?: SkillResourceUsage
}

/**
 * 技能执行错误
 */
export interface SkillExecuteError {
  code: SkillErrorCode
  message: string
  details?: Record<string, unknown>
  stack?: string
}

/**
 * 技能错误代码
 */
export type SkillErrorCode =
  | 'SKILL_NOT_FOUND'
  | 'SKILL_DISABLED'
  | 'PERMISSION_DENIED'
  | 'USER_CANCELLED'
  | 'TIMEOUT'
  | 'EXECUTION_ERROR'
  | 'INVALID_PARAMS'
  | 'RESOURCE_LIMIT'
  | 'SANDBOX_VIOLATION'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR'

/**
 * 资源使用情况
 */
export interface SkillResourceUsage {
  cpuTimeMs?: number
  memoryPeakBytes?: number
  networkRequests?: number
  fileOperations?: number
}

/**
 * 技能定义
 */
export interface SkillDefinition {
  id: string
  name: string
  description?: string
  version: string
  runMode: SkillRunMode
  enabled: boolean
  permissions?: SkillPermissions
  execute: (params: Record<string, unknown>, context: SkillExecutionContext) => Promise<unknown>
}

/**
 * 技能权限
 */
export interface SkillPermissions {
  fileSystem?: {
    read?: string[]
    write?: string[]
  }
  network?: {
    allowedHosts?: string[]
    allowAll?: boolean
  }
  process?: {
    allowedCommands?: string[]
    allowAll?: boolean
  }
  requireConfirm?: boolean
}

/**
 * 技能执行上下文
 */
export interface SkillExecutionContext {
  /** 系统服务 */
  systemService: SystemService
  /** 请求用户确认 */
  confirm: (message: string) => Promise<boolean>
  /** 日志输出 */
  log: typeof log
  /** 取消信号 */
  abortSignal?: AbortSignal
  /** 沙箱实例 (可选) */
  sandbox?: SkillSandbox
}

// ============================================================================
// 内置技能实现
// ============================================================================

/**
 * 内置技能：文件列表
 */
const fileListSkill: SkillDefinition = {
  id: 'builtin:file-list',
  name: '文件列表',
  description: '列出指定目录下的文件',
  version: '1.0.0',
  runMode: 'local',
  enabled: true,
  permissions: {
    fileSystem: { read: ['*'] },
  },
  execute: async (params, context) => {
    const dirPath = params['path'] as string
    if (!dirPath) {
      throw new Error('缺少 path 参数')
    }
    const files = await context.systemService.listDirectory(dirPath)
    return { files, count: files.length }
  },
}

/**
 * 内置技能：读取文件
 */
const fileReadSkill: SkillDefinition = {
  id: 'builtin:file-read',
  name: '读取文件',
  description: '读取指定文件的内容',
  version: '1.0.0',
  runMode: 'local',
  enabled: true,
  permissions: {
    fileSystem: { read: ['*'] },
  },
  execute: async (params, context) => {
    const filePath = params['path'] as string
    if (!filePath) {
      throw new Error('缺少 path 参数')
    }
    const content = await context.systemService.readFile(filePath)
    return { content, path: filePath }
  },
}

/**
 * 内置技能：系统信息
 */
const systemInfoSkill: SkillDefinition = {
  id: 'builtin:system-info',
  name: '系统信息',
  description: '获取系统基本信息',
  version: '1.0.0',
  runMode: 'local',
  enabled: true,
  execute: async (_params, context) => {
    const info = await context.systemService.getSystemInfo()
    return info
  },
}

/**
 * 内置技能：执行命令
 */
const executeCommandSkill: SkillDefinition = {
  id: 'builtin:execute-command',
  name: '执行命令',
  description: '执行系统命令',
  version: '1.0.0',
  runMode: 'local',
  enabled: true,
  permissions: {
    process: { allowAll: false },
    requireConfirm: true,
  },
  execute: async (params, context) => {
    const command = params['command'] as string
    if (!command) {
      throw new Error('缺少 command 参数')
    }

    // 需要用户确认
    const confirmed = await context.confirm(`确认执行命令: ${command}`)
    if (!confirmed) {
      throw new Error('用户取消执行')
    }

    const result = await context.systemService.executeCommand(command)
    return result
  },
}

// 内置技能列表
const BUILTIN_SKILLS: SkillDefinition[] = [
  fileListSkill,
  fileReadSkill,
  systemInfoSkill,
  executeCommandSkill,
]

// ============================================================================
// ClientSkillRuntime 类
// ============================================================================

/**
 * 客户端技能运行时
 */
export class ClientSkillRuntime extends EventEmitter {
  private skills: Map<string, SkillDefinition> = new Map()
  private systemService: SystemService | null = null
  private mainWindow: BrowserWindow | null = null
  private runningTasks: Map<string, AbortController> = new Map()
  private confirmHandler: ((skillName: string, params: Record<string, unknown>) => Promise<boolean>) | null = null
  private initialized = false
  private sandbox: SkillSandbox | null = null
  private sandboxEnabled = false

  constructor(systemService?: SystemService) {
    super()
    if (systemService) {
      this.systemService = systemService
    }

    // 注册内置技能
    for (const skill of BUILTIN_SKILLS) {
      this.skills.set(skill.id, skill)
    }

    log.info('ClientSkillRuntime created', {
      builtinSkills: BUILTIN_SKILLS.length,
    })
  }

  /**
   * 初始化技能运行时
   */
  async initialize(skillsDir: string, enableSandbox = false): Promise<void> {
    if (this.initialized) {
      log.warn('SkillRuntime already initialized')
      return
    }

    log.info('Initializing SkillRuntime', { skillsDir, enableSandbox })

    // 初始化沙箱 (如果启用)
    if (enableSandbox) {
      this.sandbox = createDefaultSandbox()
      const sandboxReady = await this.sandbox.initialize()
      this.sandboxEnabled = sandboxReady
      log.info('Sandbox initialization', { enabled: this.sandboxEnabled })
    }

    // TODO: 从 skillsDir 加载用户自定义技能
    // 目前只使用内置技能

    this.initialized = true
    log.info('SkillRuntime initialized')
  }

  /**
   * 设置系统服务
   */
  setSystemService(service: SystemService): void {
    this.systemService = service
    log.info('SystemService set')
  }

  /**
   * 设置确认对话框处理器
   */
  setConfirmHandler(handler: (skillName: string, params: Record<string, unknown>) => Promise<boolean>): void {
    this.confirmHandler = handler
    log.info('ConfirmHandler set')
  }

  /**
   * 启用/禁用沙箱
   */
  async setSandboxEnabled(enabled: boolean): Promise<void> {
    if (enabled && !this.sandbox) {
      this.sandbox = createDefaultSandbox()
      await this.sandbox.initialize()
    }
    this.sandboxEnabled = enabled
    log.info('Sandbox enabled state changed', { enabled })
  }

  /**
   * 获取沙箱状态
   */
  getSandboxStatus(): { enabled: boolean; hasIsolatedVm: boolean } | null {
    if (!this.sandbox) {
      return null
    }
    const status = this.sandbox.getStatus()
    return {
      enabled: this.sandboxEnabled,
      hasIsolatedVm: status.hasIsolatedVm,
    }
  }

  /**
   * 设置主窗口 (用于显示确认对话框)
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  /**
   * 注册技能
   */
  registerSkill(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill)
    log.info('Skill registered', { skillId: skill.id, name: skill.name })
  }

  /**
   * 注销技能
   */
  unregisterSkill(skillId: string): boolean {
    const removed = this.skills.delete(skillId)
    if (removed) {
      log.info('Skill unregistered', { skillId })
    }
    return removed
  }

  /**
   * 获取技能列表
   */
  listSkills(): SkillDefinition[] {
    return Array.from(this.skills.values()).filter((s) => s.enabled)
  }

  /**
   * 获取技能
   */
  getSkill(skillId: string): SkillDefinition | undefined {
    return this.skills.get(skillId)
  }

  /**
   * 执行技能
   */
  async executeSkill(request: SkillExecuteRequest): Promise<SkillExecuteResult> {
    const startTime = Date.now()
    const { requestId, skillId, params, requireConfirm, confirmMessage, timeoutMs } = request

    log.info('Executing skill', { requestId, skillId, params })

    try {
      // 检查 SystemService 是否已设置
      if (!this.systemService) {
        return this.createErrorResult(requestId, 'INTERNAL_ERROR', 'SystemService 未初始化', startTime)
      }

      // 查找技能
      const skill = this.skills.get(skillId)
      if (!skill) {
        return this.createErrorResult(requestId, 'SKILL_NOT_FOUND', `技能不存在: ${skillId}`, startTime)
      }

      // 检查技能是否启用
      if (!skill.enabled) {
        return this.createErrorResult(requestId, 'SKILL_DISABLED', `技能已禁用: ${skillId}`, startTime)
      }

      // 用户确认 (如果需要)
      if (requireConfirm || skill.permissions?.requireConfirm) {
        const message = confirmMessage || `确认执行技能: ${skill.name}?`
        const confirmed = await this.showConfirmDialog(message, skill.name, params)
        if (!confirmed) {
          return this.createErrorResult(requestId, 'USER_CANCELLED', '用户取消执行', startTime)
        }
      }

      // 创建取消控制器
      const abortController = new AbortController()
      this.runningTasks.set(requestId, abortController)

      // 设置超时
      const timeoutId = setTimeout(() => {
        abortController.abort()
      }, timeoutMs)

      try {
        // 创建执行上下文
        const context: SkillExecutionContext = {
          systemService: this.systemService,
          confirm: (msg) => this.showConfirmDialog(msg, skill.name, params),
          log,
          abortSignal: abortController.signal,
          sandbox: this.sandboxEnabled ? this.sandbox ?? undefined : undefined,
        }

        // 执行技能
        const result = await skill.execute(params, context)

        clearTimeout(timeoutId)

        return {
          requestId,
          success: true,
          result,
          executionTimeMs: Date.now() - startTime,
        }
      } finally {
        clearTimeout(timeoutId)
        this.runningTasks.delete(requestId)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorCode: SkillErrorCode = errorMessage.includes('abort')
        ? 'TIMEOUT'
        : 'EXECUTION_ERROR'

      log.error('Skill execution failed', { requestId, skillId, error: errorMessage })

      return this.createErrorResult(requestId, errorCode, errorMessage, startTime)
    }
  }

  /**
   * 取消正在执行的技能
   */
  cancelExecution(requestId: string): boolean {
    const controller = this.runningTasks.get(requestId)
    if (controller) {
      controller.abort()
      this.runningTasks.delete(requestId)
      log.info('Skill execution cancelled', { requestId })
      return true
    }
    return false
  }

  /**
   * 显示确认对话框
   */
  private async showConfirmDialog(message: string, skillName: string, params?: Record<string, unknown>): Promise<boolean> {
    // 如果设置了自定义确认处理器，使用它
    if (this.confirmHandler) {
      return this.confirmHandler(skillName, params || {})
    }

    // 否则使用默认的 Electron 对话框
    if (!this.mainWindow) {
      log.warn('No mainWindow set, auto-confirming')
      return true
    }

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'question',
      buttons: ['确认', '取消'],
      defaultId: 0,
      cancelId: 1,
      title: '技能执行确认',
      message: skillName,
      detail: message,
    })

    return result.response === 0
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(
    requestId: string,
    code: SkillErrorCode,
    message: string,
    startTime: number
  ): SkillExecuteResult {
    return {
      requestId,
      success: false,
      error: { code, message },
      executionTimeMs: Date.now() - startTime,
    }
  }
}

// 导出事件名称常量
export const SKILL_EXECUTE_EVENT = 'skill.execute.request'
export const SKILL_RESULT_METHOD = 'assistant.skill.result'
