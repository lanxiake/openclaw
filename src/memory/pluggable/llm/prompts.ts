/**
 * LLM Prompt 模板
 *
 * 为记忆系统的 LLM 调用构建结构化的 prompt。
 * 所有函数都是纯函数，不产生副作用。
 *
 * @module memory/pluggable/llm/prompts
 */

import type { Message } from "../interfaces/types.js";
import type { UserFact } from "../interfaces/profile-memory.js";

/** 消息截断限制：超过此长度的消息内容将被截断 */
const MAX_MESSAGE_LENGTH = 500;

/** 最大消息条数限制 */
const MAX_MESSAGES = 30;

// ==================== 对话摘要 ====================

/**
 * 构建对话摘要的系统 prompt
 *
 * @returns 系统 prompt 字符串
 */
export function buildSummarizationSystemPrompt(): string {
  return `你是一个对话摘要助手。你的任务是分析对话内容，生成结构化的摘要。

请严格按以下 JSON 格式输出，不要添加任何其他内容：

{
  "summary": "2-3 句话的对话摘要，概括主要内容和结论",
  "keyTopics": ["话题1", "话题2", "话题3"],
  "decisions": ["做出的决定1", "做出的决定2"]
}

要求：
- summary: 简洁概括对话的核心内容，包含关键结论
- keyTopics: 提取 3-5 个关键话题/主题词
- decisions: 提取对话中明确做出的决定或结论，如果没有则返回空数组
- 使用与对话相同的语言（中文对话用中文，英文对话用英文）
- 只输出 JSON，不要包含 markdown 代码围栏或其他文本`;
}

/**
 * 构建对话摘要的用户消息
 *
 * @param messages - 对话消息列表
 * @returns 格式化的用户消息
 */
export function buildSummarizationUserMessage(messages: Message[]): string {
  const truncated = messages.slice(-MAX_MESSAGES);
  const formatted = truncated
    .map((m) => {
      const content =
        m.content.length > MAX_MESSAGE_LENGTH
          ? `${m.content.slice(0, MAX_MESSAGE_LENGTH)}...`
          : m.content;
      return `[${m.role}]: ${content}`;
    })
    .join("\n");

  return `请分析以下对话并生成摘要：\n\n${formatted}`;
}

// ==================== 画像提取 ====================

/**
 * 构建画像提取的系统 prompt
 *
 * @param existingFacts - 用户已有的事实列表（用于避免重复提取）
 * @returns 系统 prompt 字符串
 */
export function buildProfileExtractionSystemPrompt(existingFacts: UserFact[]): string {
  const factsSection =
    existingFacts.length > 0
      ? `\n\n用户已有的事实（避免重复提取）：\n${existingFacts.map((f) => `- [${f.category}] ${f.key}: ${f.value}`).join("\n")}`
      : "";

  return `你是一个用户画像提取助手。你的任务是从对话中提取用户的个人信息、偏好和行为模式。

请严格按以下 JSON 格式输出：

{
  "newFacts": [
    {
      "content": "事实内容",
      "category": "personal|work|hobby|skill|relationship|health|finance|other",
      "key": "事实的简短标签",
      "confidence": 0.5到1.0之间的数字
    }
  ],
  "updatedFacts": [
    {
      "id": "已有事实的ID（如果是更新已有信息）",
      "content": "更新后的内容",
      "previousValue": "旧的值"
    }
  ],
  "newPatterns": [
    {
      "type": "communication|scheduling|topic_preference|tool_usage|learning|other",
      "pattern": "行为模式描述",
      "confidence": 0.3到1.0之间的数字
    }
  ]
}

要求：
- 只提取对话中明确表达的信息，不要推测
- confidence: 明确表述(如"我叫张三")给0.9，间接暗示给0.5-0.7
- 不要提取与已有事实重复的信息
- 如果用户纠正了已有事实，放入 updatedFacts
- 如果没有可提取的内容，返回空数组
- 只输出 JSON，不要包含 markdown 代码围栏或其他文本${factsSection}`;
}

/**
 * 构建画像提取的用户消息
 *
 * @param messages - 对话消息列表
 * @returns 格式化的用户消息
 */
export function buildProfileExtractionUserMessage(messages: Message[]): string {
  // 只关注用户发言（画像提取主要从用户消息中提取）
  const userMessages = messages.filter((m) => m.role === "user");
  const truncated = userMessages.slice(-MAX_MESSAGES);
  const formatted = truncated
    .map((m) => {
      const content =
        m.content.length > MAX_MESSAGE_LENGTH
          ? `${m.content.slice(0, MAX_MESSAGE_LENGTH)}...`
          : m.content;
      return content;
    })
    .join("\n---\n");

  return `请从以下用户消息中提取画像信息：\n\n${formatted}`;
}
