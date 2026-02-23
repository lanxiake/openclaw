/**
 * 技能打包器
 *
 * 将技能代码和清单打包为 base64 编码的 tar.gz 格式
 * 附带 SHA-256 校验和用于传输完整性验证
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as tar from "tar";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("skill-packager");

/** 包最大大小限制：10MB */
export const MAX_PACKAGE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * 技能权限声明
 */
export interface SkillPermissions {
  fileSystem?: {
    read?: string[];
    write?: string[];
  };
  network?: {
    allowedHosts?: string[];
    allowAll?: boolean;
  };
  process?: {
    allowedCommands?: string[];
    allowAll?: boolean;
  };
  requireConfirm?: boolean;
}

/**
 * 打包输入：manifest + 代码文件
 */
export interface PackageInput {
  /** 技能清单 */
  manifest: {
    id: string;
    name: string;
    description?: string;
    version: string;
    author?: string;
    entry: string;
    runtime: "typescript" | "javascript" | "python" | "shell";
    permissions?: SkillPermissions;
    category?: string;
  };
  /** 技能代码文件（文件名 → 内容） */
  files: Record<string, string>;
}

/**
 * 打包输出：base64 编码的 tar.gz + SHA-256 哈希
 */
export interface PackageOutput {
  /** base64 编码的 tar.gz */
  packageBase64: string;
  /** 包的 SHA-256 哈希 */
  packageHash: string;
  /** 包大小（字节） */
  packageSize: number;
  /** 清单信息 */
  manifest: PackageInput["manifest"];
}

/**
 * 验证 manifest 必填字段
 *
 * @param manifest - 技能清单
 * @throws 缺少必填字段时抛出错误
 */
function validateManifest(manifest: PackageInput["manifest"]): void {
  if (!manifest.id || !manifest.id.trim()) {
    throw new Error("manifest.id 不能为空");
  }
  if (!manifest.name || !manifest.name.trim()) {
    throw new Error("manifest.name 不能为空");
  }
  if (!manifest.version || !manifest.version.trim()) {
    throw new Error("manifest.version 不能为空");
  }
  if (!manifest.entry || !manifest.entry.trim()) {
    throw new Error("manifest.entry 不能为空");
  }
  if (!manifest.runtime) {
    throw new Error("manifest.runtime 不能为空");
  }
}

/**
 * 打包技能文件为 base64 编码的 tar.gz
 *
 * 流程：
 * 1. 验证 manifest
 * 2. 将文件写入临时目录
 * 3. 生成 skill.json
 * 4. tar.gz 打包
 * 5. 计算 SHA-256 哈希
 * 6. base64 编码
 *
 * @param input - 打包输入（manifest + 代码文件）
 * @param workDir - 临时工作目录
 * @returns 打包输出
 */
export async function packSkill(input: PackageInput, workDir: string): Promise<PackageOutput> {
  validateManifest(input.manifest);

  const skillDir = path.join(workDir, `pack-${input.manifest.id}-${Date.now()}`);
  const archivePath = path.join(workDir, `${input.manifest.id}.tgz`);

  log.info("开始打包技能", {
    skillId: input.manifest.id,
    fileCount: Object.keys(input.files).length,
  });

  try {
    // 1. 创建技能目录
    await fs.mkdir(skillDir, { recursive: true });

    // 2. 检查原始文件总大小（压缩前）
    let totalRawSize = 0;
    for (const content of Object.values(input.files)) {
      totalRawSize += Buffer.byteLength(content, "utf-8");
    }
    if (totalRawSize > MAX_PACKAGE_SIZE_BYTES) {
      throw new Error(
        `原始文件总大小超过限制: ${totalRawSize} bytes > ${MAX_PACKAGE_SIZE_BYTES} bytes (${(MAX_PACKAGE_SIZE_BYTES / 1024 / 1024).toFixed(0)}MB)`,
      );
    }

    // 3. 写入代码文件
    for (const [fileName, content] of Object.entries(input.files)) {
      const filePath = path.join(skillDir, fileName);
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, content, "utf-8");
    }

    // 3. 写入 skill.json
    const manifestContent = JSON.stringify(input.manifest, null, 2);
    await fs.writeFile(path.join(skillDir, "skill.json"), manifestContent, "utf-8");

    // 4. tar.gz 打包
    await tar.c(
      {
        gzip: true,
        file: archivePath,
        cwd: workDir,
      },
      [path.basename(skillDir)],
    );

    // 5. 读取打包文件
    const archiveBuffer = await fs.readFile(archivePath);

    // 6. 检查大小限制
    if (archiveBuffer.length > MAX_PACKAGE_SIZE_BYTES) {
      throw new Error(
        `包大小超过限制: ${archiveBuffer.length} bytes > ${MAX_PACKAGE_SIZE_BYTES} bytes (${(MAX_PACKAGE_SIZE_BYTES / 1024 / 1024).toFixed(0)}MB)`,
      );
    }

    // 7. 计算 SHA-256 哈希
    const packageHash = crypto.createHash("sha256").update(archiveBuffer).digest("hex");

    // 8. base64 编码
    const packageBase64 = archiveBuffer.toString("base64");

    log.info("技能打包完成", {
      skillId: input.manifest.id,
      packageSize: archiveBuffer.length,
      packageHash,
    });

    return {
      packageBase64,
      packageHash,
      packageSize: archiveBuffer.length,
      manifest: input.manifest,
    };
  } finally {
    // 清理临时文件
    await fs.rm(skillDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(archivePath, { force: true }).catch(() => {});
  }
}

/**
 * 校验包完整性
 *
 * 将 base64 包解码后计算 SHA-256，与预期哈希比较
 *
 * @param packageBase64 - base64 编码的包
 * @param expectedHash - 预期的 SHA-256 哈希
 * @returns 是否匹配
 */
export function verifyPackage(packageBase64: string, expectedHash: string): boolean {
  try {
    const buffer = Buffer.from(packageBase64, "base64");
    const actualHash = crypto.createHash("sha256").update(buffer).digest("hex");
    return actualHash === expectedHash;
  } catch (err) {
    log.warn("校验包完整性失败", { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
