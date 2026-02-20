/**
 * 记忆召回 Hook (before_agent_start)
 *
 * 在 Agent 启动前从记忆系统中召回用户相关信息，
 * 注入到 Agent 上下文中，实现个性化响应。
 *
 * 召回内容包括：
 * 1. 用户画像事实（姓名、工作、技能等）
 * 2. 用户偏好设置（语言、响应风格等）
 * 3. 相关情节记忆（与当前话题相关的历史对话）
 *
 * @module hooks/bundled/session-memory/recall
 */

import { getGatewayMemoryService } from "../../../gateway/memory-service.js";
import { DEFAULT_USER_PREFERENCES } from "../../../memory/pluggable/interfaces/profile-memory.js";
import type {
  UserFact,
  UserPreferences,
} from "../../../memory/pluggable/interfaces/profile-memory.js";
import type {
  PluginHookBeforeAgentStartEvent,
  PluginHookBeforeAgentStartResult,
  PluginHookAgentContext,
} from "../../../plugins/types.js";

/** 最小置信度阈值，低于此值的事实不会被召回 */
const MIN_CONFIDENCE = 0.5;

/** 情节搜索的最小 prompt 长度（太短的查询不值得搜索） */
const MIN_PROMPT_LENGTH_FOR_EPISODIC = 5;

/** 最多召回的情节记忆条数 */
const MAX_EPISODIC_RESULTS = 3;

/**
 * 从 sessionKey 提取用户标识
 *
 * sessionKey 本身作为多租户记忆隔离的 userId 键。
 * 这确保每个 session-channel 组合的记忆独立存储。
 *
 * @param sessionKey - 会话键（如 agent:main:webchat:user-123）
 * @returns userId 字符串，直接使用 sessionKey
 */
function resolveUserId(sessionKey: string | undefined): string | undefined {
  if (!sessionKey || sessionKey.trim().length === 0) {
    return undefined;
  }
  return sessionKey;
}

/**
 * 过滤事实：移除敏感信息和低置信度条目
 *
 * @param facts - 原始事实列表
 * @returns 过滤后的事实列表
 */
function filterFacts(facts: UserFact[]): UserFact[] {
  return facts.filter((fact) => !fact.sensitive && fact.confidence >= MIN_CONFIDENCE);
}

/**
 * 判断偏好是否为非默认值
 *
 * 只有当用户偏好与默认值不同时才注入到上下文中，
 * 避免浪费 token。
 *
 * @param prefs - 用户偏好
 * @returns 是否存在非默认偏好
 */
function hasNonDefaultPreferences(prefs: UserPreferences): boolean {
  return (
    prefs.language !== DEFAULT_USER_PREFERENCES.language ||
    prefs.timezone !== DEFAULT_USER_PREFERENCES.timezone ||
    prefs.responseStyle !== DEFAULT_USER_PREFERENCES.responseStyle ||
    prefs.confirmLevel !== DEFAULT_USER_PREFERENCES.confirmLevel ||
    prefs.thinkingLevel !== DEFAULT_USER_PREFERENCES.thinkingLevel ||
    prefs.verboseLevel !== DEFAULT_USER_PREFERENCES.verboseLevel ||
    prefs.favoriteSkills.length > 0 ||
    prefs.disabledSkills.length > 0
  );
}

/**
 * 格式化事实为可读的上下文文本
 *
 * @param facts - 过滤后的事实列表
 * @returns 格式化的事实文本
 */
function formatFacts(facts: UserFact[]): string {
  if (facts.length === 0) {
    return "";
  }

  const lines = facts.map((f) => `- ${f.key}: ${f.value} [${f.category}]`);
  return `## User Facts\n${lines.join("\n")}`;
}

/**
 * 格式化偏好为可读的上下文文本
 *
 * @param prefs - 用户偏好
 * @returns 格式化的偏好文本
 */
function formatPreferences(prefs: UserPreferences): string {
  const lines: string[] = [];

  if (prefs.language !== DEFAULT_USER_PREFERENCES.language) {
    lines.push(`- Language: ${prefs.language}`);
  }
  if (prefs.timezone !== DEFAULT_USER_PREFERENCES.timezone) {
    lines.push(`- Timezone: ${prefs.timezone}`);
  }
  if (prefs.responseStyle !== DEFAULT_USER_PREFERENCES.responseStyle) {
    lines.push(`- Response style: ${prefs.responseStyle}`);
  }
  if (prefs.verboseLevel !== DEFAULT_USER_PREFERENCES.verboseLevel) {
    lines.push(`- Verbose level: ${prefs.verboseLevel}`);
  }
  if (prefs.thinkingLevel !== DEFAULT_USER_PREFERENCES.thinkingLevel) {
    lines.push(`- Thinking level: ${prefs.thinkingLevel}`);
  }
  if (prefs.favoriteSkills.length > 0) {
    lines.push(`- Favorite skills: ${prefs.favoriteSkills.join(", ")}`);
  }

  if (lines.length === 0) {
    return "";
  }

  return `## User Preferences\n${lines.join("\n")}`;
}

/**
 * 格式化情节记忆为可读的上下文文本
 *
 * @param episodes - 搜索结果
 * @returns 格式化的情节文本
 */
function formatEpisodes(
  episodes: Array<{
    sessionId?: string;
    summary?: string;
    topics?: string[];
    score?: number;
    timestamp?: Date;
  }>,
): string {
  if (episodes.length === 0) {
    return "";
  }

  const lines = episodes.map((ep) => {
    const date = ep.timestamp ? ep.timestamp.toISOString().split("T")[0] : "unknown";
    const topics = ep.topics?.length ? ` [${ep.topics.join(", ")}]` : "";
    return `- (${date})${topics} ${ep.summary ?? "No summary"}`;
  });

  return `## Related Past Conversations\n${lines.join("\n")}`;
}

/**
 * 创建记忆召回 hook handler
 *
 * 使用工厂函数模式以便测试时可以注入依赖。
 *
 * @returns before_agent_start hook handler
 */
export function createRecallHandler(): (
  event: PluginHookBeforeAgentStartEvent,
  ctx: PluginHookAgentContext,
) => Promise<PluginHookBeforeAgentStartResult | void> {
  return async (
    event: PluginHookBeforeAgentStartEvent,
    ctx: PluginHookAgentContext,
  ): Promise<PluginHookBeforeAgentStartResult | void> => {
    // 1. 检查前置条件
    const userId = resolveUserId(ctx.sessionKey);
    if (!userId) {
      console.log("[memory-recall] 无 sessionKey，跳过记忆召回");
      return undefined;
    }

    let service: ReturnType<typeof getGatewayMemoryService>;
    try {
      service = getGatewayMemoryService();
    } catch {
      console.log("[memory-recall] 记忆服务未初始化，跳过");
      return undefined;
    }

    if (!service.isReady) {
      console.log("[memory-recall] 记忆服务不可用，跳过");
      return undefined;
    }

    try {
      const manager = service.manager;
      const sections: string[] = [];

      // 2. 并行获取画像数据
      const [rawFacts, preferences] = await Promise.all([
        manager.profile.getFacts(userId),
        manager.profile.getPreferences(userId),
      ]);

      // 3. 过滤和格式化事实
      const facts = filterFacts(rawFacts);
      const factsText = formatFacts(facts);
      if (factsText) {
        sections.push(factsText);
      }

      // 4. 格式化偏好（仅非默认值）
      if (hasNonDefaultPreferences(preferences)) {
        const prefsText = formatPreferences(preferences);
        if (prefsText) {
          sections.push(prefsText);
        }
      }

      // 5. 搜索相关情节记忆（仅当 prompt 够长时）
      if (event.prompt && event.prompt.length >= MIN_PROMPT_LENGTH_FOR_EPISODIC) {
        const episodes = await manager.episodic.searchEpisodes(userId, event.prompt, {
          limit: MAX_EPISODIC_RESULTS,
        });

        const episodesText = formatEpisodes(episodes);
        if (episodesText) {
          sections.push(episodesText);
        }
      }

      // 6. 组装 prependContext
      if (sections.length === 0) {
        console.log("[memory-recall] 无有价值的记忆数据");
        return undefined;
      }

      const prependContext = `<user-profile-memory>\n${sections.join("\n\n")}\n</user-profile-memory>`;

      console.log(
        `[memory-recall] 注入记忆上下文: ${facts.length} 事实, ` +
          `偏好=${hasNonDefaultPreferences(preferences) ? "自定义" : "默认"}, ` +
          `${sections.length} 个区块`,
      );

      return { prependContext };
    } catch (error) {
      console.error(
        "[memory-recall] 记忆召回失败:",
        error instanceof Error ? error.message : String(error),
      );
      return undefined;
    }
  };
}
