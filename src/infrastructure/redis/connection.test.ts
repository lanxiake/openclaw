/**
 * Redis 连接模块测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock logger
vi.mock("../../logging/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("Redis Connection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 设置环境变量
    process.env["REDIS_HOST"] = "localhost";
    process.env["REDIS_PORT"] = "6379";
    process.env["REDIS_PASSWORD"] = "test_password";
  });

  afterEach(() => {
    delete process.env["REDIS_HOST"];
    delete process.env["REDIS_PORT"];
    delete process.env["REDIS_PASSWORD"];
  });

  describe("getRedisConfigFromEnv", () => {
    it("应该从环境变量读取配置", async () => {
      const { getRedisConfigFromEnv } = await import("./connection.js");
      const config = getRedisConfigFromEnv();

      expect(config.host).toBe("localhost");
      expect(config.port).toBe(6379);
      expect(config.password).toBe("test_password");
      expect(config.db).toBe(0);
      expect(config.keyPrefix).toBe("openclaw:");
    });

    it("应该使用默认值", async () => {
      delete process.env["REDIS_HOST"];
      delete process.env["REDIS_PORT"];

      const { getRedisConfigFromEnv } = await import("./connection.js");
      const config = getRedisConfigFromEnv();

      expect(config.host).toBe("localhost");
      expect(config.port).toBe(6379);
    });
  });

  describe("isRedisConnected", () => {
    it("未连接时应返回 false", async () => {
      const { isRedisConnected, resetRedisConnection } = await import("./connection.js");
      await resetRedisConnection();

      expect(isRedisConnected()).toBe(false);
    });
  });

  describe("getRedisStatus", () => {
    it("未连接时应返回 disconnected", async () => {
      const { getRedisStatus, resetRedisConnection } = await import("./connection.js");
      await resetRedisConnection();

      expect(getRedisStatus()).toBe("disconnected");
    });
  });
});
