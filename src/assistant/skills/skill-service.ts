/**
 * 技能商店服务
 *
 * 提供技能 CRUD、统计、查询等核心功能
 */

import { eq, and, desc, asc, ilike, sql, or, count } from "drizzle-orm";
import { getDatabase } from "../../db/index.js";
import {
  skillStoreItems,
  skillCategories,
  skillReviews,
  userInstalledSkills,
  type SkillStoreItem,
  type NewSkillStoreItem,
  type SkillCategory,
  type NewSkillCategory,
  type SkillStatus,
  type SubscriptionLevel,
} from "../../db/schema/index.js";
import { generateId } from "../../db/utils/id.js";

// 日志标签
const LOG_TAG = "[SkillService]";

/**
 * 技能列表查询参数
 */
export interface SkillListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: SkillStatus;
  categoryId?: string;
  subscriptionLevel?: SubscriptionLevel;
  authorId?: string;
  isFeatured?: boolean;
  sortBy?: "createdAt" | "downloadCount" | "ratingAvg" | "name";
  sortOrder?: "asc" | "desc";
}

/**
 * 技能列表响应
 */
export interface SkillListResult {
  items: SkillStoreItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 技能统计
 */
export interface SkillStats {
  total: number;
  published: number;
  pending: number;
  unpublished: number;
  rejected: number;
  featured: number;
}

/**
 * 分类列表结果
 */
export interface CategoryListResult {
  items: SkillCategory[];
  total: number;
}

/**
 * 获取技能统计
 */
export async function getSkillStats(): Promise<SkillStats> {
  console.log(`${LOG_TAG} getSkillStats`);

  const db = await getDatabase();

  // 查询各状态数量
  const [totalResult, publishedResult, pendingResult, unpublishedResult, rejectedResult, featuredResult] =
    await Promise.all([
      db.select({ count: count() }).from(skillStoreItems),
      db.select({ count: count() }).from(skillStoreItems).where(eq(skillStoreItems.status, "published")),
      db.select({ count: count() }).from(skillStoreItems).where(eq(skillStoreItems.status, "pending")),
      db.select({ count: count() }).from(skillStoreItems).where(eq(skillStoreItems.status, "unpublished")),
      db.select({ count: count() }).from(skillStoreItems).where(eq(skillStoreItems.status, "rejected")),
      db.select({ count: count() }).from(skillStoreItems).where(eq(skillStoreItems.isFeatured, true)),
    ]);

  return {
    total: totalResult[0]?.count ?? 0,
    published: publishedResult[0]?.count ?? 0,
    pending: pendingResult[0]?.count ?? 0,
    unpublished: unpublishedResult[0]?.count ?? 0,
    rejected: rejectedResult[0]?.count ?? 0,
    featured: featuredResult[0]?.count ?? 0,
  };
}

/**
 * 获取技能列表
 */
export async function getSkillList(query: SkillListQuery): Promise<SkillListResult> {
  console.log(`${LOG_TAG} getSkillList`, query);

  const db = await getDatabase();

  const {
    page = 1,
    pageSize = 20,
    search,
    status,
    categoryId,
    subscriptionLevel,
    authorId,
    isFeatured,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  // 构建查询条件
  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(skillStoreItems.name, `%${search}%`),
        ilike(skillStoreItems.description, `%${search}%`)
      )
    );
  }

  if (status) {
    conditions.push(eq(skillStoreItems.status, status));
  }

  if (categoryId) {
    conditions.push(eq(skillStoreItems.categoryId, categoryId));
  }

  if (subscriptionLevel) {
    conditions.push(eq(skillStoreItems.subscriptionLevel, subscriptionLevel));
  }

  if (authorId) {
    conditions.push(eq(skillStoreItems.authorId, authorId));
  }

  if (isFeatured !== undefined) {
    conditions.push(eq(skillStoreItems.isFeatured, isFeatured));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 排序
  const orderByColumn = {
    createdAt: skillStoreItems.createdAt,
    downloadCount: skillStoreItems.downloadCount,
    ratingAvg: skillStoreItems.ratingAvg,
    name: skillStoreItems.name,
  }[sortBy];

  const orderByFn = sortOrder === "asc" ? asc : desc;

  // 查询数据
  const [items, totalResult] = await Promise.all([
    db
      .select()
      .from(skillStoreItems)
      .where(whereClause)
      .orderBy(orderByFn(orderByColumn))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: count() }).from(skillStoreItems).where(whereClause),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取单个技能
 */
export async function getSkill(skillId: string): Promise<SkillStoreItem | null> {
  console.log(`${LOG_TAG} getSkill`, skillId);

  const db = await getDatabase();

  const result = await db
    .select()
    .from(skillStoreItems)
    .where(eq(skillStoreItems.id, skillId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * 创建技能
 */
export async function createSkill(data: Omit<NewSkillStoreItem, "id" | "createdAt" | "updatedAt">): Promise<SkillStoreItem> {
  console.log(`${LOG_TAG} createSkill`, data.name);

  const db = await getDatabase();

  const id = generateId();
  const now = new Date();

  const [skill] = await db
    .insert(skillStoreItems)
    .values({
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // 更新分类的技能数量
  if (data.categoryId) {
    await updateCategorySkillCount(data.categoryId);
  }

  return skill;
}

/**
 * 更新技能
 */
export async function updateSkill(
  skillId: string,
  data: Partial<Omit<NewSkillStoreItem, "id" | "createdAt">>
): Promise<SkillStoreItem | null> {
  console.log(`${LOG_TAG} updateSkill`, skillId);

  const db = await getDatabase();

  // 获取原技能信息（用于更新分类计数）
  const oldSkill = await getSkill(skillId);
  if (!oldSkill) {
    return null;
  }

  const [updated] = await db
    .update(skillStoreItems)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(skillStoreItems.id, skillId))
    .returning();

  // 更新分类的技能数量
  if (data.categoryId && data.categoryId !== oldSkill.categoryId) {
    if (oldSkill.categoryId) {
      await updateCategorySkillCount(oldSkill.categoryId);
    }
    await updateCategorySkillCount(data.categoryId);
  }

  return updated ?? null;
}

/**
 * 删除技能
 */
export async function deleteSkill(skillId: string): Promise<boolean> {
  console.log(`${LOG_TAG} deleteSkill`, skillId);

  const db = await getDatabase();

  // 获取原技能信息（用于更新分类计数）
  const skill = await getSkill(skillId);
  if (!skill) {
    return false;
  }

  const result = await db
    .delete(skillStoreItems)
    .where(eq(skillStoreItems.id, skillId));

  // 更新分类的技能数量
  if (skill.categoryId) {
    await updateCategorySkillCount(skill.categoryId);
  }

  return true;
}

/**
 * 增加下载次数
 */
export async function incrementDownloadCount(skillId: string): Promise<void> {
  console.log(`${LOG_TAG} incrementDownloadCount`, skillId);

  const db = await getDatabase();

  await db
    .update(skillStoreItems)
    .set({
      downloadCount: sql`${skillStoreItems.downloadCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(skillStoreItems.id, skillId));
}

/**
 * 更新评分统计
 */
export async function updateRatingStats(skillId: string): Promise<void> {
  console.log(`${LOG_TAG} updateRatingStats`, skillId);

  const db = await getDatabase();

  // 计算平均评分和评价数量
  const result = await db
    .select({
      avgRating: sql<number>`AVG(${skillReviews.rating})`,
      totalCount: count(),
    })
    .from(skillReviews)
    .where(eq(skillReviews.skillId, skillId));

  const { avgRating, totalCount } = result[0] ?? { avgRating: 0, totalCount: 0 };

  await db
    .update(skillStoreItems)
    .set({
      ratingAvg: avgRating?.toFixed(2) ?? "0",
      ratingCount: totalCount,
      updatedAt: new Date(),
    })
    .where(eq(skillStoreItems.id, skillId));
}

// ===================== 分类管理 =====================

/**
 * 获取分类列表
 */
export async function getCategoryList(): Promise<CategoryListResult> {
  console.log(`${LOG_TAG} getCategoryList`);

  const db = await getDatabase();

  const items = await db
    .select()
    .from(skillCategories)
    .where(eq(skillCategories.isActive, true))
    .orderBy(asc(skillCategories.sortOrder));

  return {
    items,
    total: items.length,
  };
}

/**
 * 获取单个分类
 */
export async function getCategory(categoryId: string): Promise<SkillCategory | null> {
  console.log(`${LOG_TAG} getCategory`, categoryId);

  const db = await getDatabase();

  const result = await db
    .select()
    .from(skillCategories)
    .where(eq(skillCategories.id, categoryId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * 创建分类
 */
export async function createCategory(data: Omit<NewSkillCategory, "id" | "createdAt" | "updatedAt">): Promise<SkillCategory> {
  console.log(`${LOG_TAG} createCategory`, data.name);

  const db = await getDatabase();

  const id = generateId();
  const now = new Date();

  const [category] = await db
    .insert(skillCategories)
    .values({
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return category;
}

/**
 * 更新分类
 */
export async function updateCategory(
  categoryId: string,
  data: Partial<Omit<NewSkillCategory, "id" | "createdAt">>
): Promise<SkillCategory | null> {
  console.log(`${LOG_TAG} updateCategory`, categoryId);

  const db = await getDatabase();

  const [updated] = await db
    .update(skillCategories)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(skillCategories.id, categoryId))
    .returning();

  return updated ?? null;
}

/**
 * 删除分类
 */
export async function deleteCategory(categoryId: string): Promise<boolean> {
  console.log(`${LOG_TAG} deleteCategory`, categoryId);

  const db = await getDatabase();

  // 将该分类下的技能移至无分类
  await db
    .update(skillStoreItems)
    .set({ categoryId: null, updatedAt: new Date() })
    .where(eq(skillStoreItems.categoryId, categoryId));

  await db.delete(skillCategories).where(eq(skillCategories.id, categoryId));

  return true;
}

/**
 * 更新分类的技能数量
 */
async function updateCategorySkillCount(categoryId: string): Promise<void> {
  const db = await getDatabase();

  const result = await db
    .select({ count: count() })
    .from(skillStoreItems)
    .where(
      and(
        eq(skillStoreItems.categoryId, categoryId),
        eq(skillStoreItems.status, "published")
      )
    );

  await db
    .update(skillCategories)
    .set({
      skillCount: result[0]?.count ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(skillCategories.id, categoryId));
}

// ===================== 推荐管理 =====================

/**
 * 获取推荐技能列表
 */
export async function getFeaturedSkills(): Promise<SkillStoreItem[]> {
  console.log(`${LOG_TAG} getFeaturedSkills`);

  const db = await getDatabase();

  return db
    .select()
    .from(skillStoreItems)
    .where(
      and(
        eq(skillStoreItems.isFeatured, true),
        eq(skillStoreItems.status, "published")
      )
    )
    .orderBy(asc(skillStoreItems.featuredOrder));
}

/**
 * 设置推荐状态
 */
export async function setFeatured(
  skillId: string,
  featured: boolean,
  order?: number
): Promise<SkillStoreItem | null> {
  console.log(`${LOG_TAG} setFeatured`, skillId, featured, order);

  const db = await getDatabase();

  const [updated] = await db
    .update(skillStoreItems)
    .set({
      isFeatured: featured,
      featuredOrder: featured ? order : null,
      updatedAt: new Date(),
    })
    .where(eq(skillStoreItems.id, skillId))
    .returning();

  return updated ?? null;
}

/**
 * 更新推荐排序
 */
export async function updateFeaturedOrder(
  items: Array<{ id: string; order: number }>
): Promise<void> {
  console.log(`${LOG_TAG} updateFeaturedOrder`, items.length);

  const db = await getDatabase();

  for (const item of items) {
    await db
      .update(skillStoreItems)
      .set({
        featuredOrder: item.order,
        updatedAt: new Date(),
      })
      .where(eq(skillStoreItems.id, item.id));
  }
}
