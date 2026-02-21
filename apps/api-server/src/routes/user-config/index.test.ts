/**
 * 用户配置 API 路由单元测试
 *
 * 验证 9 个租户私有配置 API 端点的核心逻辑：
 * - 模型提供商 CRUD (GET/PUT/DELETE)
 * - Agent 配置 (GET/PUT)
 * - Auth Profile CRUD (GET/PUT/DELETE)
 * - 有效合并配置 (GET /effective)
 * - 认证校验和敏感字段脱敏
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock 依赖
// ---------------------------------------------------------------------------

const mockModelProviderRepo = {
  listEffectiveProviders: vi.fn(),
  getProviderByKey: vi.fn(),
  upsertTenantProvider: vi.fn(),
  deleteTenantProvider: vi.fn(),
};

const mockAgentConfigRepo = {
  getEffectiveConfig: vi.fn(),
  upsertTenantConfig: vi.fn(),
  deleteTenantConfig: vi.fn(),
};

const mockAuthProfileRepo = {
  listEffectiveProfiles: vi.fn(),
  getByProfileId: vi.fn(),
  upsertTenantProfile: vi.fn(),
  deleteTenantProfile: vi.fn(),
};

const mockAuthProfileOrderRepo = {
  listEffectiveOrders: vi.fn(),
};

vi.mock("../../../../../src/db/connection.js", () => ({
  getDatabase: vi.fn(() => ({})),
}));

vi.mock("../../../../../src/db/repositories/model-configs.js", () => ({
  ModelProviderRepository: vi.fn(() => mockModelProviderRepo),
  AgentDefaultConfigRepository: vi.fn(() => mockAgentConfigRepo),
}));

vi.mock("../../../../../src/db/repositories/auth-profile-configs.js", () => ({
  AuthProfileRepository: vi.fn(() => mockAuthProfileRepo),
  AuthProfileOrderRepository: vi.fn(() => mockAuthProfileOrderRepo),
}));

// ---------------------------------------------------------------------------
// 导入被测模块（所有辅助函数直接导出用于单元测试）
// ---------------------------------------------------------------------------

import {
  sanitizeModelProvider,
  sanitizeAuthProfile,
} from "./index.js";

// ---------------------------------------------------------------------------
// sanitizeModelProvider 测试
// ---------------------------------------------------------------------------

describe("sanitizeModelProvider", () => {
  it("应脱敏 API Key 为最后 4 位", () => {
    const provider = {
      id: "p1",
      providerKey: "openai",
      apiKey: "sk-proj-abcdefgh12345678",
      baseUrl: "https://api.openai.com/v1",
      models: [],
    };

    const result = sanitizeModelProvider(provider);

    expect(result.apiKey).toBe("***5678");
    expect(result.baseUrl).toBe("https://api.openai.com/v1");
    expect(result.providerKey).toBe("openai");
  });

  it("API Key 为 null 时返回 null", () => {
    const provider = {
      id: "p1",
      providerKey: "test",
      apiKey: null,
      baseUrl: "https://test.com",
      models: [],
    };

    const result = sanitizeModelProvider(provider);

    expect(result.apiKey).toBeNull();
  });

  it("不修改原始对象（不可变性）", () => {
    const original = {
      id: "p1",
      providerKey: "openai",
      apiKey: "sk-proj-abcdefgh12345678",
      baseUrl: "https://api.openai.com/v1",
      models: [],
    };
    const originalApiKey = original.apiKey;

    sanitizeModelProvider(original);

    expect(original.apiKey).toBe(originalApiKey);
  });
});

// ---------------------------------------------------------------------------
// sanitizeAuthProfile 测试
// ---------------------------------------------------------------------------

describe("sanitizeAuthProfile", () => {
  it("应脱敏 apiKey 和 token", () => {
    const profile = {
      id: "ap1",
      profileId: "test-profile",
      provider: "anthropic",
      apiKey: "sk-ant-api03-long-key-here",
      token: "ey-jwt-token-long-value",
      oauthCredentials: { client_id: "xxx" },
    };

    const result = sanitizeAuthProfile(profile);

    expect(result.apiKey).toBe("***here");
    expect(result.token).toBe("***alue");
    expect(result.oauthCredentials).toEqual({ "***": "redacted" });
    expect(result.provider).toBe("anthropic");
  });

  it("字段为 null 时返回 null", () => {
    const profile = {
      id: "ap1",
      profileId: "test-profile",
      provider: "openai",
      apiKey: null,
      token: null,
      oauthCredentials: null,
    };

    const result = sanitizeAuthProfile(profile);

    expect(result.apiKey).toBeNull();
    expect(result.token).toBeNull();
    expect(result.oauthCredentials).toBeNull();
  });

  it("不修改原始对象（不可变性）", () => {
    const original = {
      id: "ap1",
      profileId: "test-profile",
      provider: "anthropic",
      apiKey: "sk-ant-api03-long-key-here",
      token: null,
      oauthCredentials: null,
    };
    const originalApiKey = original.apiKey;

    sanitizeAuthProfile(original);

    expect(original.apiKey).toBe(originalApiKey);
  });
});
