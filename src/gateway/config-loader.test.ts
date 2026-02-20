/**
 * loadAllDatabaseConfigs 集成测试
 *
 * 使用真实数据库验证配置加载逻辑
 * 测试数据使用唯一前缀，测试后清理
 */

import { eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { closeConnection, getDatabase, type Database } from "../db/connection.js";
import { gatewayConfigs } from "../db/schema/gateway-configs.js";
import { modelProviders } from "../db/schema/model-configs.js";
import { agentConfigs } from "../db/schema/model-configs.js";
import { systemConfigs } from "../db/schema/system-config.js";
import { generateId } from "../db/utils/id.js";

import { loadAllDatabaseConfigs } from "./config-loader.js";

// ---------------------------------------------------------------------------
// 测试数据标识（用于清理）
// ---------------------------------------------------------------------------
const TEST_PREFIX = `test-cfg-loader-${Date.now()}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 清理本次测试插入的所有数据 */
async function cleanupTestData(db: Database): Promise<void> {
  await db.delete(gatewayConfigs).where(like(gatewayConfigs.id, `${TEST_PREFIX}%`));
  await db.delete(modelProviders).where(like(modelProviders.id, `${TEST_PREFIX}%`));
  await db.delete(agentConfigs).where(like(agentConfigs.id, `${TEST_PREFIX}%`));
  await db.delete(systemConfigs).where(like(systemConfigs.id, `${TEST_PREFIX}%`));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("loadAllDatabaseConfigs (集成测试)", () => {
  let db: Database;

  beforeAll(() => {
    db = getDatabase();
  });

  afterEach(async () => {
    await cleanupTestData(db);
  });

  afterAll(async () => {
    await cleanupTestData(db);
    await closeConnection();
  });

  it("数据库连接正常时返回有效的 DatabaseConfigs 结构", async () => {
    const result = await loadAllDatabaseConfigs();

    // 能正常连接并返回非 null 结果
    expect(result).not.toBeNull();
    // 结构完整
    expect(result).toHaveProperty("gatewayConfig");
    expect(result).toHaveProperty("modelProviders");
    expect(result).toHaveProperty("agentConfig");
    expect(result).toHaveProperty("systemConfigs");
    // modelProviders 是数组
    expect(Array.isArray(result!.modelProviders)).toBe(true);
    // systemConfigs 是对象
    expect(typeof result!.systemConfigs).toBe("object");
  });

  it("数据库有 gateway 系统配置时正确返回", async () => {
    // 先删除可能存在的系统配置（因唯一约束限制 configType=system 只能有一条）
    await db.delete(gatewayConfigs).where(eq(gatewayConfigs.configType, "system"));

    const gwId = `${TEST_PREFIX}-gw-sys`;
    await db.insert(gatewayConfigs).values({
      id: gwId,
      configType: "system",
      gatewayMode: "local",
      gatewayPort: 9999,
      gatewayBind: "lan",
      authMode: "token",
      authToken: "test-token-123",
      controlUiEnabled: true,
      extraConfig: { tls: { enabled: true, certPath: "/test/cert.pem" } },
    });

    const result = await loadAllDatabaseConfigs();

    expect(result).not.toBeNull();
    expect(result!.gatewayConfig).not.toBeNull();
    expect(result!.gatewayConfig!.gatewayPort).toBe(9999);
    expect(result!.gatewayConfig!.gatewayBind).toBe("lan");
    expect(result!.gatewayConfig!.authMode).toBe("token");
    expect(result!.gatewayConfig!.authToken).toBe("test-token-123");
    expect(result!.gatewayConfig!.extraConfig).toEqual({
      tls: { enabled: true, certPath: "/test/cert.pem" },
    });

    // 清理（恢复原状）
    await db.delete(gatewayConfigs).where(eq(gatewayConfigs.id, gwId));
  });

  it("数据库有 model providers 时正确返回列表", async () => {
    const mpId = `${TEST_PREFIX}-mp-1`;
    await db.insert(modelProviders).values({
      id: mpId,
      configType: "system",
      providerKey: `test-provider-${TEST_PREFIX}`,
      providerName: "Test Provider",
      baseUrl: "https://api.test.com/v1",
      apiKey: "test-api-key",
      apiType: "openai-completions",
      models: [{ id: "test-model", name: "Test Model" }],
      enabled: true,
      priority: 100,
    });

    const result = await loadAllDatabaseConfigs();

    expect(result).not.toBeNull();
    expect(result!.modelProviders.length).toBeGreaterThanOrEqual(1);

    const testProvider = result!.modelProviders.find(
      (p) => p.providerKey === `test-provider-${TEST_PREFIX}`,
    );
    expect(testProvider).toBeDefined();
    expect(testProvider!.baseUrl).toBe("https://api.test.com/v1");
    expect(testProvider!.apiKey).toBe("test-api-key");
  });

  it("数据库有 agent 系统配置时正确返回", async () => {
    // 先删除可能存在的系统配置
    await db.delete(agentConfigs).where(eq(agentConfigs.configType, "system"));

    const acId = `${TEST_PREFIX}-ac-sys`;
    await db.insert(agentConfigs).values({
      id: acId,
      configType: "system",
      primaryModel: "claude-sonnet-4-20250514",
      compactionMode: "aggressive",
      maxConcurrent: 8,
      subagentsMaxConcurrent: 16,
    });

    const result = await loadAllDatabaseConfigs();

    expect(result).not.toBeNull();
    expect(result!.agentConfig).not.toBeNull();
    expect(result!.agentConfig!.primaryModel).toBe("claude-sonnet-4-20250514");
    expect(result!.agentConfig!.compactionMode).toBe("aggressive");
    expect(result!.agentConfig!.maxConcurrent).toBe(8);

    // 清理
    await db.delete(agentConfigs).where(eq(agentConfigs.id, acId));
  });

  it("数据库有 system_configs KV 时正确解析", async () => {
    const scId = `${TEST_PREFIX}-sc-logging`;
    await db.insert(systemConfigs).values({
      id: scId,
      key: "logging",
      value: { level: "debug", format: "json" },
      valueType: "json",
      group: "general",
    });

    const result = await loadAllDatabaseConfigs();

    expect(result).not.toBeNull();
    expect(result!.systemConfigs.logging).toEqual({ level: "debug", format: "json" });
  });

  it("多个 system_configs 同时加载", async () => {
    const ids = [
      { id: `${TEST_PREFIX}-sc-logging`, key: "logging", value: { level: "warn" } },
      { id: `${TEST_PREFIX}-sc-ui`, key: "ui", value: { seamColor: "#00ff00" } },
      { id: `${TEST_PREFIX}-sc-tools`, key: "tools", value: { allowlist: ["shell"] } },
    ];

    for (const item of ids) {
      await db.insert(systemConfigs).values({
        id: item.id,
        key: item.key,
        value: item.value,
        valueType: "json",
        group: "general",
      });
    }

    const result = await loadAllDatabaseConfigs();

    expect(result).not.toBeNull();
    expect(result!.systemConfigs.logging).toEqual({ level: "warn" });
    expect(result!.systemConfigs.ui).toEqual({ seamColor: "#00ff00" });
    expect(result!.systemConfigs.tools).toEqual({ allowlist: ["shell"] });
  });

  it("所有配置表同时有数据时并行加载成功", async () => {
    // 先清理可能存在的系统配置
    await db.delete(gatewayConfigs).where(eq(gatewayConfigs.configType, "system"));
    await db.delete(agentConfigs).where(eq(agentConfigs.configType, "system"));

    // 插入各类配置
    await Promise.all([
      db.insert(gatewayConfigs).values({
        id: `${TEST_PREFIX}-gw-all`,
        configType: "system",
        gatewayMode: "local",
        gatewayPort: 7777,
        authMode: "password",
        authPassword: "test-pass",
      }),
      db.insert(modelProviders).values({
        id: `${TEST_PREFIX}-mp-all`,
        configType: "system",
        providerKey: `all-test-${TEST_PREFIX}`,
        baseUrl: "https://all.test.com",
        apiKey: "all-key",
        models: [],
      }),
      db.insert(agentConfigs).values({
        id: `${TEST_PREFIX}-ac-all`,
        configType: "system",
        primaryModel: "gpt-4",
        maxConcurrent: 4,
      }),
      db.insert(systemConfigs).values({
        id: `${TEST_PREFIX}-sc-all`,
        key: "session",
        value: { compactionMode: "aggressive" },
        valueType: "json",
        group: "general",
      }),
    ]);

    const result = await loadAllDatabaseConfigs();

    expect(result).not.toBeNull();
    expect(result!.gatewayConfig?.gatewayPort).toBe(7777);
    expect(result!.modelProviders.length).toBeGreaterThanOrEqual(1);
    expect(result!.agentConfig?.primaryModel).toBe("gpt-4");
    expect(result!.systemConfigs.session).toEqual({ compactionMode: "aggressive" });

    // 清理
    await db.delete(gatewayConfigs).where(eq(gatewayConfigs.id, `${TEST_PREFIX}-gw-all`));
    await db.delete(agentConfigs).where(eq(agentConfigs.id, `${TEST_PREFIX}-ac-all`));
  });
});
