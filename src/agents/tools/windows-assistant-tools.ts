/**
 * Windows 助理工具
 *
 * 为 AI 代理提供 Windows 客户端操作能力
 * 工具通过 Gateway 调用连接的 Windows 客户端执行操作
 */

import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import { stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, jsonResult, readStringParam, readNumberParam } from "./common.js";
import { callGatewayTool, type GatewayCallOptions } from "./gateway.js";

// === 文件操作工具 ===

const FILE_ACTIONS = [
  "list",       // 列出目录内容
  "read",       // 读取文件
  "write",      // 写入文件
  "move",       // 移动/重命名
  "copy",       // 复制
  "delete",     // 删除
  "mkdir",      // 创建目录
  "exists",     // 检查是否存在
  "info",       // 获取文件信息
  "search",     // 搜索文件
] as const;

/**
 * Windows 文件操作工具 Schema
 */
const WindowsFileToolSchema = Type.Object({
  action: stringEnum(FILE_ACTIONS),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
  // 路径参数
  path: Type.Optional(Type.String({ description: "文件或目录的绝对路径" })),
  destPath: Type.Optional(Type.String({ description: "目标路径 (用于 move/copy)" })),
  // write 参数
  content: Type.Optional(Type.String({ description: "要写入的内容" })),
  // search 参数
  pattern: Type.Optional(Type.String({ description: "搜索模式 (正则表达式)" })),
  recursive: Type.Optional(Type.Boolean({ description: "是否递归搜索子目录" })),
  maxResults: Type.Optional(Type.Number({ description: "最大结果数量" })),
});

/**
 * 创建 Windows 文件操作工具
 */
export function createWindowsFileTool(options?: {
  agentSessionKey?: string;
  config?: OpenClawConfig;
}): AnyAgentTool {
  const sessionKey = options?.agentSessionKey?.trim() || undefined;
  // 为将来扩展保留 agentId 解析
  resolveSessionAgentId({
    sessionKey: options?.agentSessionKey,
    config: options?.config,
  });

  return {
    label: "Windows 文件",
    name: "windows_file",
    description: `
在 Windows 客户端上执行文件和目录操作。

支持的操作:
- list: 列出目录内容，返回文件和子目录列表
- read: 读取文本文件内容
- write: 写入内容到文件 (创建或覆盖)
- move: 移动或重命名文件/目录
- copy: 复制文件
- delete: 删除文件或目录
- mkdir: 创建目录
- exists: 检查路径是否存在
- info: 获取文件详细信息 (大小、日期等)
- search: 在目录中搜索匹配的文件

注意: 所有路径必须是 Windows 格式的绝对路径 (如 C:\\Users\\...)
    `.trim(),
    parameters: WindowsFileToolSchema,

    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });

      // 构建 Gateway 调用选项
      const gatewayOpts: GatewayCallOptions = {
        gatewayUrl: readStringParam(params, "gatewayUrl"),
        gatewayToken: readStringParam(params, "gatewayToken"),
        timeoutMs: readNumberParam(params, "timeoutMs"),
      };

      // 根据 action 调用相应的 assistant.file.* 方法
      const method = `assistant.file.${action}`;
      const path = readStringParam(params, "path");

      switch (action) {
        case "list": {
          if (!path) {
            throw new Error("list 操作需要指定 path 参数");
          }
          const result = await callGatewayTool(method, gatewayOpts, { path });
          return jsonResult(result);
        }

        case "read": {
          if (!path) {
            throw new Error("read 操作需要指定 path 参数");
          }
          const result = await callGatewayTool(method, gatewayOpts, { path });
          return jsonResult(result);
        }

        case "write": {
          if (!path) {
            throw new Error("write 操作需要指定 path 参数");
          }
          const content = readStringParam(params, "content", { required: true, allowEmpty: true });
          const result = await callGatewayTool(method, gatewayOpts, { path, content });
          return jsonResult(result);
        }

        case "move":
        case "copy": {
          if (!path) {
            throw new Error(`${action} 操作需要指定 path 参数`);
          }
          const destPath = readStringParam(params, "destPath", { required: true });
          const result = await callGatewayTool(method, gatewayOpts, {
            sourcePath: path,
            destPath,
          });
          return jsonResult(result);
        }

        case "delete":
        case "exists":
        case "info":
        case "mkdir": {
          if (!path) {
            throw new Error(`${action} 操作需要指定 path 参数`);
          }
          const result = await callGatewayTool(method, gatewayOpts, { path });
          return jsonResult(result);
        }

        case "search": {
          if (!path) {
            throw new Error("search 操作需要指定 path 参数");
          }
          const pattern = readStringParam(params, "pattern", { required: true });
          const recursive = typeof params.recursive === "boolean" ? params.recursive : true;
          const maxResults = readNumberParam(params, "maxResults") ?? 50;
          const result = await callGatewayTool(method, gatewayOpts, {
            path,
            pattern,
            recursive,
            maxResults,
          });
          return jsonResult(result);
        }

        default:
          throw new Error(`未知的文件操作: ${action}`);
      }
    },
  };
}

// === 系统监控工具 ===

const SYSTEM_ACTIONS = [
  "info",           // 系统信息
  "disk",           // 磁盘信息
  "processes",      // 进程列表
  "kill_process",   // 结束进程
  "launch",         // 启动程序
  "user_paths",     // 用户目录
] as const;

/**
 * Windows 系统监控工具 Schema
 */
const WindowsSystemToolSchema = Type.Object({
  action: stringEnum(SYSTEM_ACTIONS),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
  // kill_process 参数
  pid: Type.Optional(Type.Number({ description: "进程 ID" })),
  // launch 参数
  appPath: Type.Optional(Type.String({ description: "程序路径" })),
  args: Type.Optional(Type.Array(Type.String(), { description: "程序参数" })),
});

/**
 * 创建 Windows 系统监控工具
 */
export function createWindowsSystemTool(options?: {
  agentSessionKey?: string;
  config?: OpenClawConfig;
}): AnyAgentTool {
  const sessionKey = options?.agentSessionKey?.trim() || undefined;

  return {
    label: "Windows 系统",
    name: "windows_system",
    description: `
获取 Windows 系统信息并管理进程。

支持的操作:
- info: 获取系统信息 (CPU、内存、操作系统版本等)
- disk: 获取磁盘使用情况
- processes: 获取运行中的进程列表
- kill_process: 结束指定进程 (需要进程 ID)
- launch: 启动程序
- user_paths: 获取用户目录路径 (桌面、文档、下载等)

警告: kill_process 操作会强制结束进程，可能导致数据丢失。
    `.trim(),
    parameters: WindowsSystemToolSchema,

    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });

      // 构建 Gateway 调用选项
      const gatewayOpts: GatewayCallOptions = {
        gatewayUrl: readStringParam(params, "gatewayUrl"),
        gatewayToken: readStringParam(params, "gatewayToken"),
        timeoutMs: readNumberParam(params, "timeoutMs"),
      };

      // 根据 action 调用相应的方法
      switch (action) {
        case "info": {
          const result = await callGatewayTool("assistant.system.info", gatewayOpts, {});
          return jsonResult(result);
        }

        case "disk": {
          const result = await callGatewayTool("assistant.system.disk", gatewayOpts, {});
          return jsonResult(result);
        }

        case "processes": {
          const result = await callGatewayTool("assistant.system.processes", gatewayOpts, {});
          return jsonResult(result);
        }

        case "kill_process": {
          const pid = readNumberParam(params, "pid", { required: true });
          const result = await callGatewayTool("assistant.system.killProcess", gatewayOpts, {
            pid,
          });
          return jsonResult(result);
        }

        case "launch": {
          const appPath = readStringParam(params, "appPath", { required: true });
          const appArgs = params.args as string[] | undefined;
          const result = await callGatewayTool("assistant.system.launch", gatewayOpts, {
            appPath,
            args: appArgs,
          });
          return jsonResult(result);
        }

        case "user_paths": {
          const result = await callGatewayTool("assistant.system.userPaths", gatewayOpts, {});
          return jsonResult(result);
        }

        default:
          throw new Error(`未知的系统操作: ${action}`);
      }
    },
  };
}
