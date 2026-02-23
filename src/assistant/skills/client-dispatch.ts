/**
 * 客户端技能执行调度器
 *
 * 负责将 local 模式技能的执行请求转发到用户的客户端设备
 * 通过 SKILL_EXECUTE_EVENT 协议与客户端通信
 */

import { randomUUID } from "node:crypto";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { SkillExecutionResult } from "./types.js";
import {
  SKILL_EXECUTE_EVENT,
  type SkillExecuteRequest,
  type SkillExecuteResult,
} from "../../gateway/protocol/skill-execution.js";

/** 日志 */
const log = createSubsystemLogger("skill-client-dispatch");

/**
 * 发送事件到用户客户端的函数签名
 *
 * 返回成功发送的客户端数量
 */
export type SendToUserClientsFn = (userId: string, event: string, payload: unknown) => number;

/**
 * 等待中的技能执行请求
 */
interface PendingSkillRequest {
  requestId: string;
  skillId: string;
  resolve: (result: SkillExecutionResult) => void;
  timer: ReturnType<typeof setTimeout>;
  createdAt: number;
}

/**
 * 客户端技能调度器
 *
 * 管理 Gateway → Client 的技能执行请求和结果回收
 */
export class ClientSkillDispatcher {
  private pendingRequests = new Map<string, PendingSkillRequest>();

  /**
   * 将技能执行请求调度到用户的客户端
   *
   * @param userId - 目标用户 ID
   * @param skillId - 技能 ID
   * @param skillName - 技能名称（用于显示）
   * @param params - 技能执行参数
   * @param sendToUserClients - 发送事件的回调函数
   * @param timeoutMs - 超时时间（毫秒）
   * @returns 技能执行结果
   */
  async dispatch(opts: {
    userId: string;
    skillId: string;
    skillName?: string;
    params: Record<string, unknown>;
    requireConfirm?: boolean;
    sendToUserClients: SendToUserClientsFn;
    timeoutMs?: number;
  }): Promise<SkillExecutionResult> {
    const {
      userId,
      skillId,
      skillName,
      params,
      requireConfirm = false,
      sendToUserClients,
      timeoutMs = 120_000,
    } = opts;

    const requestId = randomUUID();

    log.info("调度技能执行到客户端", {
      requestId,
      userId,
      skillId,
      timeoutMs,
    });

    // 构建执行请求
    const request: SkillExecuteRequest = {
      requestId,
      skillId,
      skillName,
      params,
      requireConfirm,
      timeoutMs,
      runMode: "local",
    };

    // 发送事件到客户端
    const sentCount = sendToUserClients(userId, SKILL_EXECUTE_EVENT, request);

    if (sentCount === 0) {
      log.warn("没有可用的客户端接收技能执行请求", {
        requestId,
        userId,
        skillId,
      });
      return {
        success: false,
        error: "没有可用的客户端设备。请确保客户端已连接并支持本地技能执行。",
      };
    }

    log.info("技能执行请求已发送到客户端", {
      requestId,
      sentCount,
    });

    // 等待客户端回传结果
    return new Promise<SkillExecutionResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        log.warn("客户端技能执行超时", { requestId, skillId, timeoutMs });
        resolve({
          success: false,
          error: `客户端技能执行超时 (${timeoutMs}ms)`,
        });
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        requestId,
        skillId,
        resolve,
        timer,
        createdAt: Date.now(),
      });
    });
  }

  /**
   * 处理客户端回传的技能执行结果
   *
   * @param result - 客户端返回的执行结果
   * @returns 是否成功匹配到等待中的请求
   */
  handleResult(result: SkillExecuteResult): boolean {
    const pending = this.pendingRequests.get(result.requestId);

    if (!pending) {
      log.warn("收到未知的技能执行结果", {
        requestId: result.requestId,
      });
      return false;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(result.requestId);

    log.info("收到客户端技能执行结果", {
      requestId: result.requestId,
      skillId: pending.skillId,
      success: result.success,
      executionTimeMs: result.executionTimeMs,
    });

    // 转换为 SkillExecutionResult 格式
    const executionResult: SkillExecutionResult = {
      success: result.success,
      data: result.result,
      error: result.error?.message,
    };

    pending.resolve(executionResult);
    return true;
  }

  /**
   * 获取等待中的请求数量
   */
  get pendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * 清理所有等待中的请求
   */
  dispose(): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.resolve({
        success: false,
        error: "调度器已关闭",
      });
    }
    this.pendingRequests.clear();
    log.info("ClientSkillDispatcher 已清理");
  }
}

/**
 * 判断技能是否应该在客户端执行
 *
 * 规则：
 * - origin === "builtin" → 服务端执行
 * - 其他 (installed/workspace/remote) → 客户端执行
 *
 * @param origin - 技能来源类型
 * @returns true 表示应该在客户端执行
 */
export function shouldDispatchToClient(
  origin: "builtin" | "installed" | "workspace" | "remote",
): boolean {
  return origin !== "builtin";
}
