/**
 * 文件整理器技能
 *
 * 智能整理文件，按类型、日期或自定义规则组织文件夹
 */

import { readdir, stat, rename, mkdir } from "node:fs/promises";
import { join, extname, basename, dirname } from "node:path";
import { existsSync } from "node:fs";

// 文件类型分类映射
const FILE_TYPE_MAP = {
  images: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".ico", ".tiff", ".raw"],
  documents: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".odt"],
  videos: [".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".m4v"],
  audio: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".m4a"],
  archives: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"],
  code: [".js", ".ts", ".py", ".java", ".c", ".cpp", ".h", ".css", ".html", ".json", ".xml", ".yaml", ".yml"],
  executables: [".exe", ".msi", ".bat", ".cmd", ".ps1", ".sh"],
};

/**
 * 根据扩展名获取文件类型
 */
function getFileType(ext) {
  const lowerExt = ext.toLowerCase();

  for (const [type, extensions] of Object.entries(FILE_TYPE_MAP)) {
    if (extensions.includes(lowerExt)) {
      return type;
    }
  }

  return "others";
}

/**
 * 获取文件日期分类目录名
 */
function getDateFolder(date, granularity = "month") {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  switch (granularity) {
    case "year":
      return `${year}`;
    case "month":
      return `${year}/${year}-${month}`;
    case "day":
      return `${year}/${year}-${month}/${year}-${month}-${day}`;
    default:
      return `${year}/${year}-${month}`;
  }
}

/**
 * 扫描目录获取文件列表
 */
async function scanDirectory(dirPath, recursive = false) {
  const files = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isFile()) {
        const fileStat = await stat(fullPath);
        files.push({
          name: entry.name,
          path: fullPath,
          ext: extname(entry.name),
          size: fileStat.size,
          mtime: fileStat.mtime,
          ctime: fileStat.ctime,
        });
      } else if (entry.isDirectory() && recursive) {
        const subFiles = await scanDirectory(fullPath, true);
        files.push(...subFiles);
      }
    }
  } catch (error) {
    console.error(`扫描目录失败: ${dirPath}`, error);
  }

  return files;
}

/**
 * 生成整理计划
 */
function generateOrganizePlan(files, targetPath, mode, customRules) {
  const plan = [];

  for (const file of files) {
    let targetDir;

    switch (mode) {
      case "type":
        targetDir = join(targetPath, getFileType(file.ext));
        break;

      case "date":
        targetDir = join(targetPath, getDateFolder(file.mtime));
        break;

      case "extension":
        const ext = file.ext.slice(1).toLowerCase() || "no-extension";
        targetDir = join(targetPath, ext);
        break;

      case "custom":
        // 应用自定义规则
        targetDir = applyCustomRules(file, targetPath, customRules);
        break;

      default:
        targetDir = join(targetPath, getFileType(file.ext));
    }

    const targetFile = join(targetDir, file.name);

    // 跳过已在目标位置的文件
    if (file.path === targetFile) {
      continue;
    }

    plan.push({
      source: file.path,
      target: targetFile,
      targetDir,
      fileName: file.name,
      fileSize: file.size,
    });
  }

  return plan;
}

/**
 * 应用自定义规则
 */
function applyCustomRules(file, targetPath, rules) {
  if (!rules || rules.length === 0) {
    return join(targetPath, "unsorted");
  }

  for (const rule of rules) {
    // 扩展名匹配
    if (rule.extensions && rule.extensions.includes(file.ext.toLowerCase())) {
      return join(targetPath, rule.folder);
    }

    // 文件名模式匹配
    if (rule.pattern) {
      const regex = new RegExp(rule.pattern, "i");
      if (regex.test(file.name)) {
        return join(targetPath, rule.folder);
      }
    }

    // 大小匹配
    if (rule.minSize !== undefined && file.size < rule.minSize) {
      continue;
    }
    if (rule.maxSize !== undefined && file.size > rule.maxSize) {
      continue;
    }

    if (rule.minSize !== undefined || rule.maxSize !== undefined) {
      return join(targetPath, rule.folder);
    }
  }

  return join(targetPath, "others");
}

/**
 * 执行整理计划
 */
async function executePlan(plan, context) {
  const results = {
    success: [],
    failed: [],
  };

  const total = plan.length;
  let processed = 0;

  // 创建所需目录
  const dirsToCreate = new Set(plan.map((item) => item.targetDir));

  for (const dir of dirsToCreate) {
    if (!existsSync(dir)) {
      try {
        await mkdir(dir, { recursive: true });
        context.log.debug(`创建目录: ${dir}`);
      } catch (error) {
        context.log.error(`创建目录失败: ${dir}`, { error: String(error) });
      }
    }
  }

  // 移动文件
  for (const item of plan) {
    try {
      // 检查目标文件是否已存在
      if (existsSync(item.target)) {
        // 生成新文件名
        const ext = extname(item.fileName);
        const baseName = basename(item.fileName, ext);
        const timestamp = Date.now();
        const newName = `${baseName}_${timestamp}${ext}`;
        item.target = join(item.targetDir, newName);
      }

      await rename(item.source, item.target);
      results.success.push(item);

      processed++;
      context.progress(Math.round((processed / total) * 100), `正在移动: ${item.fileName}`);
    } catch (error) {
      context.log.error(`移动文件失败: ${item.source}`, { error: String(error) });
      results.failed.push({ ...item, error: String(error) });
    }
  }

  return results;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/**
 * 技能定义
 */
const skillDefinition = {
  metadata: {
    id: "file-organizer",
    name: "文件整理器",
    description: "智能整理文件，按类型、日期或自定义规则组织文件夹",
    version: "1.0.0",
    category: "file-management",
    runMode: "local",
  },

  triggers: [
    { type: "command", command: "organize" },
    { type: "keyword", keywords: ["整理文件", "整理文件夹", "文件分类"] },
    { type: "ai-invoke", aiInvocable: true },
  ],

  /**
   * 技能执行函数
   */
  async execute(context) {
    const {
      sourcePath,
      targetPath,
      mode = "type",
      preview = true,
      recursive = false,
      customRules,
    } = context.params;

    context.log.info("开始文件整理", { sourcePath, mode, preview, recursive });

    // 验证源路径
    if (!sourcePath || !existsSync(sourcePath)) {
      return {
        success: false,
        error: `源路径不存在: ${sourcePath}`,
      };
    }

    // 确定目标路径
    const finalTargetPath = targetPath || join(sourcePath, "_organized");

    // 扫描文件
    context.progress(10, "正在扫描文件...");
    const files = await scanDirectory(sourcePath, recursive);

    if (files.length === 0) {
      return {
        success: true,
        summary: "未找到需要整理的文件",
        data: { fileCount: 0 },
      };
    }

    context.log.info(`扫描完成，发现 ${files.length} 个文件`);
    context.progress(30, `发现 ${files.length} 个文件`);

    // 生成整理计划
    const plan = generateOrganizePlan(files, finalTargetPath, mode, customRules);

    if (plan.length === 0) {
      return {
        success: true,
        summary: "所有文件已在正确位置，无需整理",
        data: { fileCount: files.length, moveCount: 0 },
      };
    }

    // 统计信息
    const stats = {
      totalFiles: plan.length,
      totalSize: plan.reduce((sum, item) => sum + item.fileSize, 0),
      targetDirs: new Set(plan.map((item) => item.targetDir)).size,
    };

    // 预览模式
    if (preview) {
      context.progress(100, "预览完成");

      // 按目标目录分组
      const grouped = {};
      for (const item of plan) {
        const dir = basename(item.targetDir);
        if (!grouped[dir]) {
          grouped[dir] = [];
        }
        grouped[dir].push(item.fileName);
      }

      const previewLines = Object.entries(grouped).map(([dir, files]) => {
        return `📁 ${dir}: ${files.length} 个文件`;
      });

      return {
        success: true,
        summary: `预览: 将整理 ${stats.totalFiles} 个文件 (${formatFileSize(stats.totalSize)}) 到 ${stats.targetDirs} 个目录`,
        data: {
          preview: true,
          fileCount: stats.totalFiles,
          totalSize: stats.totalSize,
          targetDirs: stats.targetDirs,
          plan: plan.slice(0, 20), // 只返回前 20 项
          grouped,
        },
        suggestions: [
          "如需执行整理，请设置 preview: false",
          "可以修改 mode 参数更改整理方式",
        ],
      };
    }

    // 请求确认
    const confirmed = await context.confirm(
      "文件整理",
      `将移动 ${stats.totalFiles} 个文件 (${formatFileSize(stats.totalSize)}) 到 ${stats.targetDirs} 个目录`,
      "medium"
    );

    if (!confirmed) {
      return {
        success: false,
        error: "用户取消操作",
      };
    }

    // 执行整理
    context.progress(50, "正在整理文件...");
    const results = await executePlan(plan, context);

    context.progress(100, "整理完成");

    const summary = results.failed.length > 0
      ? `整理完成: 成功 ${results.success.length} 个，失败 ${results.failed.length} 个`
      : `整理完成: 成功移动 ${results.success.length} 个文件`;

    return {
      success: results.failed.length === 0,
      summary,
      data: {
        preview: false,
        successCount: results.success.length,
        failedCount: results.failed.length,
        totalSize: stats.totalSize,
        targetPath: finalTargetPath,
        failed: results.failed.map((f) => ({ file: f.fileName, error: f.error })),
      },
      suggestions: results.failed.length > 0
        ? ["部分文件移动失败，请检查权限或磁盘空间"]
        : undefined,
    };
  },
};

export default skillDefinition;
