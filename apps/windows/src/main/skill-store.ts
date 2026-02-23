/**
 * LocalSkillStore - 本地技能存储管理
 *
 * 管理 ~/.openclaw/skills/ 目录下的技能文件
 * 维护 index.json 索引文件，支持安装、卸载、列表查询
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

/** 日志 */
const log = {
  info: (...args: unknown[]) => console.log('[LocalSkillStore]', ...args),
  error: (...args: unknown[]) => console.error('[LocalSkillStore]', ...args),
  warn: (...args: unknown[]) => console.warn('[LocalSkillStore]', ...args),
  debug: (...args: unknown[]) => console.log('[LocalSkillStore:Debug]', ...args),
}

/**
 * 技能清单文件结构 (skill.json)
 */
export interface SkillManifest {
  /** 技能 ID */
  id: string
  /** 技能名称 */
  name: string
  /** 技能描述 */
  description?: string
  /** 版本 */
  version: string
  /** 作者 */
  author?: string
  /** 入口文件（相对于技能目录） */
  entry: string
  /** 运行时类型 */
  runtime: 'typescript' | 'javascript' | 'python' | 'shell'
  /** 权限声明 */
  permissions?: {
    fileSystem?: { read?: string[]; write?: string[] }
    network?: { allowedHosts?: string[]; allowAll?: boolean }
    process?: { allowedCommands?: string[]; allowAll?: boolean }
    requireConfirm?: boolean
  }
  /** 支持平台 */
  platforms?: string[]
  /** 分类 */
  category?: string
  /** 图标 */
  icon?: string
}

/**
 * 索引文件中的技能条目
 */
export interface SkillIndexEntry {
  /** 技能 ID */
  id: string
  /** 技能目录名 */
  dirName: string
  /** 技能名称 */
  name: string
  /** 版本 */
  version: string
  /** 运行时类型 */
  runtime: string
  /** 安装时间 */
  installedAt: string
  /** 是否启用 */
  enabled: boolean
  /** 最后执行时间 */
  lastExecutedAt?: string
  /** 执行次数 */
  executionCount: number
}

/**
 * 索引文件结构
 */
export interface SkillIndex {
  /** 版本 */
  version: number
  /** 最后更新时间 */
  updatedAt: string
  /** 技能列表 */
  skills: SkillIndexEntry[]
}

/**
 * 本地技能存储
 */
export class LocalSkillStore {
  private readonly skillsDir: string
  private readonly indexPath: string
  private index: SkillIndex | null = null

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir
    this.indexPath = path.join(skillsDir, 'index.json')
  }

  /**
   * 初始化存储目录和索引
   */
  async initialize(): Promise<void> {
    log.info('初始化本地技能存储', { skillsDir: this.skillsDir })

    // 确保目录存在
    await fs.promises.mkdir(this.skillsDir, { recursive: true })

    // 加载或创建索引
    this.index = await this.loadIndex()
    log.info('本地技能存储初始化完成', { skillCount: this.index.skills.length })
  }

  /**
   * 从磁盘目录安装技能
   *
   * 将源目录复制到 skillsDir 下，并更新索引
   *
   * @param sourceDir - 技能源目录（需包含 skill.json）
   * @returns 安装结果
   */
  async installFromDirectory(sourceDir: string): Promise<{
    success: boolean
    skillId?: string
    error?: string
  }> {
    log.info('从目录安装技能', { sourceDir })

    try {
      // 读取 skill.json
      const manifestPath = path.join(sourceDir, 'skill.json')
      const manifestExists = await fileExists(manifestPath)

      if (!manifestExists) {
        return { success: false, error: '源目录缺少 skill.json 清单文件' }
      }

      const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8')
      const manifest: SkillManifest = JSON.parse(manifestContent)

      // 验证清单
      const validation = validateManifest(manifest)
      if (!validation.valid) {
        return { success: false, error: `清单文件无效: ${validation.errors.join(', ')}` }
      }

      // 检查入口文件是否存在
      const entryPath = path.join(sourceDir, manifest.entry)
      const entryExists = await fileExists(entryPath)

      if (!entryExists) {
        return { success: false, error: `入口文件不存在: ${manifest.entry}` }
      }

      // 目标目录：使用技能 ID 作为目录名
      const targetDirName = sanitizeDirName(manifest.id)
      const targetDir = path.join(this.skillsDir, targetDirName)

      // 如果已存在，先删除旧版本
      if (await fileExists(targetDir)) {
        log.info('删除旧版本技能目录', { targetDir })
        await fs.promises.rm(targetDir, { recursive: true, force: true })
      }

      // 复制目录
      await copyDirectory(sourceDir, targetDir)

      // 更新索引
      await this.ensureIndex()
      const existingIdx = this.index!.skills.findIndex((s) => s.id === manifest.id)
      const entry: SkillIndexEntry = {
        id: manifest.id,
        dirName: targetDirName,
        name: manifest.name,
        version: manifest.version,
        runtime: manifest.runtime,
        installedAt: new Date().toISOString(),
        enabled: true,
        executionCount: 0,
      }

      if (existingIdx >= 0) {
        this.index!.skills[existingIdx] = entry
      } else {
        this.index!.skills = [...this.index!.skills, entry]
      }

      await this.saveIndex()

      log.info('技能安装成功', { skillId: manifest.id, version: manifest.version })
      return { success: true, skillId: manifest.id }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log.error('技能安装失败', { error: errorMessage })
      return { success: false, error: errorMessage }
    }
  }

  /**
   * 卸载技能
   */
  async uninstall(skillId: string): Promise<{ success: boolean; error?: string }> {
    log.info('卸载技能', { skillId })

    await this.ensureIndex()
    const entry = this.index!.skills.find((s) => s.id === skillId)

    if (!entry) {
      return { success: false, error: `技能不存在: ${skillId}` }
    }

    try {
      // 删除技能目录
      const skillDir = path.join(this.skillsDir, entry.dirName)
      if (await fileExists(skillDir)) {
        await fs.promises.rm(skillDir, { recursive: true, force: true })
      }

      // 从索引中移除
      this.index!.skills = this.index!.skills.filter((s) => s.id !== skillId)
      await this.saveIndex()

      log.info('技能卸载成功', { skillId })
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log.error('技能卸载失败', { skillId, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  }

  /**
   * 获取已安装技能列表
   */
  async listInstalled(): Promise<SkillIndexEntry[]> {
    await this.ensureIndex()
    return [...this.index!.skills]
  }

  /**
   * 获取技能清单
   */
  async getManifest(skillId: string): Promise<SkillManifest | null> {
    await this.ensureIndex()
    const entry = this.index!.skills.find((s) => s.id === skillId)
    if (!entry) {
      return null
    }

    const manifestPath = path.join(this.skillsDir, entry.dirName, 'skill.json')
    try {
      const content = await fs.promises.readFile(manifestPath, 'utf-8')
      return JSON.parse(content) as SkillManifest
    } catch {
      log.warn('读取技能清单失败', { skillId, manifestPath })
      return null
    }
  }

  /**
   * 获取技能入口文件的绝对路径
   */
  async getEntryPath(skillId: string): Promise<string | null> {
    const manifest = await this.getManifest(skillId)
    if (!manifest) {
      return null
    }

    const entry = this.index!.skills.find((s) => s.id === skillId)
    if (!entry) {
      return null
    }

    return path.join(this.skillsDir, entry.dirName, manifest.entry)
  }

  /**
   * 启用/禁用技能
   */
  async setEnabled(skillId: string, enabled: boolean): Promise<boolean> {
    await this.ensureIndex()
    const entry = this.index!.skills.find((s) => s.id === skillId)
    if (!entry) {
      return false
    }

    this.index!.skills = this.index!.skills.map((s) =>
      s.id === skillId ? { ...s, enabled } : s,
    )
    await this.saveIndex()
    return true
  }

  /**
   * 更新执行统计
   */
  async recordExecution(skillId: string): Promise<void> {
    await this.ensureIndex()
    this.index!.skills = this.index!.skills.map((s) =>
      s.id === skillId
        ? {
            ...s,
            executionCount: s.executionCount + 1,
            lastExecutedAt: new Date().toISOString(),
          }
        : s,
    )
    await this.saveIndex()
  }

  /**
   * 重新从磁盘读取索引（丢弃内存缓存）
   */
  async reload(): Promise<void> {
    this.index = await this.loadIndex()
    log.info('索引已重新加载', { skillCount: this.index.skills.length })
  }

  /**
   * 获取技能安装目录的绝对路径
   *
   * @param skillId - 技能 ID
   * @returns 技能目录路径，不存在时返回 null
   */
  getSkillDirectory(skillId: string): string | null {
    if (!this.index) return null
    const entry = this.index.skills.find((s) => s.id === skillId)
    if (!entry) return null
    const dir = path.join(this.skillsDir, entry.dirName)
    return fs.existsSync(dir) ? dir : null
  }

  /**
   * 加载索引文件
   */
  private async loadIndex(): Promise<SkillIndex> {
    try {
      const content = await fs.promises.readFile(this.indexPath, 'utf-8')
      return JSON.parse(content) as SkillIndex
    } catch {
      // 索引不存在或损坏，创建新的
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        skills: [],
      }
    }
  }

  /**
   * 保存索引文件
   */
  private async saveIndex(): Promise<void> {
    if (!this.index) {
      return
    }

    this.index = {
      ...this.index,
      updatedAt: new Date().toISOString(),
    }

    await fs.promises.writeFile(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8')
    log.debug('索引已保存', { skillCount: this.index.skills.length })
  }

  /**
   * 确保索引已加载
   */
  private async ensureIndex(): Promise<void> {
    if (!this.index) {
      this.index = await this.loadIndex()
    }
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 验证技能清单
 */
export function validateManifest(manifest: SkillManifest): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('缺少有效的 id 字段')
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('缺少有效的 name 字段')
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('缺少有效的 version 字段')
  }
  if (!manifest.entry || typeof manifest.entry !== 'string') {
    errors.push('缺少有效的 entry 字段')
  }
  if (!manifest.runtime || !['typescript', 'javascript', 'python', 'shell'].includes(manifest.runtime)) {
    errors.push('runtime 字段必须为 typescript、javascript、python 或 shell')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * 清理目录名（移除特殊字符）
 */
function sanitizeDirName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * 检查文件/目录是否存在
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 递归复制目录
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true })
  const entries = await fs.promises.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else {
      await fs.promises.copyFile(srcPath, destPath)
    }
  }
}
