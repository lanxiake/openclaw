/**
 * 系统清理器技能 - System Cleaner Skill
 *
 * 清理 Windows 系统中的临时文件、缓存和垃圾文件，释放磁盘空间
 * 支持预览模式，在实际删除前查看清理计划
 *
 * @author OpenClaw
 * @version 1.0.0
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";

/**
 * Windows 清理目标路径定义
 * 每个目标包含名称、描述、路径列表和是否需要管理员权限
 */
const CLEANUP_TARGETS = {
  // 用户临时文件
  temp: {
    name: "临时文件",
    description: "Windows 用户临时文件夹中的文件",
    paths: [
      process.env.TEMP || path.join(os.homedir(), "AppData", "Local", "Temp"),
      process.env.TMP || path.join(os.homedir(), "AppData", "Local", "Temp"),
    ],
    patterns: ["*"],
    requireAdmin: false,
  },

  // 浏览器缓存
  "browser-cache": {
    name: "浏览器缓存",
    description: "Chrome、Edge、Firefox 等浏览器的缓存文件",
    paths: [
      // Chrome
      path.join(
        os.homedir(),
        "AppData",
        "Local",
        "Google",
        "Chrome",
        "User Data",
        "Default",
        "Cache",
      ),
      path.join(
        os.homedir(),
        "AppData",
        "Local",
        "Google",
        "Chrome",
        "User Data",
        "Default",
        "Code Cache",
      ),
      // Edge
      path.join(
        os.homedir(),
        "AppData",
        "Local",
        "Microsoft",
        "Edge",
        "User Data",
        "Default",
        "Cache",
      ),
      path.join(
        os.homedir(),
        "AppData",
        "Local",
        "Microsoft",
        "Edge",
        "User Data",
        "Default",
        "Code Cache",
      ),
      // Firefox
      path.join(os.homedir(), "AppData", "Local", "Mozilla", "Firefox", "Profiles"),
    ],
    patterns: ["*"],
    requireAdmin: false,
  },

  // 回收站
  "recycle-bin": {
    name: "回收站",
    description: "Windows 回收站中的所有文件",
    paths: ["$RECYCLE.BIN"],
    patterns: ["*"],
    requireAdmin: false,
    special: "recycle-bin",
  },

  // Windows 更新缓存
  "windows-update": {
    name: "Windows 更新缓存",
    description: "Windows 更新下载的临时文件",
    paths: ["C:\\Windows\\SoftwareDistribution\\Download"],
    patterns: ["*"],
    requireAdmin: true,
  },

  // 缩略图缓存
  "thumbnail-cache": {
    name: "缩略图缓存",
    description: "Windows 资源管理器的缩略图缓存",
    paths: [path.join(os.homedir(), "AppData", "Local", "Microsoft", "Windows", "Explorer")],
    patterns: ["thumbcache_*.db", "iconcache_*.db"],
    requireAdmin: false,
  },

  // 日志文件
  "log-files": {
    name: "日志文件",
    description: "系统和应用程序日志文件",
    paths: [
      path.join(os.homedir(), "AppData", "Local", "Temp"),
      "C:\\Windows\\Logs",
      "C:\\Windows\\Temp",
    ],
    patterns: ["*.log", "*.log.*", "*.old"],
    requireAdmin: true,
  },

  // 最近文件记录
  "recent-files": {
    name: "最近文件记录",
    description: "最近使用的文件快捷方式",
    paths: [path.join(os.homedir(), "AppData", "Roaming", "Microsoft", "Windows", "Recent")],
    patterns: ["*.lnk"],
    requireAdmin: false,
  },

  // 预取文件
  prefetch: {
    name: "预取文件",
    description: "Windows 预取文件（加速应用启动的缓存）",
    paths: ["C:\\Windows\\Prefetch"],
    patterns: ["*.pf"],
    requireAdmin: true,
  },
};

/**
 * 格式化文件大小为可读字符串
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小字符串
 */
function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * 检查文件是否符合清理条件
 * @param {string} filePath - 文件路径
 * @param {number} minAgeDays - 最小文件年龄（天）
 * @param {number} maxSizeMB - 最大文件大小（MB）
 * @returns {Object} 检查结果 { match, size, age, reason }
 */
function checkFileEligibility(filePath, minAgeDays, maxSizeMB) {
  try {
    const stats = fs.statSync(filePath);

    if (!stats.isFile()) {
      return { match: false, reason: "不是文件" };
    }

    const now = Date.now();
    const fileAge = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    const fileSizeMB = stats.size / (1024 * 1024);

    // 检查文件年龄
    if (fileAge < minAgeDays) {
      return {
        match: false,
        size: stats.size,
        age: fileAge,
        reason: `文件年龄 ${fileAge.toFixed(1)} 天小于最小年龄 ${minAgeDays} 天`,
      };
    }

    // 检查文件大小（超过最大大小需要额外确认）
    const needsConfirmation = fileSizeMB > maxSizeMB;

    return {
      match: true,
      size: stats.size,
      age: fileAge,
      needsConfirmation,
      reason: needsConfirmation ? `文件大小 ${formatSize(stats.size)} 超过 ${maxSizeMB}MB` : null,
    };
  } catch {
    return { match: false, reason: "无法访问文件" };
  }
}

/**
 * 匹配文件模式
 * @param {string} filename - 文件名
 * @param {string[]} patterns - 模式列表
 * @returns {boolean} 是否匹配
 */
function matchPattern(filename, patterns) {
  for (const pattern of patterns) {
    if (pattern === "*") return true;

    // 简单的通配符匹配
    const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$", "i");
    if (regex.test(filename)) return true;
  }
  return false;
}

/**
 * 递归扫描目录中的文件
 * @param {string} dirPath - 目录路径
 * @param {string[]} patterns - 文件模式
 * @param {number} minAgeDays - 最小文件年龄
 * @param {number} maxSizeMB - 最大文件大小
 * @param {Object} log - 日志对象
 * @returns {Object[]} 扫描结果列表
 */
function scanDirectory(dirPath, patterns, minAgeDays, maxSizeMB, log) {
  const results = [];

  try {
    if (!fs.existsSync(dirPath)) {
      log.debug(`目录不存在: ${dirPath}`);
      return results;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      try {
        if (entry.isDirectory()) {
          // 递归扫描子目录
          const subResults = scanDirectory(fullPath, patterns, minAgeDays, maxSizeMB, log);
          results.push(...subResults);
        } else if (entry.isFile()) {
          // 检查文件是否匹配模式
          if (matchPattern(entry.name, patterns)) {
            const eligibility = checkFileEligibility(fullPath, minAgeDays, maxSizeMB);
            if (eligibility.match) {
              results.push({
                path: fullPath,
                size: eligibility.size,
                age: eligibility.age,
                needsConfirmation: eligibility.needsConfirmation,
              });
            }
          }
        }
      } catch (err) {
        log.debug(`跳过无法访问的文件: ${fullPath} - ${err.message}`);
      }
    }
  } catch (err) {
    log.debug(`无法扫描目录 ${dirPath}: ${err.message}`);
  }

  return results;
}

/**
 * 扫描清理目标
 * @param {string[]} targets - 清理目标列表
 * @param {number} minAgeDays - 最小文件年龄
 * @param {number} maxSizeMB - 最大文件大小
 * @param {string[]} customPaths - 自定义路径
 * @param {Object} log - 日志对象
 * @param {Function} progress - 进度回调
 * @returns {Object} 扫描结果
 */
function scanCleanupTargets(targets, minAgeDays, maxSizeMB, customPaths, log, progress) {
  const scanResults = {
    targets: {},
    totalSize: 0,
    totalFiles: 0,
    largeFiles: [],
    errors: [],
  };

  const totalTargets = targets.length + (customPaths?.length || 0);
  let currentTarget = 0;

  // 扫描预定义目标
  for (const targetId of targets) {
    currentTarget++;
    const targetConfig = CLEANUP_TARGETS[targetId];

    if (!targetConfig) {
      log.warn(`未知的清理目标: ${targetId}`);
      scanResults.errors.push({ target: targetId, error: "未知的清理目标" });
      continue;
    }

    progress((currentTarget / totalTargets) * 50, `正在扫描: ${targetConfig.name}`);
    log.info(`扫描清理目标: ${targetConfig.name}`);

    const targetResults = {
      name: targetConfig.name,
      description: targetConfig.description,
      requireAdmin: targetConfig.requireAdmin,
      files: [],
      totalSize: 0,
    };

    // 特殊处理回收站
    if (targetConfig.special === "recycle-bin") {
      log.info("回收站需要使用系统命令清理");
      targetResults.special = "recycle-bin";
      scanResults.targets[targetId] = targetResults;
      continue;
    }

    // 扫描每个路径
    for (const targetPath of targetConfig.paths) {
      const files = scanDirectory(targetPath, targetConfig.patterns, minAgeDays, maxSizeMB, log);

      for (const file of files) {
        targetResults.files.push(file);
        targetResults.totalSize += file.size;

        if (file.needsConfirmation) {
          scanResults.largeFiles.push({
            ...file,
            target: targetId,
          });
        }
      }
    }

    scanResults.targets[targetId] = targetResults;
    scanResults.totalSize += targetResults.totalSize;
    scanResults.totalFiles += targetResults.files.length;

    log.info(
      `${targetConfig.name}: 找到 ${targetResults.files.length} 个文件，共 ${formatSize(targetResults.totalSize)}`,
    );
  }

  // 扫描自定义路径
  if (customPaths && customPaths.length > 0) {
    const customResults = {
      name: "自定义路径",
      description: "用户指定的自定义清理路径",
      requireAdmin: false,
      files: [],
      totalSize: 0,
    };

    for (const customPath of customPaths) {
      currentTarget++;
      progress((currentTarget / totalTargets) * 50, `正在扫描: ${customPath}`);

      if (!fs.existsSync(customPath)) {
        log.warn(`自定义路径不存在: ${customPath}`);
        scanResults.errors.push({ target: "custom", path: customPath, error: "路径不存在" });
        continue;
      }

      const files = scanDirectory(customPath, ["*"], minAgeDays, maxSizeMB, log);

      for (const file of files) {
        customResults.files.push(file);
        customResults.totalSize += file.size;

        if (file.needsConfirmation) {
          scanResults.largeFiles.push({
            ...file,
            target: "custom",
          });
        }
      }
    }

    if (customResults.files.length > 0) {
      scanResults.targets["custom"] = customResults;
      scanResults.totalSize += customResults.totalSize;
      scanResults.totalFiles += customResults.files.length;
    }
  }

  return scanResults;
}

/**
 * 清空回收站
 * @param {Object} log - 日志对象
 * @returns {Object} 清理结果
 */
function emptyRecycleBin(log) {
  try {
    log.info("正在清空回收站...");

    // 使用 PowerShell 清空回收站
    execSync('powershell.exe -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', {
      stdio: "ignore",
      timeout: 60000,
    });

    log.info("回收站已清空");
    return { success: true, message: "回收站已清空" };
  } catch (err) {
    log.error(`清空回收站失败: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * 删除文件
 * @param {string} filePath - 文件路径
 * @param {Object} log - 日志对象
 * @returns {boolean} 是否成功
 */
function deleteFile(filePath, log) {
  try {
    fs.unlinkSync(filePath);
    log.debug(`已删除: ${filePath}`);
    return true;
  } catch (err) {
    log.debug(`删除失败 ${filePath}: ${err.message}`);
    return false;
  }
}

/**
 * 执行清理操作
 * @param {Object} scanResults - 扫描结果
 * @param {Object} log - 日志对象
 * @param {Function} progress - 进度回调
 * @returns {Object} 清理结果
 */
function executeCleanup(scanResults, log, progress) {
  const cleanupResults = {
    deleted: 0,
    failed: 0,
    freedSpace: 0,
    errors: [],
  };

  // 计算总文件数用于进度
  let totalFiles = scanResults.totalFiles;
  let processedFiles = 0;

  // 处理每个目标
  for (const [targetId, targetData] of Object.entries(scanResults.targets)) {
    log.info(`正在清理: ${targetData.name}`);

    // 特殊处理回收站
    if (targetData.special === "recycle-bin") {
      const result = emptyRecycleBin(log);
      if (result.success) {
        cleanupResults.deleted++;
      } else {
        cleanupResults.failed++;
        cleanupResults.errors.push({
          target: targetId,
          error: result.error,
        });
      }
      continue;
    }

    // 删除扫描到的文件
    for (const file of targetData.files) {
      processedFiles++;
      progress(50 + (processedFiles / totalFiles) * 50, `正在清理: ${path.basename(file.path)}`);

      if (deleteFile(file.path, log)) {
        cleanupResults.deleted++;
        cleanupResults.freedSpace += file.size;
      } else {
        cleanupResults.failed++;
        cleanupResults.errors.push({
          target: targetId,
          path: file.path,
          error: "删除失败",
        });
      }
    }
  }

  return cleanupResults;
}

/**
 * 技能定义对象
 */
const skillDefinition = {
  /**
   * 执行系统清理
   * @param {Object} context - 执行上下文
   * @param {Object} context.params - 参数
   * @param {Object} context.log - 日志对象
   * @param {Function} context.progress - 进度回调
   * @param {Function} context.confirm - 确认回调
   * @returns {Object} 执行结果
   */
  async execute(context) {
    const { params = {}, log, progress, confirm } = context;

    // 解析参数
    const targets = params.targets || ["temp", "browser-cache", "recycle-bin"];
    const preview = params.preview !== false; // 默认为预览模式
    const minAge = params.minAge || 7;
    const maxSize = params.maxSize || 100;
    const customPaths = params.customPaths || [];

    log.info("========================================");
    log.info("系统清理器开始执行");
    log.info(`清理目标: ${targets.join(", ")}`);
    log.info(`预览模式: ${preview ? "是" : "否"}`);
    log.info(`最小文件年龄: ${minAge} 天`);
    log.info(`最大文件大小: ${maxSize} MB`);
    if (customPaths.length > 0) {
      log.info(`自定义路径: ${customPaths.join(", ")}`);
    }
    log.info("========================================");

    // 第一阶段：扫描
    progress(0, "开始扫描系统...");
    const scanResults = scanCleanupTargets(targets, minAge, maxSize, customPaths, log, progress);

    log.info("========================================");
    log.info("扫描完成");
    log.info(`总计: ${scanResults.totalFiles} 个文件，${formatSize(scanResults.totalSize)}`);
    log.info("========================================");

    // 如果是预览模式，返回扫描结果
    if (preview) {
      // 构建预览摘要
      const targetSummaries = Object.entries(scanResults.targets).map(([id, data]) => ({
        id,
        name: data.name,
        fileCount: data.files?.length || (data.special ? 1 : 0),
        size: formatSize(data.totalSize || 0),
        requireAdmin: data.requireAdmin,
      }));

      return {
        success: true,
        summary: `预览完成：发现 ${scanResults.totalFiles} 个可清理文件，共 ${formatSize(scanResults.totalSize)}`,
        data: {
          mode: "preview",
          totalFiles: scanResults.totalFiles,
          totalSize: scanResults.totalSize,
          totalSizeFormatted: formatSize(scanResults.totalSize),
          targets: targetSummaries,
          largeFiles: scanResults.largeFiles.map((f) => ({
            path: f.path,
            size: formatSize(f.size),
            target: f.target,
          })),
          errors: scanResults.errors,
        },
        suggestions: [
          "如需执行清理，请将 preview 参数设置为 false",
          scanResults.largeFiles.length > 0
            ? `发现 ${scanResults.largeFiles.length} 个大文件，清理时会额外提示确认`
            : null,
          Object.values(scanResults.targets).some((t) => t.requireAdmin)
            ? "部分目标需要管理员权限才能清理"
            : null,
        ].filter(Boolean),
      };
    }

    // 第二阶段：确认
    if (scanResults.totalFiles === 0) {
      return {
        success: true,
        summary: "没有找到需要清理的文件",
        data: {
          mode: "cleanup",
          deleted: 0,
          freedSpace: 0,
        },
      };
    }

    // 请求用户确认
    const confirmed = await confirm(
      "系统清理",
      `即将删除 ${scanResults.totalFiles} 个文件，释放 ${formatSize(scanResults.totalSize)} 空间。此操作不可撤销。`,
      "high",
    );

    if (!confirmed) {
      log.info("用户取消了清理操作");
      return {
        success: false,
        summary: "用户取消了清理操作",
        data: {
          mode: "cancelled",
          totalFiles: scanResults.totalFiles,
          totalSize: formatSize(scanResults.totalSize),
        },
      };
    }

    // 如果有大文件，额外确认
    if (scanResults.largeFiles.length > 0) {
      const largeFilesConfirmed = await confirm(
        "大文件确认",
        `发现 ${scanResults.largeFiles.length} 个超过 ${maxSize}MB 的大文件，确定要删除吗？`,
        "high",
      );

      if (!largeFilesConfirmed) {
        // 从扫描结果中移除大文件
        for (const largeFile of scanResults.largeFiles) {
          const target = scanResults.targets[largeFile.target];
          if (target && target.files) {
            target.files = target.files.filter((f) => f.path !== largeFile.path);
            target.totalSize -= largeFile.size;
          }
        }
        scanResults.totalFiles -= scanResults.largeFiles.length;
        scanResults.totalSize -= scanResults.largeFiles.reduce((sum, f) => sum + f.size, 0);
        scanResults.largeFiles = [];
        log.info("已排除大文件");
      }
    }

    // 第三阶段：执行清理
    progress(50, "开始清理文件...");
    const cleanupResults = executeCleanup(scanResults, log, progress);

    progress(100, "清理完成");

    log.info("========================================");
    log.info("清理完成");
    log.info(`成功删除: ${cleanupResults.deleted} 个文件`);
    log.info(`删除失败: ${cleanupResults.failed} 个文件`);
    log.info(`释放空间: ${formatSize(cleanupResults.freedSpace)}`);
    log.info("========================================");

    return {
      success: true,
      summary: `清理完成：成功删除 ${cleanupResults.deleted} 个文件，释放 ${formatSize(cleanupResults.freedSpace)} 空间`,
      data: {
        mode: "cleanup",
        deleted: cleanupResults.deleted,
        failed: cleanupResults.failed,
        freedSpace: cleanupResults.freedSpace,
        freedSpaceFormatted: formatSize(cleanupResults.freedSpace),
        errors: cleanupResults.errors,
      },
      suggestions:
        cleanupResults.failed > 0
          ? [`${cleanupResults.failed} 个文件删除失败，可能需要管理员权限`]
          : ["清理成功，系统空间已释放"],
    };
  },
};

export default skillDefinition;
