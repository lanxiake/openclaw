/**
 * 记忆系统 Hook 注册模块
 *
 * 将记忆系统的 recall（before_agent_start）和 capture（agent_end）
 * hooks 注册到插件系统的 typed hook registry 中。
 *
 * 注册时机：在 Gateway 启动后，插件系统和记忆服务都就绪后调用。
 *
 * @module hooks/bundled/session-memory/register
 */

import { getGlobalPluginRegistry } from "../../../plugins/hook-runner-global.js";
import type { PluginHookRegistration } from "../../../plugins/types.js";
import { createRecallHandler } from "./recall.js";
import { createCaptureHandler } from "./capture.js";

/** 插件标识（用于日志和 hook 追踪） */
const PLUGIN_ID = "memory-hooks";
const PLUGIN_SOURCE = "bundled:session-memory";

/**
 * 注册记忆系统的 typed hooks
 *
 * 将 recall 和 capture handlers 注册到全局 plugin registry 中。
 * 注册的 hooks 会在 Agent 生命周期中被 HookRunner 自动调用：
 * - before_agent_start: 召回用户记忆注入上下文
 * - agent_end: 捕获对话保存到记忆
 *
 * @returns 注册的 hook 数量（成功时为 2，失败时为 0）
 */
export function registerMemoryHooks(): number {
  const registry = getGlobalPluginRegistry();
  if (!registry) {
    console.log("[memory-hooks] 插件 registry 未初始化，跳过 hook 注册");
    return 0;
  }

  // 检查是否已注册（避免重复注册）
  const existingCount = registry.typedHooks.filter((h) => h.pluginId === PLUGIN_ID).length;

  if (existingCount > 0) {
    console.log(`[memory-hooks] 已注册 ${existingCount} 个 hooks，跳过重复注册`);
    return existingCount;
  }

  // 注册 before_agent_start hook (recall)
  const recallHook: PluginHookRegistration<"before_agent_start"> = {
    pluginId: PLUGIN_ID,
    hookName: "before_agent_start",
    handler: createRecallHandler(),
    priority: 10, // 低于用户插件的默认优先级，允许覆盖
    source: PLUGIN_SOURCE,
  };

  // 注册 agent_end hook (capture)
  const captureHook: PluginHookRegistration<"agent_end"> = {
    pluginId: PLUGIN_ID,
    hookName: "agent_end",
    handler: createCaptureHandler(),
    priority: 10,
    source: PLUGIN_SOURCE,
  };

  registry.typedHooks.push(recallHook as any, captureHook as any);

  console.log("[memory-hooks] 注册完成: before_agent_start (recall) + agent_end (capture)");
  return 2;
}
