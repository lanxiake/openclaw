/**
 * Milvus 向量存储服务测试
 *
 * 使用 Mock MilvusClient 测试向量 CRUD 和搜索功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MilvusClient } from "@zilliz/milvus2-sdk-node";

import { enableMilvusMock, disableMilvusMock } from "./connection.js";
import {
  ensureCollection,
  upsertVector,
  batchUpsert,
  deleteVector,
  batchDelete,
  search,
  getCollectionStats,
  COLLECTION_NAME,
  VECTOR_DIM,
} from "./vector-store.js";

/**
 * 创建 Mock MilvusClient
 */
function createMockClient(): MilvusClient & {
  _calls: Record<string, unknown[][]>;
} {
  const calls: Record<string, unknown[][]> = {};

  const track = (method: string) => {
    calls[method] = calls[method] ?? [];
    return (...args: unknown[]) => {
      calls[method].push(args);
    };
  };

  return {
    _calls: calls,
    hasCollection: vi.fn().mockResolvedValue({ value: false }),
    createCollection: vi.fn().mockImplementation((...args: unknown[]) => {
      track("createCollection")(...args);
      return Promise.resolve({});
    }),
    createIndex: vi.fn().mockResolvedValue({}),
    loadCollection: vi.fn().mockResolvedValue({}),
    upsert: vi.fn().mockResolvedValue({ succ_count: 1 }),
    delete: vi.fn().mockResolvedValue({}),
    search: vi.fn().mockResolvedValue({ results: [] }),
    getCollectionStatistics: vi.fn().mockResolvedValue({ data: { row_count: "0" } }),
    dropCollection: vi.fn().mockResolvedValue({}),
    checkHealth: vi.fn().mockResolvedValue({ isHealthy: true }),
    closeConnection: vi.fn().mockResolvedValue({}),
  } as unknown as MilvusClient & { _calls: Record<string, unknown[][]> };
}

describe("Milvus Vector Store", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    enableMilvusMock(mockClient as unknown as MilvusClient);
  });

  afterEach(() => {
    disableMilvusMock();
  });

  describe("ensureCollection", () => {
    it("MILVUS-STORE-001: Collection 不存在时应该创建", async () => {
      (mockClient.hasCollection as ReturnType<typeof vi.fn>).mockResolvedValue({
        value: false,
      });

      await ensureCollection();

      expect(mockClient.hasCollection).toHaveBeenCalledWith({
        collection_name: COLLECTION_NAME,
      });
      expect(mockClient.createCollection).toHaveBeenCalled();
      expect(mockClient.createIndex).toHaveBeenCalled();
      expect(mockClient.loadCollection).toHaveBeenCalled();
    });

    it("MILVUS-STORE-002: Collection 已存在时应该跳过创建", async () => {
      (mockClient.hasCollection as ReturnType<typeof vi.fn>).mockResolvedValue({
        value: true,
      });

      await ensureCollection();

      expect(mockClient.hasCollection).toHaveBeenCalled();
      expect(mockClient.createCollection).not.toHaveBeenCalled();
    });
  });

  describe("upsertVector", () => {
    it("MILVUS-STORE-003: 应该正确插入向量", async () => {
      const embedding = new Array(VECTOR_DIM).fill(0.1);

      await upsertVector({
        id: "mem-001",
        userId: "user-123",
        embedding,
        memoryType: "episodic",
        isActive: true,
      });

      expect(mockClient.upsert).toHaveBeenCalledWith({
        collection_name: COLLECTION_NAME,
        data: [
          {
            id: "mem-001",
            user_id: "user-123",
            embedding,
            memory_type: "episodic",
            is_active: true,
          },
        ],
      });
    });
  });

  describe("batchUpsert", () => {
    it("MILVUS-STORE-004: 应该批量插入向量", async () => {
      const embedding = new Array(VECTOR_DIM).fill(0.2);

      await batchUpsert([
        {
          id: "mem-001",
          userId: "user-123",
          embedding,
          memoryType: "fact",
          isActive: true,
        },
        {
          id: "mem-002",
          userId: "user-123",
          embedding,
          memoryType: "preference",
          isActive: true,
        },
      ]);

      expect(mockClient.upsert).toHaveBeenCalledTimes(1);
      const callArgs = (mockClient.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.data).toHaveLength(2);
    });

    it("MILVUS-STORE-005: 空数组不应该调用 upsert", async () => {
      await batchUpsert([]);

      expect(mockClient.upsert).not.toHaveBeenCalled();
    });
  });

  describe("deleteVector", () => {
    it("MILVUS-STORE-006: 应该按 ID 删除向量", async () => {
      await deleteVector("mem-001");

      expect(mockClient.delete).toHaveBeenCalledWith({
        collection_name: COLLECTION_NAME,
        filter: 'id == "mem-001"',
      });
    });
  });

  describe("batchDelete", () => {
    it("MILVUS-STORE-007: 应该批量删除向量", async () => {
      await batchDelete(["mem-001", "mem-002"]);

      expect(mockClient.delete).toHaveBeenCalledWith({
        collection_name: COLLECTION_NAME,
        filter: 'id in ["mem-001", "mem-002"]',
      });
    });

    it("MILVUS-STORE-008: 空数组不应该调用 delete", async () => {
      await batchDelete([]);

      expect(mockClient.delete).not.toHaveBeenCalled();
    });
  });

  describe("search", () => {
    it("MILVUS-STORE-009: 应该返回搜索结果", async () => {
      const queryVector = new Array(VECTOR_DIM).fill(0.5);

      (mockClient.search as ReturnType<typeof vi.fn>).mockResolvedValue({
        results: [
          { id: "mem-001", score: 0.95 },
          { id: "mem-002", score: 0.8 },
        ],
      });

      const results = await search(queryVector, "user-123", { limit: 5 });

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("mem-001");
      expect(results[0].score).toBe(0.95);
      expect(results[1].id).toBe("mem-002");
    });

    it("MILVUS-STORE-010: 应该按 userId 过滤", async () => {
      const queryVector = new Array(VECTOR_DIM).fill(0.5);

      (mockClient.search as ReturnType<typeof vi.fn>).mockResolvedValue({
        results: [],
      });

      await search(queryVector, "user-456");

      const callArgs = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.filter).toContain('user_id == "user-456"');
    });

    it("MILVUS-STORE-011: 应该按 memoryType 过滤", async () => {
      const queryVector = new Array(VECTOR_DIM).fill(0.5);

      (mockClient.search as ReturnType<typeof vi.fn>).mockResolvedValue({
        results: [],
      });

      await search(queryVector, "user-123", { memoryType: "fact" });

      const callArgs = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.filter).toContain('memory_type == "fact"');
    });

    it("MILVUS-STORE-012: 默认只搜索活跃记忆", async () => {
      const queryVector = new Array(VECTOR_DIM).fill(0.5);

      (mockClient.search as ReturnType<typeof vi.fn>).mockResolvedValue({
        results: [],
      });

      await search(queryVector, "user-123");

      const callArgs = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.filter).toContain("is_active == true");
    });

    it("MILVUS-STORE-013: minScore 应该过滤低分结果", async () => {
      const queryVector = new Array(VECTOR_DIM).fill(0.5);

      (mockClient.search as ReturnType<typeof vi.fn>).mockResolvedValue({
        results: [
          { id: "mem-001", score: 0.9 },
          { id: "mem-002", score: 0.3 },
        ],
      });

      const results = await search(queryVector, "user-123", {
        minScore: 0.5,
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("mem-001");
    });

    it("MILVUS-STORE-014: 无结果时返回空数组", async () => {
      const queryVector = new Array(VECTOR_DIM).fill(0.5);

      (mockClient.search as ReturnType<typeof vi.fn>).mockResolvedValue({
        results: [],
      });

      const results = await search(queryVector, "user-123");

      expect(results).toEqual([]);
    });
  });

  describe("getCollectionStats", () => {
    it("MILVUS-STORE-015: 应该返回行数统计", async () => {
      (mockClient.getCollectionStatistics as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { row_count: "12345" },
      });

      const stats = await getCollectionStats();

      expect(stats.rowCount).toBe(12345);
    });
  });

  describe("constants", () => {
    it("MILVUS-STORE-016: VECTOR_DIM 应该是 1024", () => {
      expect(VECTOR_DIM).toBe(1024);
    });

    it("MILVUS-STORE-017: COLLECTION_NAME 应该是 mtbot_memories", () => {
      expect(COLLECTION_NAME).toBe("mtbot_memories");
    });
  });
});
