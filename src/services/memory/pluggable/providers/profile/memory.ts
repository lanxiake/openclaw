/**
 * 内存画像记忆提供者
 *
 * 使用内存存储实现画像记忆，适用于开发和测试环境。
 * 数据在进程重启后会丢失。
 *
 * @module memory/pluggable/providers/profile
 */

import { randomUUID } from "node:crypto";

import type { HealthStatus, ProviderConfig } from "../../interfaces/memory-provider.js";
import type { Message } from "../../interfaces/working-memory.js";
import type {
  BehaviorPattern,
  ExtractedProfile,
  FactCategory,
  IProfileMemoryProvider,
  UserFact,
  UserPreferences,
} from "../../interfaces/profile-memory.js";
import { DEFAULT_USER_PREFERENCES } from "../../interfaces/profile-memory.js";
import { registerProvider } from "../factory.js";

/**
 * 用户画像数据存储结构
 */
interface UserProfileData {
  /** 用户事实 (factId -> fact) */
  facts: Map<string, UserFact>;
  /** 用户偏好 */
  preferences: UserPreferences;
  /** 行为模式 (patternId -> pattern) */
  patterns: Map<string, BehaviorPattern>;
}

/**
 * 内存画像记忆提供者
 *
 * 特性:
 * - 内存存储，重启后数据丢失
 * - 简化的画像提取（基于规则匹配）
 * - 简单的文本搜索
 *
 * @example
 * ```typescript
 * const provider = new MemoryProfileMemoryProvider()
 * await provider.initialize()
 *
 * await provider.addFact('user-1', {
 *   category: 'work',
 *   key: 'company',
 *   value: 'OpenClaw',
 *   confidence: 1.0,
 *   source: 'explicit',
 *   sensitive: false,
 * })
 *
 * await provider.shutdown()
 * ```
 */
export class MemoryProfileMemoryProvider implements IProfileMemoryProvider {
  readonly name = "memory-profile";
  readonly version = "1.0.0";

  /** 用户数据存储 (userId -> data) */
  private storage = new Map<string, UserProfileData>();

  /**
   * 创建内存画像记忆提供者
   *
   * @param _config - 配置（当前未使用）
   */
  constructor(_config?: ProviderConfig) {
    // 内存提供者不需要配置
  }

  /**
   * 初始化提供者
   */
  async initialize(): Promise<void> {
    console.log("[memory-profile] 初始化内存画像记忆提供者");
    this.storage.clear();
    console.log("[memory-profile] 初始化完成");
  }

  /**
   * 关闭提供者
   */
  async shutdown(): Promise<void> {
    console.log("[memory-profile] 关闭提供者");
    this.storage.clear();
    console.log("[memory-profile] 已关闭");
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    return {
      status: "healthy",
      latency: 0,
      details: {
        userCount: this.storage.size,
      },
    };
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 获取或创建用户数据
   */
  private getUserData(userId: string): UserProfileData {
    let data = this.storage.get(userId);
    if (!data) {
      data = {
        facts: new Map(),
        preferences: { ...DEFAULT_USER_PREFERENCES },
        patterns: new Map(),
      };
      this.storage.set(userId, data);
    }
    return data;
  }

  /**
   * 简单文本匹配搜索
   */
  private textMatch(text: string, query: string): boolean {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/).filter((w) => w.length > 0);

    if (words.length === 0) return false;

    return words.every((word) => lowerText.includes(word));
  }

  // ==================== 事实管理 ====================

  /**
   * 添加用户事实
   */
  async addFact(
    userId: string,
    fact: Omit<UserFact, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const factId = randomUUID();
    const now = new Date();

    console.log(`[memory-profile] 添加事实: ${factId} (用户: ${userId}, 类别: ${fact.category})`);

    const data = this.getUserData(userId);
    const fullFact: UserFact = {
      ...fact,
      id: factId,
      createdAt: now,
      updatedAt: now,
    };

    data.facts.set(factId, fullFact);

    return factId;
  }

  /**
   * 更新用户事实
   */
  async updateFact(userId: string, factId: string, updates: Partial<UserFact>): Promise<void> {
    console.log(`[memory-profile] 更新事实: ${factId} (用户: ${userId})`);

    const data = this.getUserData(userId);
    const fact = data.facts.get(factId);

    if (!fact) {
      throw new Error(`事实不存在: ${factId}`);
    }

    const updatedFact: UserFact = {
      ...fact,
      ...updates,
      id: factId, // 确保 ID 不变
      createdAt: fact.createdAt, // 创建时间不变
      updatedAt: new Date(),
    };

    data.facts.set(factId, updatedFact);
  }

  /**
   * 删除用户事实
   */
  async deleteFact(userId: string, factId: string): Promise<void> {
    console.log(`[memory-profile] 删除事实: ${factId} (用户: ${userId})`);

    const data = this.getUserData(userId);
    data.facts.delete(factId);
  }

  /**
   * 获取用户事实
   */
  async getFacts(userId: string, category?: FactCategory): Promise<UserFact[]> {
    const data = this.getUserData(userId);
    let facts = Array.from(data.facts.values());

    if (category) {
      facts = facts.filter((f) => f.category === category);
    }

    // 按更新时间排序（最新在前）
    facts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return facts;
  }

  /**
   * 搜索用户事实
   */
  async searchFacts(userId: string, query: string): Promise<UserFact[]> {
    console.log(`[memory-profile] 搜索事实: "${query}" (用户: ${userId})`);

    const data = this.getUserData(userId);
    const results: UserFact[] = [];

    for (const fact of data.facts.values()) {
      if (this.textMatch(`${fact.key} ${fact.value}`, query)) {
        results.push(fact);
      }
    }

    return results;
  }

  // ==================== 偏好管理 ====================

  /**
   * 获取用户偏好
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    const data = this.getUserData(userId);
    return { ...data.preferences };
  }

  /**
   * 更新用户偏好
   */
  async updatePreferences(userId: string, updates: Partial<UserPreferences>): Promise<void> {
    console.log(`[memory-profile] 更新偏好 (用户: ${userId})`);

    const data = this.getUserData(userId);

    // 深度合并更新
    data.preferences = {
      ...data.preferences,
      ...updates,
      // 特殊处理嵌套对象
      notifications: {
        ...data.preferences.notifications,
        ...(updates.notifications || {}),
      },
    };
  }

  /**
   * 重置用户偏好
   */
  async resetPreferences(userId: string): Promise<void> {
    console.log(`[memory-profile] 重置偏好 (用户: ${userId})`);

    const data = this.getUserData(userId);
    data.preferences = { ...DEFAULT_USER_PREFERENCES };
  }

  // ==================== 行为模式 ====================

  /**
   * 添加行为模式
   */
  async addPattern(
    userId: string,
    pattern: Omit<BehaviorPattern, "id" | "updatedAt">,
  ): Promise<string> {
    const patternId = randomUUID();
    const now = new Date();

    console.log(`[memory-profile] 添加模式: ${patternId} (用户: ${userId}, 类型: ${pattern.type})`);

    const data = this.getUserData(userId);
    const fullPattern: BehaviorPattern = {
      ...pattern,
      id: patternId,
      updatedAt: now,
    };

    data.patterns.set(patternId, fullPattern);

    return patternId;
  }

  /**
   * 获取行为模式
   */
  async getPatterns(userId: string): Promise<BehaviorPattern[]> {
    const data = this.getUserData(userId);
    const patterns = Array.from(data.patterns.values());

    // 按更新时间排序（最新在前）
    patterns.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return patterns;
  }

  /**
   * 更新行为模式
   */
  async updatePattern(
    userId: string,
    patternId: string,
    updates: Partial<BehaviorPattern>,
  ): Promise<void> {
    console.log(`[memory-profile] 更新模式: ${patternId} (用户: ${userId})`);

    const data = this.getUserData(userId);
    const pattern = data.patterns.get(patternId);

    if (!pattern) {
      throw new Error(`模式不存在: ${patternId}`);
    }

    const updatedPattern: BehaviorPattern = {
      ...pattern,
      ...updates,
      id: patternId, // 确保 ID 不变
      updatedAt: new Date(),
    };

    data.patterns.set(patternId, updatedPattern);
  }

  /**
   * 删除行为模式
   */
  async deletePattern(userId: string, patternId: string): Promise<void> {
    console.log(`[memory-profile] 删除模式: ${patternId} (用户: ${userId})`);

    const data = this.getUserData(userId);
    data.patterns.delete(patternId);
  }

  /**
   * 确认行为模式
   */
  async confirmPattern(userId: string, patternId: string, confirmed: boolean): Promise<void> {
    console.log(`[memory-profile] 确认模式: ${patternId} = ${confirmed} (用户: ${userId})`);

    const data = this.getUserData(userId);
    const pattern = data.patterns.get(patternId);

    if (!pattern) {
      throw new Error(`模式不存在: ${patternId}`);
    }

    pattern.confirmed = confirmed;
    pattern.updatedAt = new Date();
  }

  // ==================== 自动提取 ====================

  /**
   * 从对话中提取画像
   *
   * 注意：这是一个简化版本，使用简单的规则匹配。
   * 生产环境应该使用 AI 进行提取。
   */
  async extractFromConversation(userId: string, messages: Message[]): Promise<ExtractedProfile> {
    console.log(`[memory-profile] 从对话提取画像 (用户: ${userId}, 消息数: ${messages.length})`);

    const result: ExtractedProfile = {
      newFacts: [],
      updatedFacts: [],
      newPatterns: [],
    };

    // 简单的规则匹配提取
    const allText = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" ");

    // 提取姓名模式: "我叫XXX" / "我是XXX" / "我的名字是XXX"
    const namePatterns = [
      /我叫([^\s,，。.]+)/,
      /我是([^\s,，。.]+)/,
      /我的名字是([^\s,，。.]+)/,
      /my name is (\w+)/i,
      /i'm (\w+)/i,
      /i am (\w+)/i,
    ];

    for (const pattern of namePatterns) {
      const match = allText.match(pattern);
      if (match && match[1]) {
        result.newFacts.push({
          id: randomUUID(),
          content: match[1],
          category: "personal",
          confidence: 0.7,
        });
        break;
      }
    }

    // 提取公司模式: "我在XXX工作" / "我的公司是XXX"
    const companyPatterns = [
      /我在([^\s,，。.]+)工作/,
      /我的公司是([^\s,，。.]+)/,
      /i work at (\w+)/i,
      /i work for (\w+)/i,
    ];

    for (const pattern of companyPatterns) {
      const match = allText.match(pattern);
      if (match && match[1]) {
        result.newFacts.push({
          id: randomUUID(),
          content: match[1],
          category: "work",
          confidence: 0.6,
        });
        break;
      }
    }

    // 提取兴趣模式: "我喜欢XXX" / "我爱XXX"
    const hobbyPatterns = [
      /我喜欢([^\s,，。.]+)/g,
      /我爱([^\s,，。.]+)/g,
      /i like (\w+)/gi,
      /i love (\w+)/gi,
    ];

    for (const pattern of hobbyPatterns) {
      const matches = allText.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 1) {
          result.newFacts.push({
            id: randomUUID(),
            content: match[1],
            category: "hobby",
            confidence: 0.5,
          });
        }
      }
    }

    return result;
  }

  /**
   * 确认提取结果
   *
   * 注意：简化版本，直接忽略确认操作
   */
  async confirmExtraction(userId: string, extractionId: string, confirmed: boolean): Promise<void> {
    console.log(`[memory-profile] 确认提取: ${extractionId} = ${confirmed} (用户: ${userId})`);
    // 简化版本：不做任何操作
  }

  // ==================== 导出 ====================

  /**
   * 导出用户画像
   */
  async exportProfile(userId: string): Promise<{
    facts: UserFact[];
    preferences: UserPreferences;
    patterns: BehaviorPattern[];
  }> {
    console.log(`[memory-profile] 导出画像 (用户: ${userId})`);

    const data = this.getUserData(userId);

    return {
      facts: Array.from(data.facts.values()),
      preferences: { ...data.preferences },
      patterns: Array.from(data.patterns.values()),
    };
  }
}

// 自动注册提供者
registerProvider(
  "profile",
  "memory",
  MemoryProfileMemoryProvider as unknown as new (
    options: Record<string, unknown>,
  ) => MemoryProfileMemoryProvider,
);
