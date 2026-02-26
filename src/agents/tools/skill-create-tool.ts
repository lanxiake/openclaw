/**
 * skill_create Agent 工具
 *
 * 让 Agent 能够创建技能代码并推送到客户端设备安装
 * 支持创建、列出、查看详情、手动执行等操作
 *
 * 遵循现有工具模式（参考 nodes-tool.ts, cron-tool.ts）：
 * - 扁平化 TypeBox Schema（无 anyOf/oneOf）
 * - callGatewayTool() 调用 Gateway RPC
 * - jsonResult() 返回结果
 */

import { Type } from "@sinclair/typebox";
import type { MtBotConfig } from "../../config/config.js";
import { optionalStringEnum, stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";
import { callGatewayTool, type GatewayCallOptions } from "./gateway.js";

/** 工具支持的操作 */
const SKILL_CREATE_ACTIONS = ["create", "list", "detail", "execute"] as const;

/** 技能语言选项 */
const SKILL_LANGUAGES = ["typescript", "python", "shell"] as const;

/** 触发类型选项 */
const TRIGGER_TYPES = ["command", "schedule", "event"] as const;

/**
 * 工具参数 Schema（扁平化，运行时按 action 验证）
 */
const SkillCreateToolSchema = Type.Object({
  action: stringEnum(SKILL_CREATE_ACTIONS),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
  // create action 参数
  name: Type.Optional(Type.String({ description: "技能名称（create 必填）" })),
  description: Type.Optional(Type.String({ description: "技能描述" })),
  language: optionalStringEnum(SKILL_LANGUAGES, { description: "代码语言（create 必填）" }),
  code: Type.Optional(Type.String({ description: "技能代码（create 必填）" })),
  triggers: Type.Optional(
    Type.Array(
      Type.Object({
        type: stringEnum(TRIGGER_TYPES),
        command: Type.Optional(Type.String()),
        cron: Type.Optional(Type.String()),
        event: Type.Optional(Type.String()),
      }),
    ),
  ),
  permissions: Type.Optional(
    Type.Object({
      fileSystem: Type.Optional(
        Type.Object({
          read: Type.Optional(Type.Array(Type.String())),
          write: Type.Optional(Type.Array(Type.String())),
        }),
      ),
      network: Type.Optional(
        Type.Object({
          allowedHosts: Type.Optional(Type.Array(Type.String())),
        }),
      ),
    }),
  ),
  // list/detail/execute action 参数
  skillId: Type.Optional(Type.String({ description: "技能 ID（detail/execute 必填）" })),
  params: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

/**
 * 创建 skill_create Agent 工具
 *
 * @param options - 工具配置
 * @returns Agent 工具定义
 */
export function createSkillCreateTool(options?: {
  agentSessionKey?: string;
  config?: MtBotConfig;
}): AnyAgentTool {
  return {
    label: "Skill Create",
    name: "skill_create",
    description: `创建和管理用户自定义技能。支持以下操作：
- create: 根据需求生成技能代码，打包并推送到用户设备执行（所有用户技能都在客户端本地执行）
- list: 列出用户已安装的技能
- detail: 查看技能详情
- execute: 手动执行指定技能`,
    parameters: SkillCreateToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const gatewayOpts: GatewayCallOptions = {
        gatewayUrl: readStringParam(params, "gatewayUrl", { trim: false }),
        gatewayToken: readStringParam(params, "gatewayToken", { trim: false }),
        timeoutMs: typeof params.timeoutMs === "number" ? params.timeoutMs : undefined,
      };

      switch (action) {
        case "create":
          return handleCreate(params, gatewayOpts);
        case "list":
          return handleList(gatewayOpts);
        case "detail":
          return handleDetail(params, gatewayOpts);
        case "execute":
          return handleExecute(params, gatewayOpts);
        default:
          throw new Error(`未知的 action: ${action}`);
      }
    },
  };
}

/**
 * 处理 create 操作：创建技能并推送到设备
 *
 * 验证必填参数后调用 assistant.skills.createAndPush RPC
 */
async function handleCreate(params: Record<string, unknown>, gatewayOpts: GatewayCallOptions) {
  const name = readStringParam(params, "name");
  if (!name) {
    return jsonResult({ error: "name 是必填参数：请提供技能名称" });
  }

  const code = readStringParam(params, "code");
  if (!code) {
    return jsonResult({ error: "code 是必填参数：请提供技能代码" });
  }

  const language = readStringParam(params, "language");
  if (!language) {
    return jsonResult({ error: "language 是必填参数：请选择 typescript / python / shell" });
  }

  const description = readStringParam(params, "description") || "";
  const triggers = Array.isArray(params.triggers) ? params.triggers : [];
  const permissions =
    params.permissions && typeof params.permissions === "object" ? params.permissions : {};

  const result = await callGatewayTool("assistant.skills.createAndPush", gatewayOpts, {
    name,
    description,
    language,
    code,
    triggers,
    permissions,
  });

  return jsonResult(result);
}

/**
 * 处理 list 操作：列出用户已安装的技能
 */
async function handleList(gatewayOpts: GatewayCallOptions) {
  const result = await callGatewayTool("assistant.skills.list", gatewayOpts, {});
  return jsonResult(result);
}

/**
 * 处理 detail 操作：查看技能详情
 */
async function handleDetail(params: Record<string, unknown>, gatewayOpts: GatewayCallOptions) {
  const skillId = readStringParam(params, "skillId");
  if (!skillId) {
    return jsonResult({ error: "skillId 是必填参数：请提供技能 ID" });
  }

  const result = await callGatewayTool("assistant.skills.get", gatewayOpts, { skillId });
  return jsonResult(result);
}

/**
 * 处理 execute 操作：手动执行技能
 */
async function handleExecute(params: Record<string, unknown>, gatewayOpts: GatewayCallOptions) {
  const skillId = readStringParam(params, "skillId");
  if (!skillId) {
    return jsonResult({ error: "skillId 是必填参数：请提供技能 ID" });
  }

  const execParams =
    params.params && typeof params.params === "object"
      ? (params.params as Record<string, unknown>)
      : {};

  const result = await callGatewayTool("assistant.skills.execute", gatewayOpts, {
    skillId,
    params: execParams,
  });
  return jsonResult(result);
}
