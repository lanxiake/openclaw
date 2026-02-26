/**
 * 技能商店服务 - Skill Store Service
 *
 * 提供技能商店的核心功能：
 * - 从数据库查询已发布技能
 * - 技能搜索和筛选
 * - 技能分类和统计
 * - 技能安装和更新检查
 *
 * @author MtBot
 */

import { eq, and, desc, asc, ilike, or, sql, count } from "drizzle-orm";

import { createSubsystemLogger } from "../../logging/subsystem.js";
import { getDatabase } from "../../db/index.js";
import { skillStoreItems, skillCategories, type SkillStoreItem } from "../../db/schema/index.js";
import type { SkillRegistry } from "./types.js";

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
 * 技能商店索引（仅用于兼容 syncInstalledSkills 等旧接口）
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

/**
 * 将数据库记录转换为 StoreSkillInfo
 */
function toStoreSkillInfo(item: SkillStoreItem): StoreSkillInfo {
  /** 映射订阅级别到商店展示类型 */
  const subscriptionTypeMap: Record<string, "free" | "premium" | "enterprise"> = {
    free: "free",
    pro: "premium",
    team: "premium",
    enterprise: "enterprise",
  };

  return {
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    longDescription: item.readme ?? undefined,
    version: item.version,
    author: item.authorName ?? "未知",
    icon: item.iconUrl ?? undefined,
    category: item.categoryId ?? "uncategorized",
    tags: (item.tags as string[]) ?? [],
    runMode: "local",
    subscription: {
      type: subscriptionTypeMap[item.subscriptionLevel] ?? "free",
    },
    downloads: item.downloadCount,
    rating: Number(item.ratingAvg) || 0,
    ratingCount: item.ratingCount,
    updatedAt: item.updatedAt.toISOString(),
    sourceUrl: item.packageUrl ?? undefined,
  };
}

/**
 * 获取或初始化商店索引（从数据库加载已发布技能）
 */
export async function getStoreIndex(): Promise<SkillStoreIndex> {
  log.info("从数据库加载技能商店索引");

  const db = await getDatabase();

  /** 查询所有已发布的技能 */
  const items = await db
    .select()
    .from(skillStoreItems)
    .where(eq(skillStoreItems.status, "published"));

  /** 构建索引 */
  const index: SkillStoreIndex = {
    skills: new Map(),
    categories: new Map(),
    tags: new Map(),
    version: Date.now(),
    lastUpdated: new Date(),
  };

  for (const item of items) {
    const info = toStoreSkillInfo(item);
    index.skills.set(info.id, info);

    /** 分类索引 */
    const categorySet = index.categories.get(info.category) || new Set();
    categorySet.add(info.id);
    index.categories.set(info.category, categorySet);

    /** 标签索引 */
    for (const tag of info.tags) {
      const tagSet = index.tags.get(tag) || new Set();
      tagSet.add(info.id);
      index.tags.set(tag, tagSet);
    }
  }

  log.info("商店索引构建完成", {
    skills: index.skills.size,
    categories: index.categories.size,
    tags: index.tags.size,
  });

  return index;
}

/**
 * 刷新商店索引（重新从数据库加载）
 */
export async function refreshStoreIndex(): Promise<SkillStoreIndex> {
  log.info("刷新技能商店索引（从数据库重新加载）");
  return getStoreIndex();
}

/**
 * 同步已安装技能状态到商店索引
 */
export async function syncInstalledSkills(registry: SkillRegistry): Promise<void> {
  log.info("同步已安装技能状态", { registrySize: registry.skills.size });
  // 在数据库驱动模式下，安装状态通过 userInstalledSkills 表管理
  // 此函数保留以兼容 Gateway RPC 调用，不再需要额外操作
}

/**
 * 查询商店技能（从数据库查询已发布的技能）
 */
export async function queryStoreSkills(filters: StoreFilters): Promise<StoreQueryResult> {
  log.debug("查询商店技能", { filters });

  const db = await getDatabase();

  /** 构建查询条件：仅查询已发布的技能 */
  const conditions = [eq(skillStoreItems.status, "published")];

  /** 分类筛选 */
  if (filters.category && filters.category !== "all") {
    conditions.push(eq(skillStoreItems.categoryId, filters.category));
  }

  /** 搜索筛选 */
  if (filters.search) {
    conditions.push(
      or(
        ilike(skillStoreItems.name, `%${filters.search}%`),
        ilike(skillStoreItems.description, `%${filters.search}%`),
      )!,
    );
  }

  const whereClause = and(...conditions);

  /** 排序 */
  const orderByClause = (() => {
    switch (filters.sortBy) {
      case "downloads":
        return desc(skillStoreItems.downloadCount);
      case "rating":
        return desc(skillStoreItems.ratingAvg);
      case "updated":
        return desc(skillStoreItems.updatedAt);
      case "name":
        return asc(skillStoreItems.name);
      default:
        return desc(skillStoreItems.downloadCount);
    }
  })();

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 20;

  /** 并行查询数据和总数 */
  const [items, totalResult] = await Promise.all([
    db
      .select()
      .from(skillStoreItems)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(skillStoreItems).where(whereClause),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const skills = items.map(toStoreSkillInfo);

  log.debug("查询结果", { total, returned: skills.length, offset, limit });

  return { skills, total, offset, limit };
}

/**
 * 获取技能详情
 */
export async function getStoreSkillDetail(skillId: string): Promise<StoreSkillInfo | null> {
  log.debug("获取技能详情", { skillId });

  const db = await getDatabase();

  const result = await db
    .select()
    .from(skillStoreItems)
    .where(and(eq(skillStoreItems.id, skillId), eq(skillStoreItems.status, "published")))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return toStoreSkillInfo(result[0]);
}

/**
 * 获取推荐技能（从数据库查询 isFeatured=true 的已发布技能）
 */
export async function getFeaturedSkills(limit: number = 3): Promise<StoreSkillInfo[]> {
  log.debug("获取推荐技能", { limit });

  const db = await getDatabase();

  const items = await db
    .select()
    .from(skillStoreItems)
    .where(and(eq(skillStoreItems.isFeatured, true), eq(skillStoreItems.status, "published")))
    .orderBy(asc(skillStoreItems.featuredOrder))
    .limit(limit);

  return items.map(toStoreSkillInfo);
}

/**
 * 获取热门技能（按下载量排序）
 */
export async function getPopularSkills(limit: number = 4): Promise<StoreSkillInfo[]> {
  log.debug("获取热门技能", { limit });

  const db = await getDatabase();

  const items = await db
    .select()
    .from(skillStoreItems)
    .where(eq(skillStoreItems.status, "published"))
    .orderBy(desc(skillStoreItems.downloadCount))
    .limit(limit);

  return items.map(toStoreSkillInfo);
}

/**
 * 获取最新技能（按更新时间排序）
 */
export async function getRecentSkills(limit: number = 4): Promise<StoreSkillInfo[]> {
  log.debug("获取最新技能", { limit });

  const db = await getDatabase();

  const items = await db
    .select()
    .from(skillStoreItems)
    .where(eq(skillStoreItems.status, "published"))
    .orderBy(desc(skillStoreItems.updatedAt))
    .limit(limit);

  return items.map(toStoreSkillInfo);
}

/**
 * 获取商店统计信息
 */
export async function getStoreStats(): Promise<StoreStats> {
  log.debug("获取商店统计");

  const db = await getDatabase();

  /** 查询已发布技能总数和总下载量 */
  const statsResult = await db
    .select({
      totalSkills: count(),
      totalDownloads: sql<number>`COALESCE(SUM(${skillStoreItems.downloadCount}), 0)`,
    })
    .from(skillStoreItems)
    .where(eq(skillStoreItems.status, "published"));

  const totalSkills = statsResult[0]?.totalSkills ?? 0;
  const totalDownloads = Number(statsResult[0]?.totalDownloads) || 0;

  /** 查询分类列表及其技能数量 */
  const categoryItems = await db
    .select()
    .from(skillCategories)
    .where(eq(skillCategories.isActive, true))
    .orderBy(asc(skillCategories.sortOrder));

  const categories: SkillCategory[] = [
    { id: "all", name: "全部", icon: "🔍", count: totalSkills },
    ...categoryItems.map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon ?? "📦",
      count: cat.skillCount,
    })),
  ];

  /** 查询热门标签 - 从已发布技能中提取 */
  const publishedItems = await db
    .select({ tags: skillStoreItems.tags })
    .from(skillStoreItems)
    .where(eq(skillStoreItems.status, "published"));

  const tagCounts = new Map<string, number>();
  for (const item of publishedItems) {
    const tags = (item.tags as string[]) ?? [];
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const popularTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  return { totalSkills, totalDownloads, categories, popularTags };
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
