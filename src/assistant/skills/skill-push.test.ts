/**
 * 技能推送服务测试
 *
 * 测试将打包好的技能推送到客户端设备安装
 * 包括推送成功、无客户端、安装失败、超时等场景
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PackageOutput } from "./skill-packager.js";
import { SKILL_INSTALL_EVENT, SkillPushDispatcher } from "./skill-push.js";
import type { SkillInstallResult } from "./skill-push.js";

describe("SkillPushDispatcher", () => {
  let dispatcher: SkillPushDispatcher;

  beforeEach(() => {
    vi.useFakeTimers();
    dispatcher = new SkillPushDispatcher();
  });

  afterEach(() => {
    dispatcher.dispose();
    vi.useRealTimers();
  });

  /**
   * 创建一个模拟的 PackageOutput
   */
  function createMockPackage(overrides?: Partial<PackageOutput>): PackageOutput {
    return {
      packageBase64: "dGVzdA==",
      packageHash: "a".repeat(64),
      packageSize: 100,
      manifest: {
        id: "test-skill",
        name: "Test Skill",
        version: "1.0.0",
        entry: "index.ts",
        runtime: "typescript",
      },
      ...overrides,
    };
  }

  describe("pushToDevice", () => {
    it("PUSH-001: 成功推送并等待客户端回传结果", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);
      const pkg = createMockPackage();

      const resultPromise = dispatcher.pushToDevice({
        userId: "user-1",
        packageOutput: pkg,
        sendToUserClients,
      });

      // 确认事件已发送
      expect(sendToUserClients).toHaveBeenCalledOnce();
      expect(sendToUserClients).toHaveBeenCalledWith(
        "user-1",
        SKILL_INSTALL_EVENT,
        expect.objectContaining({
          skillId: "test-skill",
          version: "1.0.0",
          packageBase64: "dGVzdA==",
          packageHash: "a".repeat(64),
        }),
      );

      // 提取 requestId
      const sentPayload = sendToUserClients.mock.calls[0][2] as { requestId: string };

      // 模拟客户端回传安装成功
      const installResult: SkillInstallResult = {
        requestId: sentPayload.requestId,
        success: true,
      };
      dispatcher.handleInstallResult(installResult);

      const result = await resultPromise;
      expect(result.success).toBe(true);
    });

    it("PUSH-002: 无客户端时返回失败", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(0);
      const pkg = createMockPackage();

      const result = await dispatcher.pushToDevice({
        userId: "user-1",
        packageOutput: pkg,
        sendToUserClients,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("没有可用的客户端");
    });

    it("PUSH-003: 客户端安装失败时传递错误", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);
      const pkg = createMockPackage();

      const resultPromise = dispatcher.pushToDevice({
        userId: "user-1",
        packageOutput: pkg,
        sendToUserClients,
      });

      const sentPayload = sendToUserClients.mock.calls[0][2] as { requestId: string };

      // 模拟客户端安装失败
      dispatcher.handleInstallResult({
        requestId: sentPayload.requestId,
        success: false,
        error: "磁盘空间不足",
      });

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe("磁盘空间不足");
    });

    it("PUSH-004: 推送超时返回超时错误", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);
      const pkg = createMockPackage();

      const resultPromise = dispatcher.pushToDevice({
        userId: "user-1",
        packageOutput: pkg,
        sendToUserClients,
        timeoutMs: 5000,
      });

      // 快进超时
      vi.advanceTimersByTime(5001);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain("超时");
    });

    it("PUSH-005: requestId 正确匹配", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);
      const pkg = createMockPackage();

      const resultPromise = dispatcher.pushToDevice({
        userId: "user-1",
        packageOutput: pkg,
        sendToUserClients,
      });

      // 未知 requestId 不应处理
      const unknownHandled = dispatcher.handleInstallResult({
        requestId: "unknown-id",
        success: true,
      });
      expect(unknownHandled).toBe(false);

      // 正确 requestId 处理
      const sentPayload = sendToUserClients.mock.calls[0][2] as { requestId: string };
      const handled = dispatcher.handleInstallResult({
        requestId: sentPayload.requestId,
        success: true,
      });
      expect(handled).toBe(true);

      await resultPromise;
    });

    it("PUSH-006: 多次推送互不干扰", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);
      const pkg1 = createMockPackage({
        manifest: { ...createMockPackage().manifest, id: "skill-a" },
      });
      const pkg2 = createMockPackage({
        manifest: { ...createMockPackage().manifest, id: "skill-b" },
      });

      const promise1 = dispatcher.pushToDevice({
        userId: "user-1",
        packageOutput: pkg1,
        sendToUserClients,
      });
      const promise2 = dispatcher.pushToDevice({
        userId: "user-1",
        packageOutput: pkg2,
        sendToUserClients,
      });

      expect(dispatcher.pendingCount).toBe(2);

      const requestId1 = (sendToUserClients.mock.calls[0][2] as { requestId: string }).requestId;
      const requestId2 = (sendToUserClients.mock.calls[1][2] as { requestId: string }).requestId;

      // 按倒序回传
      dispatcher.handleInstallResult({ requestId: requestId2, success: true });
      dispatcher.handleInstallResult({ requestId: requestId1, success: false, error: "fail" });

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1.success).toBe(false);
      expect(result1.error).toBe("fail");
      expect(result2.success).toBe(true);
      expect(dispatcher.pendingCount).toBe(0);
    });
  });
});
