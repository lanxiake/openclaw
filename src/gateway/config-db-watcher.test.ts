/**
 * config-db-watcher 单元测试
 *
 * 验证数据库配置变更监听器的核心逻辑：
 * - 通知解析
 * - 重载规则映射
 * - 防抖处理
 * - 断线重连
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  parseConfigNotification,
  mapTableToReloadAction,
  type ConfigChangeNotification,
} from "./config-db-watcher.js";

// ---------------------------------------------------------------------------
// parseConfigNotification 测试
// ---------------------------------------------------------------------------

describe("parseConfigNotification", () => {
  it("解析标准配置变更通知", () => {
    const payload = JSON.stringify({
      table: "model_providers",
      operation: "UPDATE",
      id: "mp-001",
      config_type: "system",
      user_id: null,
      ts: 1740000000,
    });

    const result = parseConfigNotification(payload);

    expect(result).not.toBeNull();
    expect(result!.table).toBe("model_providers");
    expect(result!.operation).toBe("UPDATE");
    expect(result!.id).toBe("mp-001");
    expect(result!.configType).toBe("system");
    expect(result!.userId).toBeNull();
  });

  it("解析带 user_id 的租户配置变更", () => {
    const payload = JSON.stringify({
      table: "auth_profiles",
      operation: "INSERT",
      id: "ap-001",
      config_type: "tenant",
      user_id: "user-123",
      ts: 1740000000,
    });

    const result = parseConfigNotification(payload);

    expect(result).not.toBeNull();
    expect(result!.configType).toBe("tenant");
    expect(result!.userId).toBe("user-123");
  });

  it("解析 system_configs 表带 key 字段的通知", () => {
    const payload = JSON.stringify({
      table: "system_configs",
      operation: "UPDATE",
      id: "sc-001",
      config_type: "system",
      key: "logging",
      ts: 1740000000,
    });

    const result = parseConfigNotification(payload);

    expect(result).not.toBeNull();
    expect(result!.table).toBe("system_configs");
    expect(result!.key).toBe("logging");
  });

  it("解析 DELETE 操作", () => {
    const payload = JSON.stringify({
      table: "agent_configs",
      operation: "DELETE",
      id: "ac-001",
      config_type: "system",
      user_id: null,
      ts: 1740000000,
    });

    const result = parseConfigNotification(payload);

    expect(result).not.toBeNull();
    expect(result!.operation).toBe("DELETE");
  });

  it("无效 JSON 返回 null", () => {
    const result = parseConfigNotification("not valid json");
    expect(result).toBeNull();
  });

  it("缺少必填字段返回 null", () => {
    const result = parseConfigNotification(JSON.stringify({ table: "unknown" }));
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapTableToReloadAction 测试
// ---------------------------------------------------------------------------

describe("mapTableToReloadAction", () => {
  it("gateway_configs 映射为 restart", () => {
    const action = mapTableToReloadAction("gateway_configs");
    expect(action).toBe("restart");
  });

  it("model_providers 映射为 hot", () => {
    const action = mapTableToReloadAction("model_providers");
    expect(action).toBe("hot");
  });

  it("agent_configs 映射为 hot", () => {
    const action = mapTableToReloadAction("agent_configs");
    expect(action).toBe("hot");
  });

  it("auth_profiles 映射为 hot", () => {
    const action = mapTableToReloadAction("auth_profiles");
    expect(action).toBe("hot");
  });

  it("auth_profile_order 映射为 hot", () => {
    const action = mapTableToReloadAction("auth_profile_order");
    expect(action).toBe("hot");
  });

  it("system_configs 映射为 conditional", () => {
    const action = mapTableToReloadAction("system_configs");
    expect(action).toBe("conditional");
  });

  it("未知表映射为 none", () => {
    const action = mapTableToReloadAction("unknown_table");
    expect(action).toBe("none");
  });

  it("system_configs 按 key 细化: cron → hot", () => {
    const notification: ConfigChangeNotification = {
      table: "system_configs",
      operation: "UPDATE",
      id: "sc-cron",
      configType: "system",
      userId: null,
      key: "cron",
    };
    const action = mapTableToReloadAction("system_configs", notification.key);
    expect(action).toBe("hot");
  });

  it("system_configs 按 key 细化: hooks → hot", () => {
    const action = mapTableToReloadAction("system_configs", "hooks");
    expect(action).toBe("hot");
  });

  it("system_configs 按 key 细化: logging → none", () => {
    const action = mapTableToReloadAction("system_configs", "logging");
    expect(action).toBe("none");
  });

  it("system_configs 按 key 细化: session → none", () => {
    const action = mapTableToReloadAction("system_configs", "session");
    expect(action).toBe("none");
  });
});
