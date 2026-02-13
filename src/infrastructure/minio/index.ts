/**
 * MinIO 基础设施模块
 *
 * 导出 MinIO 连接和文件服务功能
 */

// 连接管理
export {
  type MinioConfig,
  BUCKETS,
  type BucketName,
  getMinioConfigFromEnv,
  createMinioClient,
  getMinio,
  minioHealthCheck,
  ensureBucketExists,
  initializeBuckets,
  resetMinioConnection,
  getPresignedPutUrl,
  getPresignedGetUrl,
} from "./connection.js";

// 文件服务
export {
  type FileMetadata,
  type UploadResult,
  type FileInfo,
  generateStorageKey,
  uploadFile,
  uploadFileFromStream,
  downloadFile,
  downloadFileAsStream,
  deleteFile,
  deleteFiles,
  getFileInfo,
  fileExists,
  listUserFiles,
  copyFile,
  getUploadUrl,
  getDownloadUrl,
  deleteAllUserFiles,
} from "./file-service.js";
