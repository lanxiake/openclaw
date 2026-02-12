/**
 * FileRepository 测试
 *
 * 测试用户文件元数据的 CRUD 操作、按分类过滤、storageKey 唯一性，以及多租户隔离
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import { FileRepository, getFileRepository } from "./files.js";

// ==================== FileRepository 测试 ====================

describe("FileRepository", () => {
  let fileRepo: FileRepository;
  const testUserId = "user-file-test-001";

  beforeEach(() => {
    console.log("[TEST] ========== FileRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    fileRepo = getFileRepository(db, testUserId);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== FileRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("FILE-CREATE-001: 应该创建文件记录并自动设置 userId", async () => {
      console.log("[TEST] ========== FILE-CREATE-001 ==========");
      console.log("[TEST] 测试创建文件记录");

      const file = await fileRepo.create({
        fileName: "test.pdf",
        fileSize: 1024000,
        mimeType: "application/pdf",
        storageKey: "user-file-test-001/documents/test.pdf",
        storageBucket: "openclaw-media",
      });

      console.log("[TEST] 文件ID:", file.id);
      console.log("[TEST] 文件 userId:", file.userId);
      console.log("[TEST] 文件名:", file.fileName);

      expect(file.id).toBeTruthy();
      expect(file.userId).toBe(testUserId);
      expect(file.fileName).toBe("test.pdf");
      expect(file.fileSize).toBe(1024000);
      expect(file.mimeType).toBe("application/pdf");
      expect(file.storageKey).toBe("user-file-test-001/documents/test.pdf");
      expect(file.storageBucket).toBe("openclaw-media");
      expect(file.category).toBe("attachment");
      expect(file.isPublic).toBe(false);

      console.log("[TEST] ✓ 文件记录创建成功");
    });

    it("FILE-CREATE-002: 应该创建带完整配置的文件记录", async () => {
      console.log("[TEST] ========== FILE-CREATE-002 ==========");
      console.log("[TEST] 测试创建带完整配置的文件记录");

      const file = await fileRepo.create({
        fileName: "avatar.png",
        fileSize: 50000,
        mimeType: "image/png",
        storageKey: "user-file-test-001/avatars/avatar.png",
        storageBucket: "openclaw-media",
        category: "avatar",
        sourceType: "upload",
        thumbnailKey: "user-file-test-001/avatars/avatar_thumb.png",
        checksum: "abc123hash",
        metadata: { width: 200, height: 200 },
        isPublic: true,
      });

      console.log("[TEST] 文件分类:", file.category);
      console.log("[TEST] 来源类型:", file.sourceType);
      console.log("[TEST] 是否公开:", file.isPublic);

      expect(file.category).toBe("avatar");
      expect(file.sourceType).toBe("upload");
      expect(file.thumbnailKey).toBe("user-file-test-001/avatars/avatar_thumb.png");
      expect(file.checksum).toBe("abc123hash");
      expect(file.metadata?.width).toBe(200);
      expect(file.isPublic).toBe(true);

      console.log("[TEST] ✓ 带完整配置的文件记录创建成功");
    });
  });

  describe("findById", () => {
    it("FILE-FIND-001: 应该根据 ID 查找自己的文件", async () => {
      console.log("[TEST] ========== FILE-FIND-001 ==========");
      console.log("[TEST] 测试查找自己的文件");

      const created = await fileRepo.create({
        fileName: "doc.pdf",
        fileSize: 2048,
        mimeType: "application/pdf",
        storageKey: "user-file-test-001/documents/doc.pdf",
        storageBucket: "openclaw-media",
      });

      const found = await fileRepo.findById(created.id);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.fileName).toBe("doc.pdf");

      console.log("[TEST] ✓ 成功查找到自己的文件");
    });

    it("FILE-FIND-002: 不存在的 ID 应该返回 null", async () => {
      console.log("[TEST] ========== FILE-FIND-002 ==========");

      const found = await fileRepo.findById("non-existent-id");

      expect(found).toBeNull();

      console.log("[TEST] ✓ 不存在的文件正确返回 null");
    });
  });

  describe("findByStorageKey", () => {
    it("FILE-FIND-003: 应该根据 storageKey 查找文件", async () => {
      console.log("[TEST] ========== FILE-FIND-003 ==========");
      console.log("[TEST] 测试根据 storageKey 查找文件");

      const storageKey = "user-file-test-001/documents/unique.pdf";
      await fileRepo.create({
        fileName: "unique.pdf",
        fileSize: 5000,
        mimeType: "application/pdf",
        storageKey,
        storageBucket: "openclaw-media",
      });

      const found = await fileRepo.findByStorageKey(storageKey);

      console.log("[TEST] storageKey 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.storageKey).toBe(storageKey);

      console.log("[TEST] ✓ 根据 storageKey 查找成功");
    });
  });

  describe("findAll", () => {
    it("FILE-FIND-004: 应该支持按分类过滤", async () => {
      console.log("[TEST] ========== FILE-FIND-004 ==========");
      console.log("[TEST] 测试按分类过滤");

      await fileRepo.create({
        fileName: "a.pdf",
        fileSize: 100,
        mimeType: "application/pdf",
        storageKey: "k1",
        storageBucket: "b",
        category: "document",
      });
      await fileRepo.create({
        fileName: "b.png",
        fileSize: 200,
        mimeType: "image/png",
        storageKey: "k2",
        storageBucket: "b",
        category: "avatar",
      });
      await fileRepo.create({
        fileName: "c.pdf",
        fileSize: 300,
        mimeType: "application/pdf",
        storageKey: "k3",
        storageBucket: "b",
        category: "document",
      });

      const result = await fileRepo.findAll({ category: "document" });

      console.log("[TEST] 文档分类文件数:", result.files.length);

      expect(result.files.length).toBe(2);
      expect(result.files.every((f) => f.category === "document")).toBe(true);

      console.log("[TEST] ✓ 按分类过滤正常");
    });

    it("FILE-FIND-005: 应该支持分页", async () => {
      console.log("[TEST] ========== FILE-FIND-005 ==========");
      console.log("[TEST] 测试分页功能");

      for (let i = 1; i <= 5; i++) {
        await fileRepo.create({
          fileName: `file${i}.txt`,
          fileSize: i * 100,
          mimeType: "text/plain",
          storageKey: `key-${i}`,
          storageBucket: "b",
        });
      }

      const page1 = await fileRepo.findAll({ limit: 2, offset: 0 });
      const page2 = await fileRepo.findAll({ limit: 2, offset: 2 });

      console.log("[TEST] 第一页数量:", page1.files.length);
      console.log("[TEST] 第二页数量:", page2.files.length);
      console.log("[TEST] 总数:", page1.total);

      expect(page1.files.length).toBe(2);
      expect(page2.files.length).toBe(2);
      expect(page1.total).toBe(5);

      console.log("[TEST] ✓ 分页功能正常");
    });
  });

  describe("delete", () => {
    it("FILE-DELETE-001: 应该删除文件记录", async () => {
      console.log("[TEST] ========== FILE-DELETE-001 ==========");
      console.log("[TEST] 测试删除文件记录");

      const created = await fileRepo.create({
        fileName: "temp.txt",
        fileSize: 50,
        mimeType: "text/plain",
        storageKey: "temp-key",
        storageBucket: "b",
      });

      await fileRepo.delete(created.id);
      const found = await fileRepo.findById(created.id);

      console.log("[TEST] 删除后查找结果:", found);

      expect(found).toBeNull();

      console.log("[TEST] ✓ 文件删除成功");
    });
  });

  describe("tenant isolation", () => {
    it("FILE-TENANT-001: 不同用户的文件应该隔离", async () => {
      console.log("[TEST] ========== FILE-TENANT-001 ==========");
      console.log("[TEST] 测试多租户隔离");

      // 用户 A 创建文件
      const userAFile = await fileRepo.create({
        fileName: "secret.pdf",
        fileSize: 1000,
        mimeType: "application/pdf",
        storageKey: "user-A-secret",
        storageBucket: "b",
      });

      // 切换到用户 B
      const db = getMockDatabase();
      const userBRepo = getFileRepository(db, "user-B-different");

      // 用户 B 尝试查找用户 A 的文件
      const foundByB = await userBRepo.findById(userAFile.id);
      const userBList = await userBRepo.findAll();

      console.log("[TEST] 用户B查找用户A文件结果:", foundByB);
      console.log("[TEST] 用户B的文件列表数量:", userBList.files.length);

      expect(foundByB).toBeNull();
      expect(userBList.files.length).toBe(0);

      console.log("[TEST] ✓ 多租户隔离正常");
    });
  });
});
