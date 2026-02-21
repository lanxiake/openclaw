/**
 * db-store 测试用例
 *
 * 覆盖 convertDbProfilesToAuthStore() 的三种凭据模式 (api_key, token, oauth)
 * 以及 mergeAuthStores() 的合并逻辑
 */

import { describe, it, expect } from "vitest";

import type { AuthProfile, AuthProfileOrderRecord } from "../../db/schema/auth-profiles.js";
import type { AuthProfileStore } from "./types.js";

import { convertDbProfilesToAuthStore, mergeAuthStores } from "./db-store.js";

/**
 * 构建测试用 AuthProfile 的辅助函数
 */
function makeDbProfile(
  overrides: Partial<AuthProfile> & { profileId: string; provider: string },
): AuthProfile {
  return {
    id: `test-id-${overrides.profileId}`,
    configType: "system",
    userId: null,
    profileId: overrides.profileId,
    provider: overrides.provider,
    credentialMode: overrides.credentialMode ?? "api_key",
    apiKey: overrides.apiKey ?? null,
    token: overrides.token ?? null,
    tokenExpires: overrides.tokenExpires ?? null,
    oauthCredentials: overrides.oauthCredentials ?? null,
    email: overrides.email ?? null,
    enabled: overrides.enabled ?? true,
    priority: overrides.priority ?? 100,
    modelBindings: overrides.modelBindings ?? null,
    usageStats: overrides.usageStats ?? null,
    cooldownConfig: overrides.cooldownConfig ?? null,
    extraConfig: overrides.extraConfig ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    createdBy: overrides.createdBy ?? null,
    updatedBy: overrides.updatedBy ?? null,
  };
}

/**
 * 构建测试用 AuthProfileOrderRecord 的辅助函数
 */
function makeDbOrder(
  overrides: Partial<AuthProfileOrderRecord> & { agentKey: string; profileIds: string[] },
): AuthProfileOrderRecord {
  return {
    id: `order-${overrides.agentKey}`,
    configType: "system",
    userId: null,
    agentKey: overrides.agentKey,
    profileIds: overrides.profileIds,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

describe("convertDbProfilesToAuthStore", () => {
  it("应将 api_key 类型的 DB profile 转换为 AuthProfileStore", () => {
    const dbProfiles = [
      makeDbProfile({
        profileId: "anthropic-main",
        provider: "anthropic",
        credentialMode: "api_key",
        apiKey: "sk-ant-test-key-123",
        email: "test@example.com",
      }),
    ];

    const store = convertDbProfilesToAuthStore(dbProfiles, []);

    expect(store.version).toBe(1);
    expect(store.profiles["anthropic-main"]).toEqual({
      type: "api_key",
      provider: "anthropic",
      key: "sk-ant-test-key-123",
      email: "test@example.com",
    });
  });

  it("应将 token 类型的 DB profile 转换为 AuthProfileStore", () => {
    const expires = new Date("2026-12-31T00:00:00Z");
    const dbProfiles = [
      makeDbProfile({
        profileId: "openai-token",
        provider: "openai",
        credentialMode: "token",
        token: "tok-test-456",
        tokenExpires: expires,
      }),
    ];

    const store = convertDbProfilesToAuthStore(dbProfiles, []);

    expect(store.profiles["openai-token"]).toEqual({
      type: "token",
      provider: "openai",
      token: "tok-test-456",
      expires: expires.getTime(),
    });
  });

  it("应将 oauth 类型的 DB profile 转换为 AuthProfileStore", () => {
    const dbProfiles = [
      makeDbProfile({
        profileId: "github-oauth",
        provider: "github-copilot",
        credentialMode: "oauth",
        oauthCredentials: {
          accessToken: "gho_access_789",
          refreshToken: "gho_refresh_999",
          expiry: 1700000000000,
          clientId: "client-abc",
        },
        email: "dev@example.com",
      }),
    ];

    const store = convertDbProfilesToAuthStore(dbProfiles, []);

    expect(store.profiles["github-oauth"]).toEqual({
      type: "oauth",
      provider: "github-copilot",
      access: "gho_access_789",
      refresh: "gho_refresh_999",
      expires: 1700000000000,
      clientId: "client-abc",
      email: "dev@example.com",
    });
  });

  it("应跳过 enabled=false 的 DB profile", () => {
    const dbProfiles = [
      makeDbProfile({
        profileId: "disabled-profile",
        provider: "anthropic",
        credentialMode: "api_key",
        apiKey: "sk-disabled",
        enabled: false,
      }),
    ];

    const store = convertDbProfilesToAuthStore(dbProfiles, []);

    expect(Object.keys(store.profiles)).toHaveLength(0);
  });

  it("应跳过无有效凭据的 DB profile", () => {
    const dbProfiles = [
      makeDbProfile({
        profileId: "empty-profile",
        provider: "anthropic",
        credentialMode: "api_key",
        apiKey: null,
      }),
    ];

    const store = convertDbProfilesToAuthStore(dbProfiles, []);

    expect(Object.keys(store.profiles)).toHaveLength(0);
  });

  it("应跳过 oauth 类型但缺少 accessToken 的 profile", () => {
    const dbProfiles = [
      makeDbProfile({
        profileId: "oauth-no-access",
        provider: "github-copilot",
        credentialMode: "oauth",
        oauthCredentials: { refreshToken: "only-refresh" },
      }),
    ];

    const store = convertDbProfilesToAuthStore(dbProfiles, []);

    expect(Object.keys(store.profiles)).toHaveLength(0);
  });

  it("应正确转换 order 记录", () => {
    const dbProfiles = [
      makeDbProfile({
        profileId: "p1",
        provider: "anthropic",
        credentialMode: "api_key",
        apiKey: "key-1",
      }),
    ];
    const dbOrders = [
      makeDbOrder({
        agentKey: "default",
        profileIds: ["p1", "p2"],
      }),
      makeDbOrder({
        agentKey: "pi-agent",
        profileIds: ["p2", "p1"],
      }),
    ];

    const store = convertDbProfilesToAuthStore(dbProfiles, dbOrders);

    expect(store.order).toEqual({
      default: ["p1", "p2"],
      "pi-agent": ["p2", "p1"],
    });
  });

  it("应处理空 order 数组", () => {
    const store = convertDbProfilesToAuthStore([], []);

    expect(store.order).toBeUndefined();
  });

  it("应处理多个不同类型的 profiles", () => {
    const dbProfiles = [
      makeDbProfile({
        profileId: "p-api",
        provider: "anthropic",
        credentialMode: "api_key",
        apiKey: "sk-test",
      }),
      makeDbProfile({
        profileId: "p-token",
        provider: "openai",
        credentialMode: "token",
        token: "tok-test",
      }),
      makeDbProfile({
        profileId: "p-oauth",
        provider: "github-copilot",
        credentialMode: "oauth",
        oauthCredentials: { accessToken: "at-123", refreshToken: "rt-456", expiry: 0 },
      }),
    ];

    const store = convertDbProfilesToAuthStore(dbProfiles, []);

    expect(Object.keys(store.profiles)).toHaveLength(3);
    expect(store.profiles["p-api"]!.type).toBe("api_key");
    expect(store.profiles["p-token"]!.type).toBe("token");
    expect(store.profiles["p-oauth"]!.type).toBe("oauth");
  });
});

describe("mergeAuthStores", () => {
  it("DB store 应覆盖 file store 中的同名 profile", () => {
    const fileStore: AuthProfileStore = {
      version: 1,
      profiles: {
        "anthropic-main": {
          type: "api_key",
          provider: "anthropic",
          key: "file-key-old",
        },
        "openai-backup": {
          type: "api_key",
          provider: "openai",
          key: "file-key-openai",
        },
      },
    };

    const dbStore: AuthProfileStore = {
      version: 1,
      profiles: {
        "anthropic-main": {
          type: "api_key",
          provider: "anthropic",
          key: "db-key-new",
        },
      },
    };

    const merged = mergeAuthStores(fileStore, dbStore);

    // DB 覆盖同名 profile
    expect(merged.profiles["anthropic-main"]).toEqual({
      type: "api_key",
      provider: "anthropic",
      key: "db-key-new",
    });
    // 保留 file store 中不在 DB 的 profile
    expect(merged.profiles["openai-backup"]).toEqual({
      type: "api_key",
      provider: "openai",
      key: "file-key-openai",
    });
  });

  it("DB order 应覆盖 file order 中相同 agentKey 的配置", () => {
    const fileStore: AuthProfileStore = {
      version: 1,
      profiles: {},
      order: {
        default: ["p1", "p2"],
        "custom-agent": ["p3"],
      },
    };

    const dbStore: AuthProfileStore = {
      version: 1,
      profiles: {},
      order: {
        default: ["p2", "p1"],
      },
    };

    const merged = mergeAuthStores(fileStore, dbStore);

    // DB order 覆盖 file order 的相同 key
    expect(merged.order!["default"]).toEqual(["p2", "p1"]);
    // 保留 file order 中不在 DB 的 key
    expect(merged.order!["custom-agent"]).toEqual(["p3"]);
  });

  it("应保留 file store 的 lastGood 和 usageStats", () => {
    const fileStore: AuthProfileStore = {
      version: 1,
      profiles: {},
      lastGood: { anthropic: "anthropic-main" },
      usageStats: {
        "anthropic-main": { lastUsed: 1000, errorCount: 2 },
      },
    };

    const dbStore: AuthProfileStore = {
      version: 1,
      profiles: {},
    };

    const merged = mergeAuthStores(fileStore, dbStore);

    expect(merged.lastGood).toEqual({ anthropic: "anthropic-main" });
    expect(merged.usageStats).toEqual({
      "anthropic-main": { lastUsed: 1000, errorCount: 2 },
    });
  });

  it("DB store 为空时应返回 file store 不变", () => {
    const fileStore: AuthProfileStore = {
      version: 1,
      profiles: {
        p1: { type: "api_key", provider: "anthropic", key: "file-key" },
      },
      order: { default: ["p1"] },
    };

    const dbStore: AuthProfileStore = {
      version: 1,
      profiles: {},
    };

    const merged = mergeAuthStores(fileStore, dbStore);

    expect(merged.profiles).toEqual(fileStore.profiles);
    expect(merged.order).toEqual(fileStore.order);
  });

  it("file store 为空时应返回 DB store 的 profiles", () => {
    const fileStore: AuthProfileStore = {
      version: 1,
      profiles: {},
    };

    const dbStore: AuthProfileStore = {
      version: 1,
      profiles: {
        "db-p1": { type: "api_key", provider: "anthropic", key: "db-key" },
      },
      order: { default: ["db-p1"] },
    };

    const merged = mergeAuthStores(fileStore, dbStore);

    expect(merged.profiles["db-p1"]).toEqual({
      type: "api_key",
      provider: "anthropic",
      key: "db-key",
    });
    expect(merged.order).toEqual({ default: ["db-p1"] });
  });
});
