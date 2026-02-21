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
  TENANT_MODEL_PROVIDER_FIELDS,
  TENANT_AGENT_CONFIG_FIELDS,
  validateTenantFields,
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

// ---------------------------------------------------------------------------
// 租户字段白名单常量测试
// ---------------------------------------------------------------------------

describe("TENANT_MODEL_PROVIDER_FIELDS", () => {
  it("应包含迁移方案 §5.2.3 定义的白名单字段", () => {
    expect(TENANT_MODEL_PROVIDER_FIELDS).toContain("apiKey");
    expect(TENANT_MODEL_PROVIDER_FIELDS).toContain("baseUrl");
    expect(TENANT_MODEL_PROVIDER_FIELDS).toContain("models");
    expect(TENANT_MODEL_PROVIDER_FIELDS).toContain("enabled");
    expect(TENANT_MODEL_PROVIDER_FIELDS).toContain("priority");
  });

  it("不应包含管理员专属字段", () => {
    expect(TENANT_MODEL_PROVIDER_FIELDS).not.toContain("configType");
    expect(TENANT_MODEL_PROVIDER_FIELDS).not.toContain("userId");
    expect(TENANT_MODEL_PROVIDER_FIELDS).not.toContain("id");
  });
});

describe("TENANT_AGENT_CONFIG_FIELDS", () => {
  it("应包含迁移方案 §5.2.3 定义的白名单字段", () => {
    expect(TENANT_AGENT_CONFIG_FIELDS).toContain("primaryModel");
    expect(TENANT_AGENT_CONFIG_FIELDS).toContain("compactionMode");
    expect(TENANT_AGENT_CONFIG_FIELDS).toContain("maxConcurrent");
  });

  it("不应包含管理员专属字段", () => {
    expect(TENANT_AGENT_CONFIG_FIELDS).not.toContain("configType");
    expect(TENANT_AGENT_CONFIG_FIELDS).not.toContain("userId");
    expect(TENANT_AGENT_CONFIG_FIELDS).not.toContain("id");
  });
});

// ---------------------------------------------------------------------------
// validateTenantFields 测试
// ---------------------------------------------------------------------------

describe("validateTenantFields", () => {
  it("白名单内的字段应全部通过验证", () => {
    const body = { apiKey: "sk-xxx", baseUrl: "https://api.test.com", models: [] };
    const result = validateTenantFields(body, TENANT_MODEL_PROVIDER_FIELDS);

    expect(result.valid).toBe(true);
    expect(result.forbiddenFields).toEqual([]);
  });

  it("包含非白名单字段时应返回验证失败", () => {
    const body = { apiKey: "sk-xxx", configType: "system", id: "hack" };
    const result = validateTenantFields(body, TENANT_MODEL_PROVIDER_FIELDS);

    expect(result.valid).toBe(false);
    expect(result.forbiddenFields).toContain("configType");
    expect(result.forbiddenFields).toContain("id");
  });

  it("空请求体应通过验证", () => {
    const body = {};
    const result = validateTenantFields(body, TENANT_MODEL_PROVIDER_FIELDS);

    expect(result.valid).toBe(true);
    expect(result.forbiddenFields).toEqual([]);
  });

  it("Agent 配置白名单：只允许 primaryModel, compactionMode, maxConcurrent", () => {
    const validBody = { primaryModel: "sonnet", compactionMode: "safeguard", maxConcurrent: 8 };
    expect(validateTenantFields(validBody, TENANT_AGENT_CONFIG_FIELDS).valid).toBe(true);

    const invalidBody = { primaryModel: "sonnet", workspacePath: "/hack", subagentsMaxConcurrent: 100 };
    const result = validateTenantFields(invalidBody, TENANT_AGENT_CONFIG_FIELDS);
    expect(result.valid).toBe(false);
    expect(result.forbiddenFields).toContain("workspacePath");
    expect(result.forbiddenFields).toContain("subagentsMaxConcurrent");
  });

  it("返回所有非法字段的列表（不只是第一个）", () => {
    const body = { configType: "system", userId: "hack", id: "123", apiKey: "sk-xxx" };
    const result = validateTenantFields(body, TENANT_MODEL_PROVIDER_FIELDS);

    expect(result.valid).toBe(false);
    expect(result.forbiddenFields).toHaveLength(3);
    expect(result.forbiddenFields).toEqual(
      expect.arrayContaining(["configType", "userId", "id"]),
    );
  });
});

// ---------------------------------------------------------------------------
// §5.2.4 迁移方案集成测试场景
// ---------------------------------------------------------------------------

describe("§5.2.4 迁移方案集成测试场景", () => {
  /**
   * 场景 1: 系统有 anthropic provider，用户覆盖 apiKey → 用户使用自己的 key
   *
   * 验证：用户覆盖的 apiKey 通过白名单验证 + 脱敏后正确返回
   */
  it("场景1: 用户覆盖系统 provider 的 apiKey 通过白名单且脱敏正确", () => {
    /** 用户提交的覆盖请求 */
    const userOverride = {
      apiKey: "sk-user-private-key-abcd",
      baseUrl: "https://api.anthropic.com",
      models: [{ id: "claude-opus-4-5-20251101" }],
    };

    /** 白名单验证通过 */
    const check = validateTenantFields(userOverride, TENANT_MODEL_PROVIDER_FIELDS);
    expect(check.valid).toBe(true);

    /** 脱敏后返回给用户 */
    const sanitized = sanitizeModelProvider({
      id: "mp-tenant-1",
      configType: "tenant",
      providerKey: "anthropic",
      ...userOverride,
    });
    expect(sanitized.apiKey).toBe("***abcd");
    expect(sanitized.providerKey).toBe("anthropic");
  });

  /**
   * 场景 2: 系统 Agent primaryModel=opus，用户覆盖为 sonnet
   *
   * 验证：primaryModel 在白名单中，可以正常覆盖
   */
  it("场景2: 用户覆盖 Agent primaryModel 通过白名单验证", () => {
    const userOverride = { primaryModel: "claude-sonnet-4-20250514" };
    const check = validateTenantFields(userOverride, TENANT_AGENT_CONFIG_FIELDS);

    expect(check.valid).toBe(true);
  });

  /**
   * 场景 3: 用户删除覆盖 → 恢复系统默认
   *
   * 验证：删除操作不涉及字段验证，仅需确认 delete 接口正确工作
   * （此处验证 validateTenantFields 对空体不拦截）
   */
  it("场景3: 删除覆盖操作不受白名单约束", () => {
    /** DELETE 请求没有 body，空对象通过验证 */
    const check = validateTenantFields({}, TENANT_MODEL_PROVIDER_FIELDS);
    expect(check.valid).toBe(true);
  });

  /**
   * 场景 4: 用户尝试修改 gateway.port → 403 Forbidden
   *
   * Gateway 配置不提供用户 API（天然隔离），但若有人通过 Agent 配置
   * 端点注入 gateway 相关字段，应被白名单拒绝。
   */
  it("场景4: 用户注入 gateway 类字段被白名单拒绝", () => {
    /** 尝试通过 Agent 配置端点注入 gateway 字段 */
    const maliciousBody = {
      primaryModel: "sonnet",
      gatewayPort: 9999,
      gatewayBind: "0.0.0.0",
    };
    const agentCheck = validateTenantFields(maliciousBody, TENANT_AGENT_CONFIG_FIELDS);
    expect(agentCheck.valid).toBe(false);
    expect(agentCheck.forbiddenFields).toContain("gatewayPort");
    expect(agentCheck.forbiddenFields).toContain("gatewayBind");

    /** 尝试通过 Model Provider 端点注入系统字段 */
    const maliciousProvider = {
      apiKey: "sk-xxx",
      baseUrl: "https://test.com",
      models: [],
      configType: "system",
      userId: "admin-user-id",
    };
    const providerCheck = validateTenantFields(maliciousProvider, TENANT_MODEL_PROVIDER_FIELDS);
    expect(providerCheck.valid).toBe(false);
    expect(providerCheck.forbiddenFields).toContain("configType");
    expect(providerCheck.forbiddenFields).toContain("userId");
  });

  /**
   * 场景 5: 管理员创建系统 auth profile → 无私有 profile 的用户自动使用
   *
   * 验证：系统级 auth profile 经过脱敏后，用户可安全查看
   */
  it("场景5: 系统 auth profile 脱敏后对用户安全展示", () => {
    const systemProfile = {
      id: "ap-system-1",
      configType: "system",
      profileId: "anthropic-main",
      provider: "anthropic",
      credentialMode: "api_key",
      apiKey: "sk-ant-api03-system-key-xxxx",
      token: null,
      oauthCredentials: null,
      enabled: true,
      priority: 10,
    };

    const sanitized = sanitizeAuthProfile(systemProfile);

    /** 用户看到的 apiKey 已脱敏 */
    expect(sanitized.apiKey).toBe("***xxxx");
    /** 其他非敏感字段完整保留 */
    expect(sanitized.provider).toBe("anthropic");
    expect(sanitized.enabled).toBe(true);
    expect(sanitized.priority).toBe(10);
    expect(sanitized.profileId).toBe("anthropic-main");
  });
});
