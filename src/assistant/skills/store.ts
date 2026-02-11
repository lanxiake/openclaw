/**
 * 技能商店服务 - Skill Store Service
 *
 * 提供技能商店的核心功能：
 * - 技能索引管理
 * - 技能搜索和筛选
 * - 技能分类和统计
 * - 技能安装和更新检查
 *
 * @author OpenClaw
 */

import { createSubsystemLogger } from "../../shared/logging/subsystem.js";
import type { SkillRegistry, SkillRecord } from "./types.js";

// 日志
const log = createSubsystemLogger("skill-store");

/**
 * 商店技能信息
 */
export interface StoreSkillInfo {
  /** 技能 ID */
  id: string;
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 详细描述 */
  longDescription?: string;
  /** 版本 */
  version: string;
  /** 作者 */
  author: string;
  /** 图标 */
  icon?: string;
  /** 分类 */
  category: string;
  /** 标签 */
  tags: string[];
  /** 运行模式 */
  runMode: "server" | "local" | "hybrid";
  /** 订阅要求 */
  subscription: {
    type: "free" | "premium" | "enterprise";
    price?: number;
    period?: "monthly" | "yearly" | "once";
  };
  /** 下载次数 */
  downloads: number;
  /** 评分 */
  rating: number;
  /** 评分人数 */
  ratingCount: number;
  /** 更新时间 */
  updatedAt: string;
  /** 截图 */
  screenshots?: string[];
  /** 源 URL */
  sourceUrl?: string;
  /** 是否已安装 */
  installed?: boolean;
  /** 安装的版本 */
  installedVersion?: string;
}

/**
 * 技能分类信息
 */
export interface SkillCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

/**
 * 商店筛选条件
 */
export interface StoreFilters {
  /** 分类 */
  category?: string;
  /** 标签 */
  tags?: string[];
  /** 订阅类型 */
  subscription?: "free" | "premium" | "enterprise" | "all";
  /** 排序方式 */
  sortBy?: "downloads" | "rating" | "updated" | "name";
  /** 搜索关键词 */
  search?: string;
  /** 分页偏移 */
  offset?: number;
  /** 分页大小 */
  limit?: number;
}

/**
 * 商店统计信息
 */
export interface StoreStats {
  totalSkills: number;
  totalDownloads: number;
  categories: SkillCategory[];
  popularTags: string[];
}

/**
 * 商店查询结果
 */
export interface StoreQueryResult {
  skills: StoreSkillInfo[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * 技能商店索引
 */
interface SkillStoreIndex {
  /** 所有技能 */
  skills: Map<string, StoreSkillInfo>;
  /** 分类索引 */
  categories: Map<string, Set<string>>;
  /** 标签索引 */
  tags: Map<string, Set<string>>;
  /** 索引版本 */
  version: number;
  /** 最后更新时间 */
  lastUpdated: Date;
}

// 内置技能数据（作为商店的初始数据）
const BUILTIN_STORE_SKILLS: StoreSkillInfo[] = [
  {
    id: "file-organizer",
    name: "文件整理器",
    description: "自动整理和分类文件，保持桌面和文件夹整洁",
    longDescription:
      "文件整理器是一款智能文件管理工具，可以根据文件类型、日期、大小等条件自动分类整理文件。支持自定义分类规则，可以预览整理计划后再执行，确保文件安全。",
    version: "1.0.0",
    author: "OpenClaw",
    icon: "📁",
    category: "file-management",
    tags: ["文件", "整理", "自动化", "桌面清理"],
    runMode: "local",
    subscription: { type: "free" },
    downloads: 1520,
    rating: 4.8,
    ratingCount: 156,
    updatedAt: "2026-02-05",
  },
  {
    id: "system-cleaner",
    name: "系统清理器",
    description: "清理系统临时文件、缓存和垃圾文件，释放磁盘空间",
    longDescription:
      "系统清理器可以帮助你清理 Windows 系统中的临时文件、浏览器缓存、回收站、Windows 更新缓存等垃圾文件，释放宝贵的磁盘空间。支持预览模式，在实际删除前查看清理计划。",
    version: "1.0.0",
    author: "OpenClaw",
    icon: "🧹",
    category: "system",
    tags: ["清理", "系统", "临时文件", "缓存", "磁盘空间"],
    runMode: "local",
    subscription: { type: "free" },
    downloads: 2340,
    rating: 4.9,
    ratingCount: 234,
    updatedAt: "2026-02-06",
  },
  {
    id: "screenshot-ocr",
    name: "截图 OCR",
    description: "截图后自动识别文字，支持中英文混合识别",
    longDescription:
      "截图 OCR 工具可以快速截取屏幕内容并自动识别其中的文字。支持中英文混合识别，准确率高。识别结果可以直接复制或保存，方便进一步编辑使用。",
    version: "1.2.0",
    author: "OpenClaw",
    icon: "📷",
    category: "productivity",
    tags: ["OCR", "截图", "文字识别", "效率"],
    runMode: "hybrid",
    subscription: { type: "free" },
    downloads: 3567,
    rating: 4.7,
    ratingCount: 312,
    updatedAt: "2026-02-04",
  },
  {
    id: "auto-backup",
    name: "自动备份",
    description: "自动备份重要文件到指定位置，支持增量备份",
    longDescription:
      "自动备份工具可以定期将指定文件夹的内容备份到本地或网络位置。支持增量备份，只备份变化的文件，节省时间和空间。",
    version: "2.0.1",
    author: "OpenClaw",
    icon: "💾",
    category: "file-management",
    tags: ["备份", "自动化", "数据安全"],
    runMode: "local",
    subscription: { type: "premium", price: 9.99, period: "monthly" },
    downloads: 890,
    rating: 4.6,
    ratingCount: 89,
    updatedAt: "2026-02-03",
  },
  {
    id: "clipboard-manager",
    name: "剪贴板管理器",
    description: "保存剪贴板历史，快速访问之前复制的内容",
    longDescription:
      "剪贴板管理器会自动记录你复制的所有内容，包括文本、图片等。可以快速搜索和访问历史记录，支持固定常用项目。",
    version: "1.5.0",
    author: "OpenClaw",
    icon: "📋",
    category: "productivity",
    tags: ["剪贴板", "效率", "历史记录"],
    runMode: "local",
    subscription: { type: "free" },
    downloads: 4521,
    rating: 4.8,
    ratingCount: 456,
    updatedAt: "2026-02-02",
  },
  {
    id: "window-manager",
    name: "窗口管理器",
    description: "快速调整窗口大小和位置，支持分屏布局",
    longDescription:
      "窗口管理器提供快捷键和拖拽方式来快速调整窗口布局。支持多种预设分屏模式，提高多任务工作效率。",
    version: "1.1.0",
    author: "OpenClaw",
    icon: "🪟",
    category: "productivity",
    tags: ["窗口", "分屏", "效率", "布局"],
    runMode: "local",
    subscription: { type: "free" },
    downloads: 2156,
    rating: 4.5,
    ratingCount: 198,
    updatedAt: "2026-02-01",
  },
  {
    id: "network-monitor",
    name: "网络监控",
    description: "实时监控网络流量和连接状态",
    longDescription:
      "网络监控工具可以实时显示当前网络使用情况，包括上传下载速度、活动连接等。支持流量统计和警报设置。",
    version: "1.0.0",
    author: "OpenClaw",
    icon: "🌐",
    category: "system",
    tags: ["网络", "监控", "流量"],
    runMode: "local",
    subscription: { type: "premium", price: 4.99, period: "monthly" },
    downloads: 678,
    rating: 4.4,
    ratingCount: 67,
    updatedAt: "2026-01-30",
  },
  {
    id: "batch-rename",
    name: "批量重命名",
    description: "批量重命名文件，支持正则表达式和模板",
    longDescription:
      "批量重命名工具支持多种重命名规则，包括添加前后缀、序号、日期、正则替换等。预览功能确保重命名结果符合预期。",
    version: "1.3.0",
    author: "OpenClaw",
    icon: "✏️",
    category: "file-management",
    tags: ["重命名", "批量", "文件管理"],
    runMode: "local",
    subscription: { type: "free" },
    downloads: 1234,
    rating: 4.7,
    ratingCount: 123,
    updatedAt: "2026-01-28",
  },
];

// 分类定义
const CATEGORY_DEFINITIONS: Array<{ id: string; name: string; icon: string }> = [
  { id: "all", name: "全部", icon: "🔍" },
  { id: "file-management", name: "文件管理", icon: "📁" },
  { id: "productivity", name: "效率工具", icon: "⚡" },
  { id: "system", name: "系统工具", icon: "⚙️" },
  { id: "communication", name: "通讯工具", icon: "💬" },
  { id: "development", name: "开发工具", icon: "🛠️" },
  { id: "media", name: "媒体处理", icon: "🎬" },
  { id: "automation", name: "自动化", icon: "🤖" },
  { id: "custom", name: "自定义", icon: "🎨" },
];

// 全局商店索引实例（懒加载）
let storeIndex: SkillStoreIndex | null = null;

/**
 * 创建空的商店索引
 */
function createEmptyStoreIndex(): SkillStoreIndex {
  return {
    skills: new Map(),
    categories: new Map(),
    tags: new Map(),
    version: 0,
    lastUpdated: new Date(),
  };
}

/**
 * 构建商店索引
 */
function buildStoreIndex(skills: StoreSkillInfo[]): SkillStoreIndex {
  const index = createEmptyStoreIndex();

  for (const skill of skills) {
    // 添加到技能 Map
    index.skills.set(skill.id, skill);

    // 添加到分类索引
    const categorySet = index.categories.get(skill.category) || new Set();
    categorySet.add(skill.id);
    index.categories.set(skill.category, categorySet);

    // 添加到标签索引
    for (const tag of skill.tags) {
      const tagSet = index.tags.get(tag) || new Set();
      tagSet.add(skill.id);
      index.tags.set(tag, tagSet);
    }
  }

  index.version = Date.now();
  index.lastUpdated = new Date();

  log.info("商店索引构建完成", {
    skills: index.skills.size,
    categories: index.categories.size,
    tags: index.tags.size,
  });

  return index;
}

/**
 * 获取或初始化商店索引
 */
export async function getStoreIndex(): Promise<SkillStoreIndex> {
  if (!storeIndex) {
    log.info("初始化技能商店索引");
    storeIndex = buildStoreIndex(BUILTIN_STORE_SKILLS);
  }
  return storeIndex;
}

/**
 * 刷新商店索引
 * 可以在此添加从远程服务器获取技能列表的逻辑
 */
export async function refreshStoreIndex(): Promise<SkillStoreIndex> {
  log.info("刷新技能商店索引");

  // TODO: 从远程服务器获取最新的技能列表
  // const remoteSkills = await fetchRemoteSkillList();

  // 目前使用内置数据
  storeIndex = buildStoreIndex(BUILTIN_STORE_SKILLS);

  return storeIndex;
}

/**
 * 同步已安装技能状态到商店索引
 */
export async function syncInstalledSkills(registry: SkillRegistry): Promise<void> {
  const index = await getStoreIndex();

  log.info("同步已安装技能状态", { registrySize: registry.skills.size });

  for (const [skillId, record] of registry.skills) {
    const storeSkill = index.skills.get(skillId);
    if (storeSkill) {
      storeSkill.installed = record.status === "loaded" || record.status === "disabled";
      storeSkill.installedVersion = record.metadata.version;
    }
  }
}

/**
 * 查询商店技能
 */
export async function queryStoreSkills(filters: StoreFilters): Promise<StoreQueryResult> {
  const index = await getStoreIndex();

  log.debug("查询商店技能", { filters });

  let results = Array.from(index.skills.values());

  // 分类筛选
  if (filters.category && filters.category !== "all") {
    const categorySkills = index.categories.get(filters.category);
    if (categorySkills) {
      results = results.filter((s) => categorySkills.has(s.id));
    } else {
      results = [];
    }
  }

  // 订阅类型筛选
  if (filters.subscription && filters.subscription !== "all") {
    results = results.filter((s) => s.subscription.type === filters.subscription);
  }

  // 标签筛选
  if (filters.tags && filters.tags.length > 0) {
    results = results.filter((s) => filters.tags!.some((t) => s.tags.includes(t)));
  }

  // 搜索筛选
  if (filters.search) {
    const query = filters.search.toLowerCase();
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.tags.some((t) => t.toLowerCase().includes(query)),
    );
  }

  // 排序
  switch (filters.sortBy) {
    case "downloads":
      results.sort((a, b) => b.downloads - a.downloads);
      break;
    case "rating":
      results.sort((a, b) => b.rating - a.rating);
      break;
    case "updated":
      results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
    case "name":
      results.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      // 默认按下载量排序
      results.sort((a, b) => b.downloads - a.downloads);
  }

  const total = results.length;

  // 分页
  const offset = filters.offset || 0;
  const limit = filters.limit || 20;
  results = results.slice(offset, offset + limit);

  log.debug("查询结果", { total, returned: results.length, offset, limit });

  return {
    skills: results,
    total,
    offset,
    limit,
  };
}

/**
 * 获取技能详情
 */
export async function getStoreSkillDetail(skillId: string): Promise<StoreSkillInfo | null> {
  const index = await getStoreIndex();
  return index.skills.get(skillId) || null;
}

/**
 * 获取推荐技能
 */
export async function getFeaturedSkills(limit: number = 3): Promise<StoreSkillInfo[]> {
  const index = await getStoreIndex();

  // 按评分排序，取前 N 个
  return Array.from(index.skills.values())
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}

/**
 * 获取热门技能
 */
export async function getPopularSkills(limit: number = 4): Promise<StoreSkillInfo[]> {
  const index = await getStoreIndex();

  // 按下载量排序，取前 N 个
  return Array.from(index.skills.values())
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, limit);
}

/**
 * 获取最新技能
 */
export async function getRecentSkills(limit: number = 4): Promise<StoreSkillInfo[]> {
  const index = await getStoreIndex();

  // 按更新时间排序，取前 N 个
  return Array.from(index.skills.values())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

/**
 * 获取商店统计信息
 */
export async function getStoreStats(): Promise<StoreStats> {
  const index = await getStoreIndex();

  // 计算总下载量
  const totalDownloads = Array.from(index.skills.values()).reduce((sum, s) => sum + s.downloads, 0);

  // 构建分类统计
  const categories: SkillCategory[] = CATEGORY_DEFINITIONS.map((cat) => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    count: cat.id === "all" ? index.skills.size : index.categories.get(cat.id)?.size || 0,
  }));

  // 获取热门标签（按使用次数排序）
  const tagCounts = Array.from(index.tags.entries())
    .map(([tag, skills]) => ({ tag, count: skills.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((t) => t.tag);

  return {
    totalSkills: index.skills.size,
    totalDownloads,
    categories,
    popularTags: tagCounts,
  };
}

/**
 * 检查技能更新
 */
export async function checkSkillUpdates(registry: SkillRegistry): Promise<StoreSkillInfo[]> {
  const index = await getStoreIndex();
  const updatable: StoreSkillInfo[] = [];

  for (const [skillId, record] of registry.skills) {
    const storeSkill = index.skills.get(skillId);
    if (storeSkill && record.metadata.version !== storeSkill.version) {
      updatable.push({
        ...storeSkill,
        installed: true,
        installedVersion: record.metadata.version,
      });
    }
  }

  log.info("检查技能更新", {
    installed: registry.skills.size,
    updatable: updatable.length,
  });

  return updatable;
}

/**
 * 搜索技能（简化版，用于快速搜索）
 */
export async function searchSkills(query: string, limit: number = 10): Promise<StoreSkillInfo[]> {
  const result = await queryStoreSkills({
    search: query,
    limit,
    sortBy: "downloads",
  });
  return result.skills;
}
