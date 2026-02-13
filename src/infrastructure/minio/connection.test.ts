/**
 * MinIO 连接模块测试
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

describe("MinIO Connection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 设置环境变量
    process.env["MINIO_ENDPOINT"] = "localhost";
    process.env["MINIO_PORT"] = "9000";
    process.env["MINIO_ACCESS_KEY"] = "test_access";
    process.env["MINIO_SECRET_KEY"] = "test_secret";
  });

  afterEach(() => {
    delete process.env["MINIO_ENDPOINT"];
    delete process.env["MINIO_PORT"];
    delete process.env["MINIO_ACCESS_KEY"];
    delete process.env["MINIO_SECRET_KEY"];
  });

  describe("getMinioConfigFromEnv", () => {
    it("应该从环境变量读取配置", async () => {
      const { getMinioConfigFromEnv } = await import("./connection.js");
      const config = getMinioConfigFromEnv();

      expect(config.endPoint).toBe("localhost");
      expect(config.port).toBe(9000);
      expect(config.accessKey).toBe("test_access");
      expect(config.secretKey).toBe("test_secret");
      expect(config.useSSL).toBe(false);
    });

    it("应该使用默认值", async () => {
      delete process.env["MINIO_ENDPOINT"];
      delete process.env["MINIO_PORT"];

      const { getMinioConfigFromEnv } = await import("./connection.js");
      const config = getMinioConfigFromEnv();

      expect(config.endPoint).toBe("localhost");
      expect(config.port).toBe(9000);
    });
  });

  describe("BUCKETS", () => {
    it("应该定义预设存储桶", async () => {
      const { BUCKETS } = await import("./connection.js");

      expect(BUCKETS.FILES).toBe("openclaw-files");
      expect(BUCKETS.MEDIA).toBe("openclaw-media");
      expect(BUCKETS.TEMP).toBe("openclaw-temp");
    });
  });
});
