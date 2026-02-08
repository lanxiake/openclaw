/**
 * 画像记忆接口
 *
 * 画像记忆存储用户的事实信息、偏好设置和行为模式，
 * 用于个性化 AI 响应。
 *
 * @module memory/pluggable/interfaces
 */

import type { IMemoryProvider } from './memory-provider.js'
import type { Message } from './working-memory.js'

// ==================== 基础类型 ====================

/**
 * 事实类别
 */
export type FactCategory =
  | 'personal'      // 个人信息（姓名、生日等）
  | 'work'          // 工作信息（公司、职位等）
  | 'hobby'         // 兴趣爱好
  | 'skill'         // 技能特长
  | 'relationship'  // 人际关系
  | 'health'        // 健康信息
  | 'finance'       // 财务信息
  | 'other'         // 其他

/**
 * 用户事实
 */
export interface UserFact {
  /** 事实 ID */
  id: string
  /** 事实类别 */
  category: FactCategory
  /** 事实键（如 name, company） */
  key: string
  /** 事实值 */
  value: string
  /** 置信度 (0-1) */
  confidence: number
  /** 来源类型 */
  source: 'explicit' | 'inferred'
  /** 提取来源会话 ID */
  extractedFrom?: string
  /** 是否敏感信息 */
  sensitive: boolean
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
  /** 有效期（如临时计划） */
  validUntil?: Date
}

/**
 * 用户偏好
 */
export interface UserPreferences {
  // ===== 交互偏好 =====
  /** 语言 */
  language: string
  /** 时区 */
  timezone: string
  /** 响应风格 */
  responseStyle: 'concise' | 'detailed' | 'casual' | 'formal'
  /** 确认级别 */
  confirmLevel: 'low' | 'medium' | 'high'

  // ===== 功能偏好 =====
  /** 喜欢的技能 */
  favoriteSkills: string[]
  /** 禁用的技能 */
  disabledSkills: string[]

  // ===== AI 行为偏好 =====
  /** 思考级别 */
  thinkingLevel: 'low' | 'medium' | 'high'
  /** 详细程度 */
  verboseLevel: 'minimal' | 'normal' | 'verbose'

  // ===== 通知偏好 =====
  /** 通知设置 */
  notifications: {
    enabled: boolean
    quietHours?: { start: string; end: string }
    channels: string[]
  }
}

/**
 * 默认用户偏好
 */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  responseStyle: 'detailed',
  confirmLevel: 'medium',
  favoriteSkills: [],
  disabledSkills: [],
  thinkingLevel: 'medium',
  verboseLevel: 'normal',
  notifications: {
    enabled: true,
    channels: [],
  },
}

/**
 * 行为模式类型
 */
export type BehaviorPatternType =
  | 'time_preference'   // 时间偏好（如早起者）
  | 'topic_interest'    // 话题兴趣
  | 'work_style'        // 工作风格
  | 'communication'     // 沟通方式

/**
 * 行为模式
 */
export interface BehaviorPattern {
  /** 模式 ID */
  id: string
  /** 模式类型 */
  type: BehaviorPatternType
  /** 模式描述 */
  pattern: string
  /** 支撑证据 */
  evidence: string[]
  /** 置信度 (0-1) */
  confidence: number
  /** 用户是否确认 */
  confirmed?: boolean
  /** 更新时间 */
  updatedAt: Date
}

/**
 * 提取的画像
 */
export interface ExtractedProfile {
  /** 新发现的事实 */
  newFacts: Array<{
    id: string
    content: string
    category: FactCategory
    confidence: number
  }>
  /** 更新的事实 */
  updatedFacts: Array<{
    id: string
    content: string
    previousValue: string
  }>
  /** 新发现的行为模式 */
  newPatterns: Array<{
    type: BehaviorPatternType
    pattern: string
    confidence: number
  }>
}

// ==================== 提供者接口 ====================

/**
 * 画像记忆提供者接口
 *
 * 管理用户事实、偏好和行为模式，支持从对话中自动提取。
 *
 * @example
 * ```typescript
 * const provider = new PostgresProfileMemoryProvider({ url: '...' })
 * await provider.initialize()
 *
 * // 添加事实
 * await provider.addFact('user-123', {
 *   category: 'work',
 *   key: 'company',
 *   value: 'OpenClaw',
 *   confidence: 1.0,
 *   source: 'explicit',
 *   sensitive: false,
 * })
 *
 * // 获取偏好
 * const prefs = await provider.getPreferences('user-123')
 *
 * // 从对话提取
 * const extracted = await provider.extractFromConversation('user-123', messages)
 *
 * await provider.shutdown()
 * ```
 */
export interface IProfileMemoryProvider extends IMemoryProvider {
  // ==================== 事实管理 ====================

  /**
   * 添加用户事实
   *
   * @param userId - 用户 ID
   * @param fact - 事实信息（不含 id、createdAt、updatedAt）
   * @returns 事实 ID
   */
  addFact(
    userId: string,
    fact: Omit<UserFact, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string>

  /**
   * 更新用户事实
   *
   * @param userId - 用户 ID
   * @param factId - 事实 ID
   * @param updates - 要更新的字段
   */
  updateFact(userId: string, factId: string, updates: Partial<UserFact>): Promise<void>

  /**
   * 删除用户事实
   *
   * @param userId - 用户 ID
   * @param factId - 事实 ID
   */
  deleteFact(userId: string, factId: string): Promise<void>

  /**
   * 获取用户事实
   *
   * @param userId - 用户 ID
   * @param category - 可选的类别过滤
   * @returns 事实列表
   */
  getFacts(userId: string, category?: FactCategory): Promise<UserFact[]>

  /**
   * 搜索用户事实
   *
   * @param userId - 用户 ID
   * @param query - 搜索关键词
   * @returns 匹配的事实列表
   */
  searchFacts(userId: string, query: string): Promise<UserFact[]>

  // ==================== 偏好管理 ====================

  /**
   * 获取用户偏好
   *
   * @param userId - 用户 ID
   * @returns 用户偏好（不存在时返回默认值）
   */
  getPreferences(userId: string): Promise<UserPreferences>

  /**
   * 更新用户偏好
   *
   * @param userId - 用户 ID
   * @param updates - 要更新的字段
   */
  updatePreferences(userId: string, updates: Partial<UserPreferences>): Promise<void>

  /**
   * 重置用户偏好
   *
   * 恢复为默认值
   *
   * @param userId - 用户 ID
   */
  resetPreferences(userId: string): Promise<void>

  // ==================== 行为模式 ====================

  /**
   * 添加行为模式
   *
   * @param userId - 用户 ID
   * @param pattern - 模式信息（不含 id、updatedAt）
   * @returns 模式 ID
   */
  addPattern(
    userId: string,
    pattern: Omit<BehaviorPattern, 'id' | 'updatedAt'>
  ): Promise<string>

  /**
   * 获取行为模式
   *
   * @param userId - 用户 ID
   * @returns 模式列表
   */
  getPatterns(userId: string): Promise<BehaviorPattern[]>

  /**
   * 更新行为模式
   *
   * @param userId - 用户 ID
   * @param patternId - 模式 ID
   * @param updates - 要更新的字段
   */
  updatePattern(
    userId: string,
    patternId: string,
    updates: Partial<BehaviorPattern>
  ): Promise<void>

  /**
   * 删除行为模式
   *
   * @param userId - 用户 ID
   * @param patternId - 模式 ID
   */
  deletePattern(userId: string, patternId: string): Promise<void>

  /**
   * 确认行为模式
   *
   * 用户确认或否定系统推断的模式
   *
   * @param userId - 用户 ID
   * @param patternId - 模式 ID
   * @param confirmed - 是否确认
   */
  confirmPattern(userId: string, patternId: string, confirmed: boolean): Promise<void>

  // ==================== 自动提取 ====================

  /**
   * 从对话中提取画像
   *
   * 使用 AI 从对话中提取用户事实和行为模式
   *
   * @param userId - 用户 ID
   * @param messages - 对话消息列表
   * @returns 提取的画像信息
   */
  extractFromConversation(userId: string, messages: Message[]): Promise<ExtractedProfile>

  /**
   * 确认提取结果
   *
   * 用户确认或否定自动提取的信息
   *
   * @param userId - 用户 ID
   * @param extractionId - 提取 ID
   * @param confirmed - 是否确认
   */
  confirmExtraction(userId: string, extractionId: string, confirmed: boolean): Promise<void>

  // ==================== 导出 ====================

  /**
   * 导出用户画像
   *
   * 导出用户的完整画像数据
   *
   * @param userId - 用户 ID
   * @returns 完整画像数据
   */
  exportProfile(userId: string): Promise<{
    facts: UserFact[]
    preferences: UserPreferences
    patterns: BehaviorPattern[]
  }>
}
