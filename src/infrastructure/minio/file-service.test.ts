/**
 * MinIO 文件服务模块测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock MinIO 连接
const mockMinioClient = {
  putObject: vi.fn().mockResolvedValue({ etag: "test-etag" }),
  getObject: vi.fn(),
  removeObject: vi.fn().mockResolvedValue(undefined),
  removeObjects: vi.fn().mockResolvedValue(undefined),
  statObject: vi.fn(),
  listObjects: vi.fn(),
  copyObject: vi.fn().mockResolvedValue(undefined),
};

vi.mock("./connection.js", () => ({
  getMinio: () => mockMinioClient,
  BUCKETS: {
    FILES: "openclaw-files",
    MEDIA: "openclaw-media",
    TEMP: "openclaw-temp",
  },
  getPresignedPutUrl: vi.fn().mockResolvedValue("https://example.com/upload"),
  getPresignedGetUrl: vi.fn().mockResolvedValue("https://example.com/download"),
}));

vi.mock("../../logging/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  generateStorageKey,
  uploadFile,
  deleteFile,
  deleteFiles,
  getFileInfo,
  fileExists,
  getUploadUrl,
  getDownloadUrl,
  type FileMetadata,
} from "./file-service.js";

describe("File Service", () => {
  const testMetadata: FileMetadata = {
    originalName: "test.txt",
    contentType: "text/plain",
    size: 1024,
    userId: "user-123",
    uploadedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateStorageKey", () => {
    it("应该生成包含用户 ID 的存储键", () => {
      const key = generateStorageKey("user-123", "test.txt");

      expect(key).toContain("user-123/");
      expect(key).toContain("test.txt");
    });

    it("应该生成包含分类的存储键", () => {
      const key = generateStorageKey("user-123", "test.txt", "documents");

      expect(key).toContain("user-123/documents/");
      expect(key).toContain("test.txt");
    });

    it("应该清理不安全的文件名字符", () => {
      const key = generateStorageKey("user-123", "test file<>.txt");

      expect(key).not.toContain("<");
      expect(key).not.toContain(">");
      expect(key).not.toContain(" ");
    });
  });

  describe("uploadFile", () => {
    it("应该上传文件并返回结果", async () => {
      const buffer = Buffer.from("test content");

      const result = await uploadFile("openclaw-files", "test/file.txt", buffer, testMetadata);

      expect(result.bucket).toBe("openclaw-files");
      expect(result.key).toBe("test/file.txt");
      expect(result.etag).toBe("test-etag");
      expect(result.size).toBe(buffer.length);
      expect(mockMinioClient.putObject).toHaveBeenCalled();
    });
  });

  describe("deleteFile", () => {
    it("应该删除文件", async () => {
      await deleteFile("openclaw-files", "test/file.txt");

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith("openclaw-files", "test/file.txt");
    });
  });

  describe("deleteFiles", () => {
    it("应该批量删除文件", async () => {
      const keys = ["file1.txt", "file2.txt", "file3.txt"];

      await deleteFiles("openclaw-files", keys);

      expect(mockMinioClient.removeObjects).toHaveBeenCalledWith("openclaw-files", keys);
    });
  });

  describe("getFileInfo", () => {
    it("应该返回文件信息", async () => {
      mockMinioClient.statObject.mockResolvedValue({
        size: 1024,
        lastModified: new Date(),
        etag: "test-etag",
        metaData: {
          "x-amz-meta-original-name": "test.txt",
          "content-type": "text/plain",
          "x-amz-meta-user-id": "user-123",
          "x-amz-meta-uploaded-at": new Date().toISOString(),
        },
      });

      const info = await getFileInfo("openclaw-files", "test/file.txt");

      expect(info).not.toBeNull();
      expect(info!.key).toBe("test/file.txt");
      expect(info!.size).toBe(1024);
      expect(info!.etag).toBe("test-etag");
    });

    it("文件不存在时应返回 null", async () => {
      mockMinioClient.statObject.mockRejectedValue({ code: "NotFound" });

      const info = await getFileInfo("openclaw-files", "non-existent.txt");

      expect(info).toBeNull();
    });
  });

  describe("fileExists", () => {
    it("文件存在时应返回 true", async () => {
      mockMinioClient.statObject.mockResolvedValue({
        size: 1024,
        lastModified: new Date(),
        etag: "test-etag",
      });

      const exists = await fileExists("openclaw-files", "test/file.txt");

      expect(exists).toBe(true);
    });

    it("文件不存在时应返回 false", async () => {
      mockMinioClient.statObject.mockRejectedValue({ code: "NotFound" });

      const exists = await fileExists("openclaw-files", "non-existent.txt");

      expect(exists).toBe(false);
    });
  });

  describe("getUploadUrl", () => {
    it("应该返回上传预签名 URL", async () => {
      const url = await getUploadUrl("openclaw-files", "test/file.txt");

      expect(url).toBe("https://example.com/upload");
    });
  });

  describe("getDownloadUrl", () => {
    it("应该返回下载预签名 URL", async () => {
      const url = await getDownloadUrl("openclaw-files", "test/file.txt");

      expect(url).toBe("https://example.com/download");
    });
  });
});
