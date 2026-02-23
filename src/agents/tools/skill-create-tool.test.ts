/**
 * skill_create Agent 工具测试
 *
 * 测试 Agent 通过 skill_create 工具创建、列出、查看、执行技能
 * 工具通过 callGatewayTool 调用 Gateway RPC 方法
 */

import { describe, expect, it, vi } from "vitest";

// Mock callGatewayTool 以拦截 Gateway RPC 调用
vi.mock("./gateway.js", () => ({
  callGatewayTool: vi.fn(),
  DEFAULT_GATEWAY_URL: "ws://127.0.0.1:18789",
  resolveGatewayOptions: vi.fn().mockReturnValue({
    url: undefined,
    token: undefined,
    timeoutMs: 10_000,
  }),
}));

import { callGatewayTool } from "./gateway.js";
import { createSkillCreateTool } from "./skill-create-tool.js";

const mockCallGateway = vi.mocked(callGatewayTool);

describe("skill_create tool", () => {
  const tool = createSkillCreateTool();

  /** 工具执行辅助 */
  async function executeTool(params: Record<string, unknown>) {
    return tool.execute("test-call-id", params);
  }

  describe("create action", () => {
    it("SC-001: 缺少 name 时返回错误", async () => {
      const result = await executeTool({
        action: "create",
        language: "typescript",
        code: "console.log('hello')",
      });

      const text = JSON.stringify(result);
      expect(text).toContain("name");
    });

    it("SC-002: 缺少 code 时返回错误", async () => {
      const result = await executeTool({
        action: "create",
        name: "test-skill",
        language: "typescript",
      });

      const text = JSON.stringify(result);
      expect(text).toContain("code");
    });

    it("SC-003: 缺少 language 时返回错误", async () => {
      const result = await executeTool({
        action: "create",
        name: "test-skill",
        code: "console.log('hello')",
      });

      const text = JSON.stringify(result);
      expect(text).toContain("language");
    });

    it("SC-004: 参数完整时调用正确的 Gateway RPC", async () => {
      mockCallGateway.mockResolvedValueOnce({
        success: true,
        skillId: "new-skill-123",
        message: "技能已创建并推送到设备",
      });

      const result = await executeTool({
        action: "create",
        name: "auto-archive",
        description: "自动归档下载文件",
        language: "typescript",
        code: `const fs = require('fs'); console.log('archiving...');`,
        triggers: [
          { type: "command", command: "archive" },
          { type: "schedule", cron: "0 9 * * *" },
        ],
        permissions: {
          fileSystem: {
            read: ["~/Downloads/**"],
            write: ["~/Downloads/Archive/**"],
          },
        },
      });

      expect(mockCallGateway).toHaveBeenCalledWith(
        "assistant.skills.createAndPush",
        expect.anything(),
        expect.objectContaining({
          name: "auto-archive",
          description: "自动归档下载文件",
          language: "typescript",
          code: expect.any(String),
        }),
      );

      const text = JSON.stringify(result);
      expect(text).toContain("success");
    });
  });

  describe("list action", () => {
    it("SC-005: 调用 assistant.skills.list", async () => {
      mockCallGateway.mockResolvedValueOnce({
        skills: [{ id: "skill-1", name: "Test" }],
        total: 1,
      });

      await executeTool({ action: "list" });

      expect(mockCallGateway).toHaveBeenCalledWith(
        "assistant.skills.list",
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe("detail action", () => {
    it("SC-006: 缺少 skillId 时返回错误", async () => {
      const result = await executeTool({ action: "detail" });

      const text = JSON.stringify(result);
      expect(text).toContain("skillId");
    });

    it("SC-006b: 有 skillId 时调用 assistant.skills.get", async () => {
      mockCallGateway.mockResolvedValueOnce({
        id: "my-skill",
        name: "My Skill",
        status: "loaded",
      });

      await executeTool({ action: "detail", skillId: "my-skill" });

      expect(mockCallGateway).toHaveBeenCalledWith(
        "assistant.skills.get",
        expect.anything(),
        expect.objectContaining({ skillId: "my-skill" }),
      );
    });
  });

  describe("execute action", () => {
    it("SC-007: 调用 assistant.skills.execute", async () => {
      mockCallGateway.mockResolvedValueOnce({
        success: true,
        data: { result: "done" },
      });

      await executeTool({
        action: "execute",
        skillId: "my-skill",
        params: { key: "value" },
      });

      expect(mockCallGateway).toHaveBeenCalledWith(
        "assistant.skills.execute",
        expect.anything(),
        expect.objectContaining({
          skillId: "my-skill",
          params: { key: "value" },
        }),
      );
    });
  });

  describe("unknown action", () => {
    it("SC-008: 未知 action 抛出错误", async () => {
      await expect(executeTool({ action: "unknown_action" })).rejects.toThrow();
    });
  });
});
