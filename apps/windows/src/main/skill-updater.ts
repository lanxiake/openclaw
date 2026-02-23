/**
 * SkillUpdater - 客户端技能版本检查和更新
 *
 * 通过 Gateway RPC 查询已安装技能的最新版本，
 * 支持定时自动检查和手动触发更新
 */

import type { LocalSkillStore } from './skill-store'
import { compareVersions, isUpdateAvailable, checkUpdates } from '../../../../src/assistant/skills/version-checker'

/** 日志 */
const log = {
  info: (...args: unknown[]) => console.log('[SkillUpdater]', ...args),
  error: (...args: unknown[]) => console.error('[SkillUpdater]', ...args),
  warn: (...args: unknown[]) => console.warn('[SkillUpdater]', ...args),
  debug: (...args: unknown[]) => console.log('[SkillUpdater:Debug]', ...args),
}

/**
 * 版本更新检查结果
 */
export interface UpdateCheckResult {
  skillId: string
  installedVersion: string
  latestVersion: string
  hasUpdate: boolean
}

/**
 * 获取版本信息的函数类型
 *
 * 由外部提供实现（通常通过 Gateway RPC）
 */
export type FetchVersionsFn = (
  skillIds: string[],
) => Promise<Map<string, { latestVersion: string }>>

/**
 * 下载并安装更新的函数类型
 *
 * 由外部提供实现（通常通过 Gateway 推送安装）
 */
export type DownloadAndInstallFn = (
  skillId: string,
  version: string,
) => Promise<{ success: boolean; newVersion?: string; error?: string }>

/**
 * SkillUpdater 配置
 */
export interface SkillUpdaterOptions {
  /** 获取最新版本信息的函数 */
  fetchVersions: FetchVersionsFn
  /** 下载并安装更新的函数（可选） */
  downloadAndInstall?: DownloadAndInstallFn
  /** 检查间隔 ms（默认 1 小时） */
  checkInterval?: number
}

/**
 * 技能更新器
 *
 * 负责定期检查技能版本更新并协调更新安装流程
 */
export class SkillUpdater {
  private readonly store: LocalSkillStore
  private readonly fetchVersions: FetchVersionsFn
  private readonly downloadAndInstall: DownloadAndInstallFn | null
  private readonly checkInterval: number
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(store: LocalSkillStore, options: SkillUpdaterOptions) {
    this.store = store
    this.fetchVersions = options.fetchVersions
    this.downloadAndInstall = options.downloadAndInstall ?? null
    this.checkInterval = options.checkInterval ?? 3_600_000
  }

  /**
   * 启动定期版本检查
   */
  start(): void {
    if (this.timer) {
      log.warn('更新检查定时器已在运行')
      return
    }

    log.info('启动定期版本检查', { intervalMs: this.checkInterval })
    this.timer = setInterval(() => {
      this.checkForUpdates().catch((err) => {
        log.error('定时版本检查失败', { error: String(err) })
      })
    }, this.checkInterval)
  }

  /**
   * 停止定期版本检查
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      log.info('已停止定期版本检查')
    }
  }

  /**
   * 手动触发版本检查
   *
   * @returns 所有已安装技能的版本检查结果
   */
  async checkForUpdates(): Promise<UpdateCheckResult[]> {
    log.info('开始版本检查')

    const installed = await this.store.listInstalled()
    if (installed.length === 0) {
      log.info('无已安装技能，跳过检查')
      return []
    }

    const skillIds = installed.map((s) => s.id)

    // 从 Gateway 获取最新版本
    const registry = await this.fetchVersions(skillIds)

    // 使用 version-checker 批量比较
    const installedVersions = installed.map((s) => ({
      skillId: s.id,
      version: s.version,
    }))
    const results = checkUpdates(installedVersions, registry)

    const updatesCount = results.filter((r) => r.hasUpdate).length
    log.info('版本检查完成', {
      total: results.length,
      updatesAvailable: updatesCount,
    })

    return results
  }

  /**
   * 更新指定技能到最新版本
   *
   * @param skillId - 要更新的技能 ID
   * @returns 更新结果
   */
  async updateSkill(skillId: string): Promise<{
    success: boolean
    oldVersion?: string
    newVersion?: string
    error?: string
  }> {
    log.info('开始更新技能', { skillId })

    // 1. 获取已安装版本
    const installed = await this.store.listInstalled()
    const current = installed.find((s) => s.id === skillId)
    if (!current) {
      return { success: false, error: `技能未安装: ${skillId}` }
    }

    // 2. 获取最新版本
    const registry = await this.fetchVersions([skillId])
    const registryEntry = registry.get(skillId)
    if (!registryEntry) {
      return { success: false, error: `无法获取技能版本信息: ${skillId}` }
    }

    // 3. 检查是否需要更新
    if (!isUpdateAvailable(current.version, registryEntry.latestVersion)) {
      log.info('技能已是最新版本', { skillId, version: current.version })
      return {
        success: true,
        oldVersion: current.version,
        newVersion: current.version,
        error: '已是最新版本，无需更新',
      }
    }

    // 4. 下载并安装
    if (!this.downloadAndInstall) {
      return { success: false, error: '未配置下载安装方法' }
    }

    const installResult = await this.downloadAndInstall(skillId, registryEntry.latestVersion)
    if (!installResult.success) {
      log.error('技能更新安装失败', { skillId, error: installResult.error })
      return {
        success: false,
        oldVersion: current.version,
        error: installResult.error,
      }
    }

    log.info('技能更新成功', {
      skillId,
      oldVersion: current.version,
      newVersion: registryEntry.latestVersion,
    })

    return {
      success: true,
      oldVersion: current.version,
      newVersion: registryEntry.latestVersion,
    }
  }
}
