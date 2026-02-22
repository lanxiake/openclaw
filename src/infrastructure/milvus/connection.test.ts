/**
 * Milvus 连接模块测试
 *
 * 测试连接管理、Mock 模式、健康检查等功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMilvusConfigFromEnv,
  getMilvus,
  enableMilvusMock,
  disableMilvusMock,
  isMilvusConnected,
  resetMilvusConnection,
} from "./connection.js";

describe("Milvus Connection", () => {
  beforeEach(() => {
    disableMilvusMock();
  });

  afterEach(async () => {
    disableMilvusMock();
    await resetMilvusConnection();
  });

  describe("getMilvusConfigFromEnv", () => {
    it("MILVUS-CONN-001: 应该返回默认配置", () => {
      const originalAddress = process.env["MILVUS_ADDRESS"];
      delete process.env["MILVUS_ADDRESS"];

      const config = getMilvusConfigFromEnv();

      expect(config.address).toBe("localhost:19530");
      expect(config.database).toBe("default");
      expect(config.connectTimeoutMs).toBe(10000);

      if (originalAddress) {
        process.env["MILVUS_ADDRESS"] = originalAddress;
      }
    });

    it("MILVUS-CONN-002: 应该从环境变量读取配置", () => {
      const original = process.env["MILVUS_ADDRESS"];
      process.env["MILVUS_ADDRESS"] = "10.0.0.1:19530";

      const config = getMilvusConfigFromEnv();

      expect(config.address).toBe("10.0.0.1:19530");

      if (original) {
        process.env["MILVUS_ADDRESS"] = original;
      } else {
        delete process.env["MILVUS_ADDRESS"];
      }
    });
  });

  describe("Mock mode", () => {
    it("MILVUS-CONN-003: Mock 模式应该返回 Mock 客户端", () => {
      const mockClient = {
        checkHealth: vi.fn(),
      } as unknown as import("@zilliz/milvus2-sdk-node").MilvusClient;

      enableMilvusMock(mockClient);

      const client = getMilvus();
      expect(client).toBe(mockClient);
    });

    it("MILVUS-CONN-004: 禁用 Mock 后不再返回 Mock 客户端", () => {
      const mockClient = {
        checkHealth: vi.fn(),
      } as unknown as import("@zilliz/milvus2-sdk-node").MilvusClient;

      enableMilvusMock(mockClient);
      disableMilvusMock();

      // getMilvus() 此时会创建真实连接，不再返回 mock
      // 这里只验证 isMilvusConnected 状态
      expect(isMilvusConnected()).toBe(false);
    });

    it("MILVUS-CONN-005: isMilvusConnected 在 Mock 模式下返回 true", () => {
      const mockClient = {} as import("@zilliz/milvus2-sdk-node").MilvusClient;

      expect(isMilvusConnected()).toBe(false);

      enableMilvusMock(mockClient);
      expect(isMilvusConnected()).toBe(true);

      disableMilvusMock();
      expect(isMilvusConnected()).toBe(false);
    });
  });
});
