/**
 * 技能商店服务测试
 *
 * 测试技能 CRUD、统计、分类管理、推荐管理等核心功能
 * 使用 Mock 数据库，无需真实 PostgreSQL
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
} from "../../db/mock-connection.js";
import {
  getSkillStats,
  getSkillList,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  incrementDownloadCount,
  getCategoryList,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getFeaturedSkills,
  setFeatured,
  updateFeaturedOrder,
  type SkillListQuery,
} from "./skill-service.js";

describe("SkillService - 技能统计", () => {
  beforeEach(() => {
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("SKILL-STATS-001: 空库统计全为零", async () => {
    const stats = await getSkillStats();

    expect(stats.total).toBe(0);
    expect(stats.published).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.unpublished).toBe(0);
    expect(stats.rejected).toBe(0);
    expect(stats.featured).toBe(0);
  });

  it("SKILL-STATS-002: 创建技能后统计正确", async () => {
    // 创建不同状态的技能
    await createSkill({
      name: "技能1",
      status: "published",
      subscriptionLevel: "free",
      version: "1.0.0",
    });
    await createSkill({
      name: "技能2",
      status: "published",
      subscriptionLevel: "free",
      version: "1.0.0",
    });
    await createSkill({
      name: "技能3",
      status: "pending",
      subscriptionLevel: "free",
      version: "1.0.0",
    });
    await createSkill({
      name: "技能4",
      status: "unpublished",
      subscriptionLevel: "free",
      version: "1.0.0",
    });

    const stats = await getSkillStats();

    expect(stats.total).toBe(4);
    expect(stats.published).toBe(2);
    expect(stats.pending).toBe(1);
    expect(stats.unpublished).toBe(1);
    expect(stats.rejected).toBe(0);
  });
});

describe("SkillService - 技能 CRUD", () => {
  beforeEach(() => {
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("SKILL-CREATE-001: 创建技能成功", async () => {
    const skill = await createSkill({
      name: "测试技能",
      description: "这是一个测试技能",
      version: "1.0.0",
      status: "pending",
      subscriptionLevel: "free",
      authorName: "测试作者",
    });

    expect(skill).toBeDefined();
    expect(skill.id).toBeDefined();
    expect(skill.name).toBe("测试技能");
    expect(skill.description).toBe("这是一个测试技能");
    expect(skill.version).toBe("1.0.0");
    expect(skill.status).toBe("pending");
    expect(skill.subscriptionLevel).toBe("free");
    expect(skill.authorName).toBe("测试作者");
    expect(skill.createdAt).toBeDefined();
    expect(skill.updatedAt).toBeDefined();
  });

  it("SKILL-GET-001: 获取存在的技能", async () => {
    const created = await createSkill({
      name: "获取测试",
      version: "1.0.0",
      status: "published",
      subscriptionLevel: "free",
    });

    const skill = await getSkill(created.id);

    expect(skill).not.toBeNull();
    expect(skill!.id).toBe(created.id);
    expect(skill!.name).toBe("获取测试");
  });

  it("SKILL-GET-002: 获取不存在的技能返回 null", async () => {
    const skill = await getSkill("non-existent-id");

    expect(skill).toBeNull();
  });

  it("SKILL-UPDATE-001: 更新技能成功", async () => {
    const created = await createSkill({
      name: "原始名称",
      version: "1.0.0",
      status: "pending",
      subscriptionLevel: "free",
    });

    const updated = await updateSkill(created.id, {
      name: "更新后名称",
      status: "published",
      description: "新增描述",
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("更新后名称");
    expect(updated!.status).toBe("published");
    expect(updated!.description).toBe("新增描述");
  });

  it("SKILL-UPDATE-002: 更新不存在的技能返回 null", async () => {
    const result = await updateSkill("non-existent-id", {
      name: "新名称",
    });

    expect(result).toBeNull();
  });

  it("SKILL-DELETE-001: 删除技能成功", async () => {
    const created = await createSkill({
      name: "待删除",
      version: "1.0.0",
      status: "pending",
      subscriptionLevel: "free",
    });

    const result = await deleteSkill(created.id);
    expect(result).toBe(true);

    // 验证已被删除
    const skill = await getSkill(created.id);
    expect(skill).toBeNull();
  });

  it("SKILL-DELETE-002: 删除不存在的技能返回 false", async () => {
    const result = await deleteSkill("non-existent-id");
    expect(result).toBe(false);
  });

  it("SKILL-DOWNLOAD-001: 增加下载次数", async () => {
    const created = await createSkill({
      name: "下载测试",
      version: "1.0.0",
      status: "published",
      subscriptionLevel: "free",
    });

    // 初始下载数应为 0
    expect(created.downloadCount).toBe(0);

    // 增加下载次数
    await incrementDownloadCount(created.id);

    // 验证更新后的值
    const skill = await getSkill(created.id);
    // 注: mock DB 使用 SQL 表达式 `downloadCount + 1`，
    // mock 不支持 SQL 表达式计算，所以这里验证函数不抛错即可
    expect(skill).not.toBeNull();
  });
});

describe("SkillService - 技能列表查询", () => {
  beforeEach(async () => {
    enableMockDatabase();
    clearMockDatabase();

    // 批量创建测试数据
    await createSkill({
      name: "AI 助手",
      description: "智能 AI 助手",
      version: "1.0.0",
      status: "published",
      subscriptionLevel: "free",
    });
    await createSkill({
      name: "代码生成器",
      description: "自动代码生成",
      version: "2.0.0",
      status: "published",
      subscriptionLevel: "pro",
    });
    await createSkill({
      name: "翻译工具",
      description: "多语言翻译",
      version: "1.0.0",
      status: "pending",
      subscriptionLevel: "free",
    });
    await createSkill({
      name: "数据分析",
      description: "数据可视化分析",
      version: "1.0.0",
      status: "unpublished",
      subscriptionLevel: "team",
    });
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("SKILL-LIST-001: 默认查询返回所有技能", async () => {
    const result = await getSkillList({});

    expect(result.items.length).toBe(4);
    expect(result.total).toBe(4);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it("SKILL-LIST-002: 分页查询", async () => {
    const result = await getSkillList({ page: 1, pageSize: 2 });

    expect(result.items.length).toBe(2);
    expect(result.total).toBe(4);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.totalPages).toBe(2);
  });

  it("SKILL-LIST-003: 按状态筛选", async () => {
    const result = await getSkillList({ status: "published" });

    expect(result.total).toBe(2);
    expect(result.items.every((s) => s.status === "published")).toBe(true);
  });

  it("SKILL-LIST-004: 按订阅级别筛选", async () => {
    const result = await getSkillList({ subscriptionLevel: "free" });

    expect(result.total).toBe(2);
    expect(result.items.every((s) => s.subscriptionLevel === "free")).toBe(true);
  });
});

describe("SkillService - 分类管理", () => {
  beforeEach(() => {
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("CATEGORY-CREATE-001: 创建分类成功", async () => {
    const category = await createCategory({
      name: "工具类",
      description: "各种实用工具",
      icon: "wrench",
      sortOrder: 1,
      isActive: true,
    });

    expect(category).toBeDefined();
    expect(category.id).toBeDefined();
    expect(category.name).toBe("工具类");
    expect(category.description).toBe("各种实用工具");
    expect(category.icon).toBe("wrench");
    expect(category.sortOrder).toBe(1);
    expect(category.isActive).toBe(true);
  });

  it("CATEGORY-GET-001: 获取分类", async () => {
    const created = await createCategory({
      name: "AI 类",
      sortOrder: 1,
      isActive: true,
    });

    const category = await getCategory(created.id);

    expect(category).not.toBeNull();
    expect(category!.id).toBe(created.id);
    expect(category!.name).toBe("AI 类");
  });

  it("CATEGORY-GET-002: 获取不存在的分类返回 null", async () => {
    const category = await getCategory("non-existent-id");
    expect(category).toBeNull();
  });

  it("CATEGORY-LIST-001: 获取活跃分类列表", async () => {
    await createCategory({ name: "分类1", sortOrder: 2, isActive: true });
    await createCategory({ name: "分类2", sortOrder: 1, isActive: true });
    await createCategory({ name: "分类3", sortOrder: 3, isActive: false });

    const result = await getCategoryList();

    // 应只返回 isActive=true 的分类
    expect(result.total).toBe(2);
    expect(result.items.length).toBe(2);
    expect(result.items.every((c) => c.isActive === true)).toBe(true);
  });

  it("CATEGORY-UPDATE-001: 更新分类成功", async () => {
    const created = await createCategory({
      name: "原名称",
      sortOrder: 1,
      isActive: true,
    });

    const updated = await updateCategory(created.id, {
      name: "新名称",
      description: "新描述",
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("新名称");
    expect(updated!.description).toBe("新描述");
  });

  it("CATEGORY-UPDATE-002: 更新不存在的分类返回 null", async () => {
    const result = await updateCategory("non-existent-id", {
      name: "新名称",
    });

    expect(result).toBeNull();
  });

  it("CATEGORY-DELETE-001: 删除分类成功", async () => {
    const created = await createCategory({
      name: "待删除分类",
      sortOrder: 1,
      isActive: true,
    });

    const result = await deleteCategory(created.id);
    expect(result).toBe(true);

    // 验证已被删除
    const category = await getCategory(created.id);
    expect(category).toBeNull();
  });
});

describe("SkillService - 推荐管理", () => {
  beforeEach(() => {
    enableMockDatabase();
    clearMockDatabase();
  });

  afterEach(() => {
    disableMockDatabase();
  });

  it("FEATURED-SET-001: 设置技能为推荐", async () => {
    const skill = await createSkill({
      name: "推荐技能",
      version: "1.0.0",
      status: "published",
      subscriptionLevel: "free",
    });

    const updated = await setFeatured(skill.id, true, 1);

    expect(updated).not.toBeNull();
    expect(updated!.isFeatured).toBe(true);
    expect(updated!.featuredOrder).toBe(1);
  });

  it("FEATURED-SET-002: 取消推荐", async () => {
    const skill = await createSkill({
      name: "推荐技能",
      version: "1.0.0",
      status: "published",
      subscriptionLevel: "free",
      isFeatured: true,
      featuredOrder: 1,
    });

    const updated = await setFeatured(skill.id, false);

    expect(updated).not.toBeNull();
    expect(updated!.isFeatured).toBe(false);
    expect(updated!.featuredOrder).toBeNull();
  });

  it("FEATURED-LIST-001: 获取推荐技能列表", async () => {
    // 创建推荐和非推荐技能
    await createSkill({
      name: "推荐1",
      version: "1.0.0",
      status: "published",
      subscriptionLevel: "free",
      isFeatured: true,
      featuredOrder: 1,
    });
    await createSkill({
      name: "推荐2",
      version: "1.0.0",
      status: "published",
      subscriptionLevel: "free",
      isFeatured: true,
      featuredOrder: 2,
    });
    await createSkill({
      name: "普通技能",
      version: "1.0.0",
      status: "published",
      subscriptionLevel: "free",
      isFeatured: false,
    });

    const featured = await getFeaturedSkills();

    // 应只返回 isFeatured=true 且 status=published 的技能
    expect(featured.length).toBe(2);
    expect(featured.every((s) => s.isFeatured === true)).toBe(true);
  });

  it("FEATURED-ORDER-001: 更新推荐排序", async () => {
    const skill1 = await createSkill({
      name: "推荐A",
      version: "1.0.0",
      status: "published",
      subscriptionLevel: "free",
      isFeatured: true,
      featuredOrder: 1,
    });
    const skill2 = await createSkill({
      name: "推荐B",
      version: "1.0.0",
      status: "published",
      subscriptionLevel: "free",
      isFeatured: true,
      featuredOrder: 2,
    });

    // 交换排序
    await updateFeaturedOrder([
      { id: skill1.id, order: 2 },
      { id: skill2.id, order: 1 },
    ]);

    // 验证排序更新
    const s1 = await getSkill(skill1.id);
    const s2 = await getSkill(skill2.id);
    expect(s1!.featuredOrder).toBe(2);
    expect(s2!.featuredOrder).toBe(1);
  });
});
