/**
 * 内存情节记忆提供者
 *
 * 使用内存存储实现情节记忆，适用于开发和测试环境。
 * 数据在进程重启后会丢失。
 *
 * @module memory/pluggable/providers/episodic
 */

import { randomUUID } from "node:crypto";

import type { HealthStatus, ProviderConfig } from "../../interfaces/memory-provider.js";
import type { Message } from "../../interfaces/types.js";
import type {
  ConversationSummary,
  EpisodicQueryOptions,
  EpisodeSearchResult,
  EventQueryOptions,
  IEpisodicMemoryProvider,
  KeyEvent,
  TimelineEntry,
} from "../../interfaces/episodic-memory.js";
import { registerProvider } from "../factory.js";

  /**
   * 获取情绪趋势
   */
  async get(userId: string, startDate: Date, endDate: Date): Promise<> {
    console.log(
      `[memory-episodic] 获取情绪趋势: ${startDate.toISOString()} - ${endDate.toISOString()} (用户: ${userId})`,
    );

    const data = this.getUserData(userId);

    // 筛选时间范围内的记录
    const records = Array.from(data.emotions.values())
      .filter((r) => r.timestamp >= startDate && r.timestamp <= endDate)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (records.length === 0) {
      return {
        averageSentiment: 0,
        satisfactionTrend: [],
        frustrationTrend: [],
        timestamps: [],
      };
    }

    // 计算平均情绪
    const sentimentValues: number[] = records.map((r) => {
      switch (r.sentiment) {
        case "positive":
          return 1;
        case "neutral":
          return 0;
        case "negative":
          return -1;
      }
    });
    const averageSentiment = sentimentValues.reduce((a, b) => a + b, 0) / sentimentValues.length;

    return {
      averageSentiment,
      satisfactionTrend: records.map((r) => r.satisfaction),
      frustrationTrend: records.map((r) => r.frustration),
      timestamps: records.map((r) => r.timestamp),
    };
  }
}

// 自动注册提供者
registerProvider(
  "episodic",
  "memory",
  MemoryEpisodicMemoryProvider as unknown as new (
    options: Record<string, unknown>,
  ) => MemoryEpisodicMemoryProvider,
);
