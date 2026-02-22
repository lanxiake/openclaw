/**
 * TodoWrite 工具 - Agent 任务列表管理
 *
 * 让 AI 代理主动规划和报告任务进度。
 * 每次调用时传入完整的任务列表快照（替换模式），
 * 通过 tool 事件流广播到所有连接的客户端。
 *
 * 事件链路：
 * 1. Agent 调用 TodoWrite → pi-embedded-subscribe.handlers.tools.ts emit tool event
 * 2. server-chat.ts 拦截 TodoWrite 事件 → 持久化到 DB (agent_todos 表)
 * 3. Gateway 通过 nodeSendToSession 转发给 Windows 客户端
 * 4. useAgentTodo hook 解析事件 → AgentTodoList 组件渲染
 */

import { Type } from "@sinclair/typebox";
import { type AnyAgentTool, jsonResult } from "./common.js";
import { stringEnum } from "../schema/typebox.js";

/**
 * TodoWrite 工具 Schema
 *
 * 参数格式与 Claude Code 的 TodoWrite 工具保持一致，
 * 客户端 useAgentTodo hook 解析 args.todos 数组。
 *
 * 注意：status 字段使用 stringEnum 而非 Type.Union，
 * 避免 anyOf 导致部分 model provider 拒绝工具 schema。
 */
const TodoWriteSchema = Type.Object({
  todos: Type.Array(
    Type.Object({
      content: Type.String({ description: "任务描述 (祈使语气)" }),
      status: stringEnum(["pending", "in_progress", "completed"] as const, {
        description: "任务状态: pending=待处理, in_progress=执行中, completed=已完成",
      }),
      activeForm: Type.Optional(Type.String({ description: "执行中显示文本 (进行时态)" })),
    }),
    { description: "完整的任务列表快照（每次调用替换全部任务）" },
  ),
});

/**
 * 创建 TodoWrite 工具
 *
 * 此工具的核心作用是产生 tool 事件——执行逻辑很轻量，
 * 主要依靠 pi-agent tool handler 在 start 阶段 emit 的事件
 * 来驱动客户端渲染和 Gateway 持久化。
 */
export function createTodoWriteTool(): AnyAgentTool {
  return {
    label: "任务列表",
    name: "TodoWrite",
    description: `更新当前任务列表。每次调用传入完整的任务快照（替换模式，不是增量）。

使用场景：
- 开始处理用户请求时，规划任务列表（所有任务 status=pending）
- 开始执行某个任务时，将其 status 改为 in_progress
- 完成某个任务时，将其 status 改为 completed
- 发现新需求时，添加新任务到列表

规则：
1. 每次调用必须传入完整列表（包含所有任务，不只是变化的）
2. 同一时间只能有一个任务处于 in_progress 状态
3. 任务顺序应反映执行顺序
4. content 使用祈使语气（如"修复登录 bug"）
5. activeForm 使用进行时（如"修复登录 bug 中"），仅对 in_progress 任务有效`,
    parameters: TodoWriteSchema,

    execute: async (_toolCallId, args) => {
      const params = args as {
        todos: Array<{ content: string; status: string; activeForm?: string }>;
      };
      const { todos } = params;

      const completed = todos.filter((t) => t.status === "completed").length;
      const inProgress = todos.filter((t) => t.status === "in_progress").length;
      const pending = todos.filter((t) => t.status === "pending").length;

      return jsonResult({
        ok: true,
        summary: `${completed}/${todos.length} 完成, ${inProgress} 执行中, ${pending} 待处理`,
        totalCount: todos.length,
        completedCount: completed,
        inProgressCount: inProgress,
        pendingCount: pending,
      });
    },
  };
}
