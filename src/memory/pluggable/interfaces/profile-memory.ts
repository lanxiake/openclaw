/**
 * 画像记忆接口
 *
 * 画像记忆存储用户的事实信息、偏好设置和行为模式，
 * 用于个性化 AI 响应。
 *
 * @module memory/pluggable/interfaces
 */

import type { IMemoryProvider } from "./memory-provider.js";
import type { Message } from "./types.js";

// ==================== 基础类型 ====================

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
    facts: UserFact[];
    preferences: UserPreferences;
    patterns: BehaviorPattern[];
  }>;
}
