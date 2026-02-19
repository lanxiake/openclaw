/**
 * 技能存储服务
 *
 * 提供技能包、图标、manifest 文件的上传、下载和管理功能
 * 使用 MinIO 作为底层存储
 */

import { Readable } from "node:stream";
import { getLogger } from "../../logging/logger.js";
import {
  uploadFile,
  downloadFile,
  downloadFileAsStream,
  deleteFile,
  getFileInfo,
  generateStorageKey,
  type FileMetadata,
  type UploadResult,
} from "../../infrastructure/minio/file-service.js";
import { BUCKETS } from "../../infrastructure/minio/connection.js";

const logger = getLogger();
const LOG_TAG = "[SkillStorageService]";

/**
 * 技能文件类型
 */
export type SkillFileType = "package" | "icon" | "manifest";

/**
 * 技能文件上传参数
 */
export interface SkillFileUploadParams {
  /** 技能 ID */
  skillId: string;
  /** 文件类型 */
  fileType: SkillFileType;
  /** 文件数据 */
  data: Buffer;
  /** 原始文件名 */
  originalName: string;
  /** MIME 类型 */
  contentType: string;
  /** 上传用户 ID */
  userId: string;
}

/**
 * 技能文件信息
 */
export interface SkillFileInfo {
  /** 存储桶 */
  bucket: string;
  /** 存储键 */
  key: string;
  /** 访问 URL */
  url: string;
  /** 文件大小 */
  size: number;
  /** ETag */
  etag: string;
}

/**
 * 生成技能文件的存储键
 *
 * @param skillId 技能 ID
 * @param fileType 文件类型
 * @param filename 文件名
 * @returns 存储键
 */
function generateSkillStorageKey(
  skillId: string,
  fileType: SkillFileType,
  filename: string,
): string {
  const timestamp = Date.now();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  // 技能文件按类型分类存储
  // skills/{skillId}/{fileType}/{timestamp}-{filename}
  return `skills/${skillId}/${fileType}/${timestamp}-${safeFilename}`;
}

/**
 * 上传技能文件
 *
 * @param params 上传参数
 * @returns 上传结果
 */
export async function uploadSkillFile(params: SkillFileUploadParams): Promise<SkillFileInfo> {
  const { skillId, fileType, data, originalName, contentType, userId } = params;

  logger.info(`${LOG_TAG} 上传技能文件`, {
    skillId,
    fileType,
    originalName,
    size: data.length,
  });

  // 生成存储键
  const key = generateSkillStorageKey(skillId, fileType, originalName);

  // 准备元数据
  const metadata: FileMetadata = {
    originalName,
    contentType,
    size: data.length,
    userId,
    uploadedAt: new Date().toISOString(),
    custom: {
      skillId,
      fileType,
    },
  };

  // 上传到 MinIO
  const result = await uploadFile(BUCKETS.SKILLS, key, data, metadata);

  logger.info(`${LOG_TAG} 技能文件上传成功`, {
    skillId,
    fileType,
    key: result.key,
    size: result.size,
  });

  return {
    bucket: result.bucket,
    key: result.key,
    url: result.url || `/${BUCKETS.SKILLS}/${result.key}`,
    size: result.size,
    etag: result.etag,
  };
}

/**
 * 下载技能文件
 *
 * @param key 存储键
 * @returns 文件数据流
 */
export async function downloadSkillFile(key: string): Promise<Readable> {
  logger.info(`${LOG_TAG} 下载技能文件`, { key });

  const stream = await downloadFileAsStream(BUCKETS.SKILLS, key);

  logger.info(`${LOG_TAG} 技能文件下载成功`, { key });

  return stream;
}

/**
 * 删除技能文件
 *
 * @param key 存储键
 */
export async function deleteSkillFile(key: string): Promise<void> {
  logger.info(`${LOG_TAG} 删除技能文件`, { key });

  await deleteFile(BUCKETS.SKILLS, key);

  logger.info(`${LOG_TAG} 技能文件删除成功`, { key });
}

/**
 * 删除技能的所有文件
 *
 * @param skillId 技能 ID
 */
export async function deleteAllSkillFiles(skillId: string): Promise<void> {
  logger.info(`${LOG_TAG} 删除技能所有文件`, { skillId });

  // 删除技能包
  try {
    const packageKey = `skills/${skillId}/package/`;
    await deleteFile(BUCKETS.SKILLS, packageKey);
  } catch (error) {
    logger.warn(`${LOG_TAG} 删除技能包失败（可能不存在）`, { skillId, error });
  }

  // 删除图标
  try {
    const iconKey = `skills/${skillId}/icon/`;
    await deleteFile(BUCKETS.SKILLS, iconKey);
  } catch (error) {
    logger.warn(`${LOG_TAG} 删除图标失败（可能不存在）`, { skillId, error });
  }

  // 删除 manifest
  try {
    const manifestKey = `skills/${skillId}/manifest/`;
    await deleteFile(BUCKETS.SKILLS, manifestKey);
  } catch (error) {
    logger.warn(`${LOG_TAG} 删除 manifest 失败（可能不存在）`, { skillId, error });
  }

  logger.info(`${LOG_TAG} 技能所有文件删除完成`, { skillId });
}

/**
 * 获取技能文件信息
 *
 * @param key 存储键
 * @returns 文件信息
 */
export async function getSkillFileInfo(key: string): Promise<SkillFileInfo | null> {
  logger.info(`${LOG_TAG} 获取技能文件信息`, { key });

  try {
    const info = await getFileInfo(BUCKETS.SKILLS, key);

    if (!info) {
      logger.warn(`${LOG_TAG} 文件信息不存在`, { key });
      return null;
    }

    return {
      bucket: BUCKETS.SKILLS,
      key: info.key,
      url: `/${BUCKETS.SKILLS}/${info.key}`,
      size: info.size,
      etag: info.etag,
    };
  } catch (error) {
    logger.warn(`${LOG_TAG} 获取技能文件信息失败`, { key, error });
    return null;
  }
}

/**
 * 从 URL 提取存储键
 *
 * @param url 文件 URL
 * @returns 存储键，如果 URL 无效则返回 null
 */
export function extractKeyFromUrl(url: string): string | null {
  // URL 格式: /skills/{key} 或 http://host/skills/{key}
  const match = url.match(/\/skills\/(.+)$/);
  return match ? match[1] : null;
}
