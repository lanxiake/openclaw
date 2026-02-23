/**
 * 客户端技能执行调度器测试
 *
 * 测试 Gateway → Client 的技能执行调度逻辑
 * 包括请求发送、结果回收、超时处理、无客户端场景
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClientSkillDispatcher, shouldDispatchToClient } from "./client-dispatch.js";
import type { SkillExecuteResult } from "../../gateway/protocol/skill-execution.js";

describe("shouldDispatchToClient", () => {
  it("DISPATCH-001: builtin 技能应在服务端执行", () => {
    expect(shouldDispatchToClient("builtin")).toBe(false);
  });

  it("DISPATCH-002: installed 技能应在客户端执行", () => {
    expect(shouldDispatchToClient("installed")).toBe(true);
  });

  it("DISPATCH-003: workspace 技能应在客户端执行", () => {
    expect(shouldDispatchToClient("workspace")).toBe(true);
  });

  it("DISPATCH-004: remote 技能应在客户端执行", () => {
    expect(shouldDispatchToClient("remote")).toBe(true);
  });
});

describe("ClientSkillDispatcher", () => {
  let dispatcher: ClientSkillDispatcher;

  beforeEach(() => {
    vi.useFakeTimers();
    dispatcher = new ClientSkillDispatcher();
  });

  afterEach(() => {
    dispatcher.dispose();
    vi.useRealTimers();
  });

  describe("dispatch", () => {
    it("DISPATCH-010: 无可用客户端时返回失败", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(0);

      const result = await dispatcher.dispatch({
        userId: "user-1",
        skillId: "my-skill",
        params: { path: "/tmp" },
        sendToUserClients,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("没有可用的客户端设备");
      expect(sendToUserClients).toHaveBeenCalledOnce();
      expect(sendToUserClients).toHaveBeenCalledWith(
        "user-1",
        "skill.execute.request",
        expect.objectContaining({
          skillId: "my-skill",
          runMode: "local",
          params: { path: "/tmp" },
        }),
      );
    });

    it("DISPATCH-011: 成功发送请求后等待客户端结果", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);

      // 启动 dispatch（不 await，因为它会等待结果）
      const resultPromise = dispatcher.dispatch({
        userId: "user-1",
        skillId: "my-skill",
        params: { path: "/tmp" },
        sendToUserClients,
      });

      // 确认请求已发送
      expect(sendToUserClients).toHaveBeenCalledOnce();
      expect(dispatcher.pendingCount).toBe(1);

      // 提取 requestId
      const sentPayload = sendToUserClients.mock.calls[0][2] as { requestId: string };
      const requestId = sentPayload.requestId;

      // 模拟客户端回传结果
      const clientResult: SkillExecuteResult = {
        requestId,
        success: true,
        result: { files: ["a.txt", "b.txt"], count: 2 },
        executionTimeMs: 150,
      };
      dispatcher.handleResult(clientResult);

      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ files: ["a.txt", "b.txt"], count: 2 });
      expect(dispatcher.pendingCount).toBe(0);
    });

    it("DISPATCH-012: 客户端返回错误时传递错误信息", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);

      const resultPromise = dispatcher.dispatch({
        userId: "user-1",
        skillId: "my-skill",
        params: {},
        sendToUserClients,
      });

      const sentPayload = sendToUserClients.mock.calls[0][2] as { requestId: string };

      const clientResult: SkillExecuteResult = {
        requestId: sentPayload.requestId,
        success: false,
        error: { code: "EXECUTION_ERROR", message: "文件不存在" },
        executionTimeMs: 50,
      };
      dispatcher.handleResult(clientResult);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe("文件不存在");
    });

    it("DISPATCH-013: 超时后返回超时错误", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);

      const resultPromise = dispatcher.dispatch({
        userId: "user-1",
        skillId: "my-skill",
        params: {},
        sendToUserClients,
        timeoutMs: 5000,
      });

      expect(dispatcher.pendingCount).toBe(1);

      // 快进超时
      vi.advanceTimersByTime(5001);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain("超时");
      expect(dispatcher.pendingCount).toBe(0);
    });

    it("DISPATCH-014: 请求包含正确的 requireConfirm 和 skillName", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);

      const resultPromise = dispatcher.dispatch({
        userId: "user-1",
        skillId: "dangerous-skill",
        skillName: "危险操作",
        params: { target: "/system" },
        requireConfirm: true,
        sendToUserClients,
        timeoutMs: 1000,
      });

      const sentPayload = sendToUserClients.mock.calls[0][2] as Record<string, unknown>;
      expect(sentPayload).toMatchObject({
        skillId: "dangerous-skill",
        skillName: "危险操作",
        requireConfirm: true,
        runMode: "local",
        params: { target: "/system" },
      });

      // 清理：触发超时
      vi.advanceTimersByTime(1001);
      await resultPromise;
    });

    it("DISPATCH-015: 多个并发请求互不干扰", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);

      const promise1 = dispatcher.dispatch({
        userId: "user-1",
        skillId: "skill-a",
        params: { a: 1 },
        sendToUserClients,
      });

      const promise2 = dispatcher.dispatch({
        userId: "user-1",
        skillId: "skill-b",
        params: { b: 2 },
        sendToUserClients,
      });

      expect(dispatcher.pendingCount).toBe(2);

      // 提取 requestId
      const requestId1 = (sendToUserClients.mock.calls[0][2] as { requestId: string }).requestId;
      const requestId2 = (sendToUserClients.mock.calls[1][2] as { requestId: string }).requestId;

      // 按倒序回传结果
      dispatcher.handleResult({
        requestId: requestId2,
        success: true,
        result: "result-b",
        executionTimeMs: 100,
      });

      dispatcher.handleResult({
        requestId: requestId1,
        success: true,
        result: "result-a",
        executionTimeMs: 200,
      });

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1.data).toBe("result-a");
      expect(result2.data).toBe("result-b");
      expect(dispatcher.pendingCount).toBe(0);
    });
  });

  describe("handleResult", () => {
    it("DISPATCH-020: 未知 requestId 返回 false", () => {
      const handled = dispatcher.handleResult({
        requestId: "unknown-id",
        success: true,
        executionTimeMs: 100,
      });

      expect(handled).toBe(false);
    });

    it("DISPATCH-021: 正确的 requestId 返回 true", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);

      const resultPromise = dispatcher.dispatch({
        userId: "user-1",
        skillId: "my-skill",
        params: {},
        sendToUserClients,
      });

      const sentPayload = sendToUserClients.mock.calls[0][2] as { requestId: string };
      const handled = dispatcher.handleResult({
        requestId: sentPayload.requestId,
        success: true,
        executionTimeMs: 50,
      });

      expect(handled).toBe(true);
      await resultPromise;
    });

    it("DISPATCH-022: 同一 requestId 不能重复处理", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);

      const resultPromise = dispatcher.dispatch({
        userId: "user-1",
        skillId: "my-skill",
        params: {},
        sendToUserClients,
      });

      const sentPayload = sendToUserClients.mock.calls[0][2] as { requestId: string };
      const requestId = sentPayload.requestId;

      const first = dispatcher.handleResult({
        requestId,
        success: true,
        executionTimeMs: 50,
      });
      const second = dispatcher.handleResult({
        requestId,
        success: false,
        error: { code: "EXECUTION_ERROR", message: "late" },
        executionTimeMs: 100,
      });

      expect(first).toBe(true);
      expect(second).toBe(false);
      await resultPromise;
    });
  });

  describe("dispose", () => {
    it("DISPATCH-030: dispose 清理所有等待中的请求", async () => {
      const sendToUserClients = vi.fn().mockReturnValue(1);

      const promise1 = dispatcher.dispatch({
        userId: "user-1",
        skillId: "skill-a",
        params: {},
        sendToUserClients,
      });

      const promise2 = dispatcher.dispatch({
        userId: "user-1",
        skillId: "skill-b",
        params: {},
        sendToUserClients,
      });

      expect(dispatcher.pendingCount).toBe(2);

      dispatcher.dispose();

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1.success).toBe(false);
      expect(result1.error).toContain("调度器已关闭");
      expect(result2.success).toBe(false);
      expect(dispatcher.pendingCount).toBe(0);
    });
  });
});
