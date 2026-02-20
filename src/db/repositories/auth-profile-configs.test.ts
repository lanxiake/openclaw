/**
 * AuthProfileRepository 集成测试
 *
 * 使用真实数据库验证 auth_profiles 和 auth_profile_order 的 CRUD 逻辑。
 * 测试数据使用唯一前缀，测试后清理。
 */

import { eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { closeConnection, getDatabase, type Database } from "../connection.js";
import { authProfiles, authProfileOrder } from "../schema/auth-profiles.js";
import { users } from "../schema/users.js";

import { AuthProfileRepository, AuthProfileOrderRepository } from "./auth-profile-configs.js";

// ---------------------------------------------------------------------------
// 测试数据标识（用于清理）
// ---------------------------------------------------------------------------
const TEST_PREFIX = `test-ap-${Date.now()}`;

/** 测试用户 ID 列表（需要先在 users 表创建） */
const TEST_USER_IDS = [
  `${TEST_PREFIX}-user-1`,
  `${TEST_PREFIX}-user-2`,
  `${TEST_PREFIX}-user-3`,
  `${TEST_PREFIX}-user-4`,
  `${TEST_PREFIX}-user-5`,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 创建测试用户 */
async function createTestUsers(db: Database): Promise<void> {
  for (const userId of TEST_USER_IDS) {
    await db.insert(users).values({
      id: userId,
      displayName: `Test User ${userId}`,
      status: "active",
    });
  }
}

/** 清理本次测试插入的所有数据 */
async function cleanupTestData(db: Database): Promise<void> {
  await db.delete(authProfileOrder).where(like(authProfileOrder.id, `${TEST_PREFIX}%`));
  await db.delete(authProfiles).where(like(authProfiles.id, `${TEST_PREFIX}%`));
  // 清理 upsert 创建的记录（ID 由 generateId() 生成，不带前缀）
  await db.delete(authProfiles).where(like(authProfiles.profileId, `%${TEST_PREFIX}%`));
}

/** 清理测试用户 */
async function cleanupTestUsers(db: Database): Promise<void> {
  for (const userId of TEST_USER_IDS) {
    await db.delete(users).where(eq(users.id, userId));
  }
}

// ---------------------------------------------------------------------------
// AuthProfileRepository Tests
// ---------------------------------------------------------------------------

describe("AuthProfileRepository (集成测试)", () => {
  let db: Database;
  let repo: AuthProfileRepository;

  beforeAll(async () => {
    db = getDatabase();
    repo = new AuthProfileRepository(db);
    await createTestUsers(db);
  });

  afterEach(async () => {
    await cleanupTestData(db);
  });

  afterAll(async () => {
    await cleanupTestData(db);
    await cleanupTestUsers(db);
    await closeConnection();
  });

  // -------------------------------------------------------------------------
  // 创建
  // -------------------------------------------------------------------------

  it("创建系统级 api_key profile", async () => {
    const profile = await repo.create({
      id: `${TEST_PREFIX}-ap-1`,
      configType: "system",
      profileId: `test-anthropic-${TEST_PREFIX}`,
      provider: "anthropic",
      credentialMode: "api_key",
      apiKey: "sk-ant-test-key-123",
      email: "test@example.com",
      priority: 10,
    });

    expect(profile).toBeDefined();
    expect(profile.id).toBe(`${TEST_PREFIX}-ap-1`);
    expect(profile.configType).toBe("system");
    expect(profile.profileId).toBe(`test-anthropic-${TEST_PREFIX}`);
    expect(profile.provider).toBe("anthropic");
    expect(profile.credentialMode).toBe("api_key");
    expect(profile.apiKey).toBe("sk-ant-test-key-123");
    expect(profile.email).toBe("test@example.com");
    expect(profile.priority).toBe(10);
    expect(profile.enabled).toBe(true);
  });

  it("创建租户级 token profile", async () => {
    const profile = await repo.create({
      id: `${TEST_PREFIX}-ap-2`,
      configType: "tenant",
      userId: TEST_USER_IDS[0],
      profileId: `test-openai-${TEST_PREFIX}`,
      provider: "openai",
      credentialMode: "token",
      token: "tok-test-token-456",
      tokenExpires: new Date("2026-12-31"),
      priority: 20,
    });

    expect(profile.configType).toBe("tenant");
    expect(profile.userId).toBe(TEST_USER_IDS[0]);
    expect(profile.credentialMode).toBe("token");
    expect(profile.token).toBe("tok-test-token-456");
    expect(profile.tokenExpires).toBeTruthy();
  });

  it("创建 oauth profile 带 JSONB 凭据", async () => {
    const oauthCreds = {
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiry: Date.now() + 3600000,
      clientId: "client-id-789",
    };

    const profile = await repo.create({
      id: `${TEST_PREFIX}-ap-3`,
      configType: "system",
      profileId: `test-google-${TEST_PREFIX}`,
      provider: "google",
      credentialMode: "oauth",
      oauthCredentials: oauthCreds,
      email: "oauth@google.com",
      modelBindings: ["gemini-pro", "gemini-ultra"],
    });

    expect(profile.credentialMode).toBe("oauth");
    expect(profile.oauthCredentials).toEqual(oauthCreds);
    expect(profile.modelBindings).toEqual(["gemini-pro", "gemini-ultra"]);
  });

  // -------------------------------------------------------------------------
  // 查询
  // -------------------------------------------------------------------------

  it("listSystemProfiles 返回系统级启用的 profiles", async () => {
    // 创建 2 个系统级 + 1 个禁用的
    await repo.create({
      id: `${TEST_PREFIX}-ls-1`,
      configType: "system",
      profileId: `sys-1-${TEST_PREFIX}`,
      provider: "anthropic",
      credentialMode: "api_key",
      apiKey: "key-1",
      priority: 10,
    });
    await repo.create({
      id: `${TEST_PREFIX}-ls-2`,
      configType: "system",
      profileId: `sys-2-${TEST_PREFIX}`,
      provider: "openai",
      credentialMode: "api_key",
      apiKey: "key-2",
      priority: 20,
    });
    await repo.create({
      id: `${TEST_PREFIX}-ls-3`,
      configType: "system",
      profileId: `sys-disabled-${TEST_PREFIX}`,
      provider: "google",
      credentialMode: "api_key",
      apiKey: "key-3",
      enabled: false,
      priority: 5,
    });

    const profiles = await repo.listSystemProfiles();

    // 至少包含我们的 2 个启用的
    const testProfiles = profiles.filter((p) => p.id.startsWith(TEST_PREFIX));
    expect(testProfiles.length).toBe(2);
    // 按 priority 排序
    expect(testProfiles[0]!.priority).toBeLessThanOrEqual(testProfiles[1]!.priority!);
  });

  it("listEffectiveProfiles 租户覆盖系统配置", async () => {
    const userId = TEST_USER_IDS[1]!;

    // 系统级 anthropic profile
    await repo.create({
      id: `${TEST_PREFIX}-eff-sys`,
      configType: "system",
      profileId: `eff-anthropic-${TEST_PREFIX}`,
      provider: "anthropic",
      credentialMode: "api_key",
      apiKey: "sys-key",
      priority: 10,
    });

    // 租户覆盖同一 profileId
    await repo.create({
      id: `${TEST_PREFIX}-eff-tenant`,
      configType: "tenant",
      userId,
      profileId: `eff-anthropic-${TEST_PREFIX}`,
      provider: "anthropic",
      credentialMode: "api_key",
      apiKey: "tenant-key",
      priority: 5,
    });

    const profiles = await repo.listEffectiveProfiles(userId);

    // 同 profileId 只保留租户版本
    const anthropicProfiles = profiles.filter(
      (p) => p.profileId === `eff-anthropic-${TEST_PREFIX}`,
    );
    expect(anthropicProfiles.length).toBe(1);
    expect(anthropicProfiles[0]!.apiKey).toBe("tenant-key");
    expect(anthropicProfiles[0]!.configType).toBe("tenant");
  });

  it("getByProfileId 返回指定 profileId 的配置", async () => {
    await repo.create({
      id: `${TEST_PREFIX}-getby-1`,
      configType: "system",
      profileId: `getby-test-${TEST_PREFIX}`,
      provider: "anthropic",
      credentialMode: "api_key",
      apiKey: "getby-key",
    });

    const profile = await repo.getByProfileId(`getby-test-${TEST_PREFIX}`);
    expect(profile).not.toBeNull();
    expect(profile!.apiKey).toBe("getby-key");
  });

  it("getByProfileId 租户优先于系统", async () => {
    const userId = TEST_USER_IDS[2]!;

    await repo.create({
      id: `${TEST_PREFIX}-getby-sys`,
      configType: "system",
      profileId: `getby-prio-${TEST_PREFIX}`,
      provider: "anthropic",
      credentialMode: "api_key",
      apiKey: "sys-key",
    });

    await repo.create({
      id: `${TEST_PREFIX}-getby-ten`,
      configType: "tenant",
      userId,
      profileId: `getby-prio-${TEST_PREFIX}`,
      provider: "anthropic",
      credentialMode: "api_key",
      apiKey: "tenant-key",
    });

    const profile = await repo.getByProfileId(`getby-prio-${TEST_PREFIX}`, userId);
    expect(profile).not.toBeNull();
    expect(profile!.apiKey).toBe("tenant-key");
  });

  // -------------------------------------------------------------------------
  // 更新
  // -------------------------------------------------------------------------

  it("update 修改 profile 字段", async () => {
    await repo.create({
      id: `${TEST_PREFIX}-upd-1`,
      configType: "system",
      profileId: `upd-test-${TEST_PREFIX}`,
      provider: "anthropic",
      credentialMode: "api_key",
      apiKey: "old-key",
      priority: 100,
    });

    const updated = await repo.update(`${TEST_PREFIX}-upd-1`, {
      apiKey: "new-key",
      priority: 50,
      email: "updated@test.com",
    });

    expect(updated).not.toBeNull();
    expect(updated!.apiKey).toBe("new-key");
    expect(updated!.priority).toBe(50);
    expect(updated!.email).toBe("updated@test.com");
  });

  it("updateUsageStats 更新运行时统计", async () => {
    await repo.create({
      id: `${TEST_PREFIX}-stats-1`,
      configType: "system",
      profileId: `stats-test-${TEST_PREFIX}`,
      provider: "anthropic",
      credentialMode: "api_key",
      apiKey: "stats-key",
    });

    const stats = {
      lastUsed: Date.now(),
      cooldownUntil: Date.now() + 60000,
      errorCount: 3,
    };

    const updated = await repo.updateUsageStats(`${TEST_PREFIX}-stats-1`, stats);
    expect(updated).not.toBeNull();
    expect(updated!.usageStats).toEqual(stats);
  });

  // -------------------------------------------------------------------------
  // 删除
  // -------------------------------------------------------------------------

  it("delete 删除指定 profile", async () => {
    await repo.create({
      id: `${TEST_PREFIX}-del-1`,
      configType: "system",
      profileId: `del-test-${TEST_PREFIX}`,
      provider: "anthropic",
      credentialMode: "api_key",
      apiKey: "del-key",
    });

    const deleted = await repo.delete(`${TEST_PREFIX}-del-1`);
    expect(deleted).toBe(true);

    // 确认已删除
    const profile = await repo.getByProfileId(`del-test-${TEST_PREFIX}`);
    expect(profile).toBeNull();
  });

  it("delete 不存在的 ID 返回 false", async () => {
    const deleted = await repo.delete(`${TEST_PREFIX}-nonexistent`);
    expect(deleted).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Upsert
  // -------------------------------------------------------------------------

  it("upsertSystemProfile 创建新的系统 profile", async () => {
    const profile = await repo.upsertSystemProfile(
      `upsert-new-${TEST_PREFIX}`,
      {
        provider: "anthropic",
        credentialMode: "api_key",
        apiKey: "upsert-new-key",
        priority: 15,
      },
      "admin-1",
    );

    expect(profile).toBeDefined();
    expect(profile.profileId).toBe(`upsert-new-${TEST_PREFIX}`);
    expect(profile.apiKey).toBe("upsert-new-key");
    expect(profile.createdBy).toBe("admin-1");

    // 清理
    await repo.delete(profile.id);
  });

  it("upsertSystemProfile 更新已有系统 profile", async () => {
    // 先创建
    await repo.upsertSystemProfile(
      `upsert-exist-${TEST_PREFIX}`,
      {
        provider: "anthropic",
        credentialMode: "api_key",
        apiKey: "old-key",
      },
      "admin-1",
    );

    // 再 upsert（更新）
    const updated = await repo.upsertSystemProfile(
      `upsert-exist-${TEST_PREFIX}`,
      {
        provider: "anthropic",
        credentialMode: "api_key",
        apiKey: "updated-key",
        priority: 5,
      },
      "admin-2",
    );

    expect(updated.apiKey).toBe("updated-key");
    expect(updated.priority).toBe(5);
    expect(updated.updatedBy).toBe("admin-2");

    // 清理
    await repo.delete(updated.id);
  });
});

// ---------------------------------------------------------------------------
// AuthProfileOrderRepository Tests
// ---------------------------------------------------------------------------

describe("AuthProfileOrderRepository (集成测试)", () => {
  let db: Database;
  let orderRepo: AuthProfileOrderRepository;

  beforeAll(async () => {
    db = getDatabase();
    orderRepo = new AuthProfileOrderRepository(db);
    // 测试用户已在上一个 describe 中创建
    // 但如果只运行这个 describe，也需要创建
    try {
      await createTestUsers(db);
    } catch {
      // 用户可能已存在（唯一约束），忽略
    }
  });

  afterEach(async () => {
    await cleanupTestData(db);
  });

  afterAll(async () => {
    await cleanupTestData(db);
    await cleanupTestUsers(db);
  });

  it("upsertSystemOrder 创建默认 agent 排序", async () => {
    const order = await orderRepo.upsertSystemOrder(
      "default",
      [`profile-a-${TEST_PREFIX}`, `profile-b-${TEST_PREFIX}`],
      "admin-1",
    );

    expect(order).toBeDefined();
    expect(order.agentKey).toBe("default");
    expect(order.profileIds).toEqual([`profile-a-${TEST_PREFIX}`, `profile-b-${TEST_PREFIX}`]);
    expect(order.configType).toBe("system");

    // 清理
    await db.delete(authProfileOrder).where(like(authProfileOrder.id, order.id));
  });

  it("upsertSystemOrder 更新已有排序", async () => {
    // 先创建
    const created = await orderRepo.upsertSystemOrder(
      `agent-x-${TEST_PREFIX}`,
      ["a", "b"],
      "admin-1",
    );

    // 再更新
    const updated = await orderRepo.upsertSystemOrder(
      `agent-x-${TEST_PREFIX}`,
      ["b", "a", "c"],
      "admin-2",
    );

    expect(updated.profileIds).toEqual(["b", "a", "c"]);
    expect(updated.updatedBy).toBe("admin-2");
    expect(updated.id).toBe(created.id);

    // 清理
    await db.delete(authProfileOrder).where(like(authProfileOrder.id, created.id));
  });

  it("getEffectiveOrder 租户覆盖系统排序", async () => {
    const userId = TEST_USER_IDS[3]!;
    const agentKey = `order-agent-${TEST_PREFIX}`;

    // 系统排序
    const sysOrder = await orderRepo.upsertSystemOrder(agentKey, ["sys-a", "sys-b"], "admin-1");

    // 租户覆盖
    const tenantOrder = await orderRepo.upsertTenantOrder(
      userId,
      agentKey,
      ["tenant-a", "tenant-b", "tenant-c"],
      "user-1",
    );

    const effective = await orderRepo.getEffectiveOrder(agentKey, userId);
    expect(effective).not.toBeNull();
    expect(effective!.profileIds).toEqual(["tenant-a", "tenant-b", "tenant-c"]);

    // 清理
    await db.delete(authProfileOrder).where(like(authProfileOrder.id, sysOrder.id));
    await db.delete(authProfileOrder).where(like(authProfileOrder.id, tenantOrder.id));
  });

  it("getEffectiveOrder 无租户时使用系统排序", async () => {
    const agentKey = `order-sys-only-${TEST_PREFIX}`;

    const sysOrder = await orderRepo.upsertSystemOrder(agentKey, ["a", "b"], "admin-1");

    const effective = await orderRepo.getEffectiveOrder(agentKey);
    expect(effective).not.toBeNull();
    expect(effective!.profileIds).toEqual(["a", "b"]);

    // 清理
    await db.delete(authProfileOrder).where(like(authProfileOrder.id, sysOrder.id));
  });

  it("listEffectiveOrders 合并系统和租户排序", async () => {
    const userId = TEST_USER_IDS[4]!;

    // 系统排序
    const sys1 = await orderRepo.upsertSystemOrder(`lo-agent1-${TEST_PREFIX}`, ["a"], "admin-1");
    const sys2 = await orderRepo.upsertSystemOrder(`lo-agent2-${TEST_PREFIX}`, ["b"], "admin-1");

    // 租户覆盖 agent1
    const ten1 = await orderRepo.upsertTenantOrder(
      userId,
      `lo-agent1-${TEST_PREFIX}`,
      ["c", "d"],
      "user-1",
    );

    const orders = await orderRepo.listEffectiveOrders(userId);

    // agent1 应该被租户覆盖
    const agent1Order = orders.find((o) => o.agentKey === `lo-agent1-${TEST_PREFIX}`);
    expect(agent1Order).toBeDefined();
    expect(agent1Order!.profileIds).toEqual(["c", "d"]);

    // agent2 保持系统配置
    const agent2Order = orders.find((o) => o.agentKey === `lo-agent2-${TEST_PREFIX}`);
    expect(agent2Order).toBeDefined();
    expect(agent2Order!.profileIds).toEqual(["b"]);

    // 清理
    for (const id of [sys1.id, sys2.id, ten1.id]) {
      await db.delete(authProfileOrder).where(like(authProfileOrder.id, id));
    }
  });

  it("delete 删除指定排序", async () => {
    const order = await orderRepo.upsertSystemOrder(`del-agent-${TEST_PREFIX}`, ["a"], "admin-1");

    const deleted = await orderRepo.delete(order.id);
    expect(deleted).toBe(true);

    const effective = await orderRepo.getEffectiveOrder(`del-agent-${TEST_PREFIX}`);
    expect(effective).toBeNull();
  });
});
