/**
 * config-merger 单元测试
 *
 * 测试 mergeFileAndDbConfigs 函数的各种合并场景
 */

import { describe, expect, it } from "vitest";

import type { OpenClawConfig } from "../config/types.openclaw.js";

import { mergeFileAndDbConfigs, type DatabaseConfigs } from "./config-merger.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 创建一个空的 DatabaseConfigs (数据库无数据) */
function emptyDbConfigs(): DatabaseConfigs {
  return {
    gatewayConfig: null,
    modelProviders: [],
    agentConfig: null,
    systemConfigs: {},
  };
}

/** 创建一个最小化的文件配置 */
function baseFileConfig(): OpenClawConfig {
  return {
    gateway: {
      port: 18789,
      mode: "local",
      bind: "loopback",
      auth: { mode: "none" },
      controlUi: { enabled: true },
    },
    models: {
      mode: "merge",
      providers: {
        anthropic: {
          baseUrl: "https://api.anthropic.com",
          apiKey: "file-key-anthropic",
          models: [
            {
              id: "claude-opus-4-5",
              name: "Claude Opus 4.5",
              reasoning: true,
              input: ["text", "image"],
              cost: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
              contextWindow: 200000,
              maxTokens: 32000,
            },
          ],
        },
      },
    },
    logging: { level: "info" },
    session: { autoExpireTimeoutMinutes: 30 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mergeFileAndDbConfigs", () => {
  // =========================================================================
  // 1. 数据库为空 — 回退到文件配置
  // =========================================================================
  describe("数据库无数据时保留文件配置", () => {
    it("应返回与文件配置相同的结果", () => {
      const fileConfig = baseFileConfig();
      const result = mergeFileAndDbConfigs(fileConfig, emptyDbConfigs());

      expect(result.gateway?.port).toBe(18789);
      expect(result.gateway?.auth?.mode).toBe("none");
      expect(result.models?.providers?.anthropic?.apiKey).toBe("file-key-anthropic");
      expect(result.logging).toEqual({ level: "info" });
    });

    it("不应改变原始文件配置对象（不可变性）", () => {
      const fileConfig = baseFileConfig();
      const original = JSON.parse(JSON.stringify(fileConfig));
      mergeFileAndDbConfigs(fileConfig, emptyDbConfigs());

      expect(fileConfig).toEqual(original);
    });
  });

  // =========================================================================
  // 2. Gateway 配置合并
  // =========================================================================
  describe("gateway 配置合并", () => {
    it("数据库的标量字段覆盖文件配置", () => {
      const fileConfig = baseFileConfig();
      const dbConfigs = emptyDbConfigs();
      dbConfigs.gatewayConfig = {
        id: "gw-1",
        configType: "system",
        userId: null,
        gatewayMode: "local",
        gatewayPort: 9999,
        gatewayBind: "lan",
        authMode: "token",
        authToken: "db-token-123",
        authPassword: null,
        authAllowTailscale: false,
        controlUiEnabled: true,
        controlUiAllowInsecureAuth: false,
        tailscaleMode: "off",
        tailscaleResetOnExit: false,
        extraConfig: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      expect(result.gateway?.port).toBe(9999);
      expect(result.gateway?.bind).toBe("lan");
      expect(result.gateway?.auth?.mode).toBe("token");
      expect(result.gateway?.auth?.token).toBe("db-token-123");
    });

    it("extraConfig JSONB 深度合并到 gateway 子段", () => {
      const fileConfig = baseFileConfig();
      fileConfig.gateway!.tls = { enabled: false };

      const dbConfigs = emptyDbConfigs();
      dbConfigs.gatewayConfig = {
        id: "gw-1",
        configType: "system",
        userId: null,
        gatewayMode: "local",
        gatewayPort: 18789,
        gatewayBind: "loopback",
        authMode: "none",
        authToken: null,
        authPassword: null,
        authAllowTailscale: false,
        controlUiEnabled: true,
        controlUiAllowInsecureAuth: false,
        tailscaleMode: "off",
        tailscaleResetOnExit: false,
        extraConfig: {
          tls: { enabled: true, certPath: "/etc/ssl/cert.pem" },
          http: { endpoints: { chatCompletions: { enabled: true } } },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      expect(result.gateway?.tls?.enabled).toBe(true);
      expect(result.gateway?.tls?.certPath).toBe("/etc/ssl/cert.pem");
      expect(result.gateway?.http?.endpoints?.chatCompletions?.enabled).toBe(true);
    });

    it("数据库字段为默认值时仍生效（显式设置 0/false）", () => {
      const fileConfig = baseFileConfig();
      const dbConfigs = emptyDbConfigs();
      dbConfigs.gatewayConfig = {
        id: "gw-1",
        configType: "system",
        userId: null,
        gatewayMode: "local",
        gatewayPort: 0,
        gatewayBind: "loopback",
        authMode: "none",
        authToken: null,
        authPassword: null,
        authAllowTailscale: false,
        controlUiEnabled: false,
        controlUiAllowInsecureAuth: false,
        tailscaleMode: "off",
        tailscaleResetOnExit: false,
        extraConfig: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      // port = 0 应该被忽略（无效端口），保留文件值
      // 但 controlUiEnabled = false 是合法值，应该覆盖
      expect(result.gateway?.controlUi?.enabled).toBe(false);
    });
  });

  // =========================================================================
  // 3. Model Providers 合并
  // =========================================================================
  describe("model providers 合并", () => {
    it("数据库的 provider 按 key 覆盖文件的同名 provider", () => {
      const fileConfig = baseFileConfig();
      const dbConfigs = emptyDbConfigs();
      dbConfigs.modelProviders = [
        {
          id: "mp-1",
          configType: "system",
          userId: null,
          providerKey: "anthropic",
          providerName: "Anthropic (DB)",
          baseUrl: "https://api.anthropic.com/v1",
          apiKey: "db-key-anthropic",
          apiType: "openai-completions",
          models: [{ id: "claude-opus-4-5", name: "Claude Opus 4.5" }],
          enabled: true,
          priority: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ];

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      // 数据库的 anthropic 覆盖文件的 anthropic
      expect(result.models?.providers?.anthropic?.apiKey).toBe("db-key-anthropic");
      expect(result.models?.providers?.anthropic?.baseUrl).toBe("https://api.anthropic.com/v1");
    });

    it("数据库新增 provider 保留在合并结果中", () => {
      const fileConfig = baseFileConfig();
      const dbConfigs = emptyDbConfigs();
      dbConfigs.modelProviders = [
        {
          id: "mp-2",
          configType: "system",
          userId: null,
          providerKey: "openai",
          providerName: "OpenAI (DB)",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "db-key-openai",
          apiType: "openai-completions",
          models: [{ id: "gpt-4", name: "GPT-4" }],
          enabled: true,
          priority: 200,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ];

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      // 文件的 anthropic 保留
      expect(result.models?.providers?.anthropic?.apiKey).toBe("file-key-anthropic");
      // 数据库的 openai 新增
      expect(result.models?.providers?.openai?.apiKey).toBe("db-key-openai");
    });

    it("空 providers 列表不影响文件配置", () => {
      const fileConfig = baseFileConfig();
      const dbConfigs = emptyDbConfigs();

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      expect(result.models?.providers?.anthropic?.apiKey).toBe("file-key-anthropic");
    });
  });

  // =========================================================================
  // 4. Agent 默认配置合并
  // =========================================================================
  describe("agent 默认配置合并", () => {
    it("数据库的非 null 字段覆盖文件的 agent defaults", () => {
      const fileConfig = baseFileConfig();
      fileConfig.agents = {
        defaults: {
          model: "claude-opus-4-5",
          workspace: "~/openclaw-workspace",
        },
      };

      const dbConfigs = emptyDbConfigs();
      dbConfigs.agentConfig = {
        id: "ac-1",
        configType: "system",
        userId: null,
        primaryModel: "claude-sonnet-4-20250514",
        workspacePath: null,
        compactionMode: "aggressive",
        maxConcurrent: 8,
        subagentsMaxConcurrent: 16,
        extraConfig: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      expect(result.agents?.defaults?.model).toBe("claude-sonnet-4-20250514");
      // workspace 保留文件值（数据库 workspacePath 为 null）
      expect(result.agents?.defaults?.workspace).toBe("~/openclaw-workspace");
    });

    it("agentConfig 为 null 时保留文件配置", () => {
      const fileConfig = baseFileConfig();
      fileConfig.agents = {
        defaults: { model: "claude-opus-4-5" },
      };

      const dbConfigs = emptyDbConfigs();

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      expect(result.agents?.defaults?.model).toBe("claude-opus-4-5");
    });

    it("extraConfig 深度合并到 agents.defaults", () => {
      const fileConfig = baseFileConfig();
      fileConfig.agents = {
        defaults: {
          model: "claude-opus-4-5",
          sandbox: { enabled: true },
        },
      };

      const dbConfigs = emptyDbConfigs();
      dbConfigs.agentConfig = {
        id: "ac-1",
        configType: "system",
        userId: null,
        primaryModel: null,
        workspacePath: null,
        compactionMode: null,
        maxConcurrent: null,
        subagentsMaxConcurrent: null,
        extraConfig: {
          sandbox: { allowNetworkAccess: false },
          heartbeat: { enabled: true },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      // 文件的 sandbox.enabled 保留
      expect(result.agents?.defaults?.sandbox?.enabled).toBe(true);
      // 数据库的扩展字段合入
      expect((result.agents?.defaults as Record<string, unknown>)?.heartbeat).toEqual({
        enabled: true,
      });
    });
  });

  // =========================================================================
  // 5. System Configs (KV) 合并
  // =========================================================================
  describe("system_configs KV 合并", () => {
    it("数据库 KV 覆盖文件的对应配置段", () => {
      const fileConfig = baseFileConfig();
      const dbConfigs = emptyDbConfigs();
      dbConfigs.systemConfigs = {
        logging: { level: "debug", format: "json" },
      };

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      expect(result.logging).toEqual({ level: "debug", format: "json" });
    });

    it("数据库 KV 深度合并（不丢失文件中的兄弟字段）", () => {
      const fileConfig = baseFileConfig();
      fileConfig.session = {
        autoExpireTimeoutMinutes: 30,
      } as OpenClawConfig["session"];

      const dbConfigs = emptyDbConfigs();
      dbConfigs.systemConfigs = {
        session: { compactionMode: "aggressive" },
      };

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      // 文件的 autoExpireTimeoutMinutes 保留
      expect((result.session as Record<string, unknown>)?.autoExpireTimeoutMinutes).toBe(30);
      // 数据库的 compactionMode 新增
      expect((result.session as Record<string, unknown>)?.compactionMode).toBe("aggressive");
    });

    it("多个 KV 段同时合并", () => {
      const fileConfig = baseFileConfig();
      fileConfig.ui = { seamColor: "#ff0000" };

      const dbConfigs = emptyDbConfigs();
      dbConfigs.systemConfigs = {
        logging: { level: "warn" },
        ui: { seamColor: "#00ff00", assistant: { name: "Pi" } },
        tools: { allowlist: ["shell"] },
      };

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      expect(result.logging).toEqual({ level: "warn" });
      expect(result.ui?.seamColor).toBe("#00ff00");
      expect(result.ui?.assistant?.name).toBe("Pi");
      expect((result.tools as Record<string, unknown>)?.allowlist).toEqual(["shell"]);
    });

    it("空的 systemConfigs 不影响文件配置", () => {
      const fileConfig = baseFileConfig();
      const dbConfigs = emptyDbConfigs();

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      expect(result.logging).toEqual({ level: "info" });
    });
  });

  // =========================================================================
  // 6. 综合场景
  // =========================================================================
  describe("多维度同时合并", () => {
    it("gateway + providers + agent + KV 全部合并", () => {
      const fileConfig = baseFileConfig();
      fileConfig.agents = { defaults: { model: "claude-opus-4-5" } };

      const dbConfigs: DatabaseConfigs = {
        gatewayConfig: {
          id: "gw-1",
          configType: "system",
          userId: null,
          gatewayMode: "local",
          gatewayPort: 8080,
          gatewayBind: "lan",
          authMode: "password",
          authToken: null,
          authPassword: "secret",
          authAllowTailscale: true,
          controlUiEnabled: true,
          controlUiAllowInsecureAuth: false,
          tailscaleMode: "serve",
          tailscaleResetOnExit: true,
          extraConfig: { reload: { mode: "hot" } },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
        modelProviders: [
          {
            id: "mp-1",
            configType: "system",
            userId: null,
            providerKey: "openai",
            providerName: "OpenAI",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "sk-openai",
            apiType: "openai-completions",
            models: [],
            enabled: true,
            priority: 50,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: null,
            updatedBy: null,
          },
        ],
        agentConfig: {
          id: "ac-1",
          configType: "system",
          userId: null,
          primaryModel: "gpt-4",
          workspacePath: null,
          compactionMode: "safeguard",
          maxConcurrent: 2,
          subagentsMaxConcurrent: 4,
          extraConfig: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
        systemConfigs: {
          logging: { level: "debug" },
        },
      };

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      // Gateway
      expect(result.gateway?.port).toBe(8080);
      expect(result.gateway?.auth?.mode).toBe("password");
      expect(result.gateway?.auth?.password).toBe("secret");
      expect(result.gateway?.tailscale?.mode).toBe("serve");
      expect(result.gateway?.reload?.mode).toBe("hot");

      // Model providers: 文件 anthropic + 数据库 openai
      expect(result.models?.providers?.anthropic?.apiKey).toBe("file-key-anthropic");
      expect(result.models?.providers?.openai?.apiKey).toBe("sk-openai");

      // Agent
      expect(result.agents?.defaults?.model).toBe("gpt-4");

      // System KV
      expect(result.logging).toEqual({ level: "debug" });
    });
  });

  // =========================================================================
  // 7. 边界场景
  // =========================================================================
  describe("边界场景", () => {
    it("文件配置为空对象时也能正常合并", () => {
      const fileConfig: OpenClawConfig = {};
      const dbConfigs = emptyDbConfigs();
      dbConfigs.systemConfigs = {
        logging: { level: "error" },
      };

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      expect(result.logging).toEqual({ level: "error" });
    });

    it("文件没有 gateway 段时，数据库创建新的 gateway 段", () => {
      const fileConfig: OpenClawConfig = {};
      const dbConfigs = emptyDbConfigs();
      dbConfigs.gatewayConfig = {
        id: "gw-1",
        configType: "system",
        userId: null,
        gatewayMode: "local",
        gatewayPort: 3000,
        gatewayBind: "loopback",
        authMode: "token",
        authToken: "my-token",
        authPassword: null,
        authAllowTailscale: false,
        controlUiEnabled: true,
        controlUiAllowInsecureAuth: false,
        tailscaleMode: "off",
        tailscaleResetOnExit: false,
        extraConfig: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      expect(result.gateway?.port).toBe(3000);
      expect(result.gateway?.auth?.mode).toBe("token");
      expect(result.gateway?.auth?.token).toBe("my-token");
    });

    it("文件没有 models 段时，数据库的 providers 创建新的 models 段", () => {
      const fileConfig: OpenClawConfig = {};
      const dbConfigs = emptyDbConfigs();
      dbConfigs.modelProviders = [
        {
          id: "mp-1",
          configType: "system",
          userId: null,
          providerKey: "openai",
          providerName: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-test",
          apiType: "openai-completions",
          models: [{ id: "gpt-4", name: "GPT-4" }],
          enabled: true,
          priority: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ];

      const result = mergeFileAndDbConfigs(fileConfig, dbConfigs);

      expect(result.models?.providers?.openai?.apiKey).toBe("sk-test");
    });
  });
});
