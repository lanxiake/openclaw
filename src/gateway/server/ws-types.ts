import type { WebSocket } from "ws";

import type { ConnectParams } from "../protocol/index.js";
import type { AuthenticatedUser } from "../user-context.js";

/**
 * WebSocket 客户端连接信息
 */
export type GatewayWsClient = {
  socket: WebSocket;
  connect: ConnectParams;
  connId: string;
  presenceKey?: string;
  /** 已认证的用户信息 (多租户模式) */
  authenticatedUser?: AuthenticatedUser;
  /** 客户端能力声明 */
  capabilities?: {
    /** 支持本地技能执行 */
    localSkillExecution?: boolean;
    /** 支持文件操作 */
    fileOperations?: boolean;
    /** 支持系统命令 */
    systemCommands?: boolean;
  };
};
