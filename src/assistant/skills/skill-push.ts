/**
 * 技能推送服务
 *
 * 通过 WebSocket 事件将打包好的技能推送到用户的客户端设备安装
 * 复用 ClientSkillDispatcher 的 dispatch/handleResult 模式
 */

import { randomUUID } from "node:crypto";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { SendToUserClientsFn } from "./client-dispatch.js";
import type { PackageOutput } from "./skill-packager.js";

const log = createSubsystemLogger("skill-push");

/** Gateway → Client 的安装推送事件 */
export const SKILL_INSTALL_EVENT = "skill.install.request";

/** Client → Gateway 的安装结果 RPC 方法名 */
export const SKILL_INSTALL_RESULT_METHOD = "assistant.skill.installResult";

/**
 * 推送安装请求结构
 */
export interface SkillInstallRequest {
  requestId: string;
  skillId: string;
  version: string;
  packageBase64: string;
  packageHash: string;
  manifest: PackageOutput["manifest"];
}

/**
 * 客户端回传的安装结果
 */
export interface SkillInstallResult {
  requestId: string;
  success: boolean;
  error?: string;
}

/**
 * 等待中的安装请求
 */
interface PendingInstallRequest {
  requestId: string;
  skillId: string;
  resolve: (result: { success: boolean; error?: string }) => void;
  timer: ReturnType<typeof setTimeout>;
  createdAt: number;
}

/**
 * 技能推送调度器
 *
 * 管理 Gateway → Client 的技能安装推送和结果回收
 */
export class SkillPushDispatcher {
  private pendingRequests = new Map<string, PendingInstallRequest>();

  /**
   * 将技能包推送到用户的客户端设备安装
   *
   * @param userId - 目标用户 ID
   * @param packageOutput - 打包输出
   * @param sendToUserClients - 发送事件的回调函数
   * @param timeoutMs - 超时时间（毫秒），默认 120s（留足依赖安装时间）
   * @returns 安装结果
   */
  async pushToDevice(opts: {
    userId: string;
    packageOutput: PackageOutput;
    sendToUserClients: SendToUserClientsFn;
    timeoutMs?: number;
  }): Promise<{ success: boolean; error?: string }> {
    const { userId, packageOutput, sendToUserClients, timeoutMs = 120_000 } = opts;

    const requestId = randomUUID();

    log.info("推送技能安装到客户端", {
      requestId,
      userId,
      skillId: packageOutput.manifest.id,
      packageSize: packageOutput.packageSize,
      timeoutMs,
    });

    // 构建安装请求
    const request: SkillInstallRequest = {
      requestId,
      skillId: packageOutput.manifest.id,
      version: packageOutput.manifest.version,
      packageBase64: packageOutput.packageBase64,
      packageHash: packageOutput.packageHash,
      manifest: packageOutput.manifest,
    };

    // 发送事件到客户端
    const sentCount = sendToUserClients(userId, SKILL_INSTALL_EVENT, request);

    if (sentCount === 0) {
      log.warn("没有可用的客户端接收技能安装推送", {
        requestId,
        userId,
        skillId: packageOutput.manifest.id,
      });
      return {
        success: false,
        error: "没有可用的客户端设备。请确保客户端已连接。",
      };
    }

    log.info("技能安装推送已发送", {
      requestId,
      sentCount,
      skillId: packageOutput.manifest.id,
    });

    // 等待客户端回传安装结果
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        log.warn("技能安装推送超时", {
          requestId,
          skillId: packageOutput.manifest.id,
          timeoutMs,
        });
        resolve({
          success: false,
          error: `技能安装超时 (${timeoutMs}ms)`,
        });
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        requestId,
        skillId: packageOutput.manifest.id,
        resolve,
        timer,
        createdAt: Date.now(),
      });
    });
  }

  /**
   * 处理客户端回传的安装结果
   *
   * @param result - 客户端返回的安装结果
   * @returns 是否成功匹配到等待中的请求
   */
  handleInstallResult(result: SkillInstallResult): boolean {
    const pending = this.pendingRequests.get(result.requestId);

    if (!pending) {
      log.warn("收到未知的技能安装结果", { requestId: result.requestId });
      return false;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(result.requestId);

    log.info("收到客户端技能安装结果", {
      requestId: result.requestId,
      skillId: pending.skillId,
      success: result.success,
    });

    pending.resolve({
      success: result.success,
      error: result.error,
    });

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
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.resolve({
        success: false,
        error: "推送调度器已关闭",
      });
    }
    this.pendingRequests.clear();
    log.info("SkillPushDispatcher 已清理");
  }
}
