/**
 * 管理员技能商店管理 RPC 方法处理器
 *
 * 提供管理员管理技能商店的 RPC 方法，使用真实数据库查询
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import {
  getSkillStats,
  getSkillList,
  getSkill,
  getCategoryList,
  createCategory,
  updateCategory,
  deleteCategory,
  getFeaturedSkills,
  setFeatured,
  updateFeaturedOrder,
  createSkill,
  type SkillListQuery,
} from "../../assistant/skills/skill-service.js";
import {
  approveSkill,
  rejectSkill,
  publishSkill,
  unpublishSkill,
} from "../../assistant/skills/skill-review-service.js";
import type { SkillStatus, SubscriptionLevel } from "../../db/schema/index.js";

// 日志标签
const LOG_TAG = "admin-skills";

/**
 * 验证字符串参数
 */
function validateStringParam(
  params: Record<string, unknown>,
  key: string,
  required = false,
): string | undefined {
  const value = params[key];

  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Parameter ${key} must be a string`);
  }

  return value.trim();
}

/**
 * 验证数字参数
 */
function validateNumberParam(
  params: Record<string, unknown>,
  key: string,
  defaultValue?: number,
): number | undefined {
  const value = params[key];

  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== "number") {
    throw new Error(`Parameter ${key} must be a number`);
  }

  return value;
}

/**
 * 管理员技能商店管理 RPC 方法处理器
 */
export const adminSkillHandlers: GatewayRequestHandlers = {
  /**
   * 获取技能统计
   */
  "admin.skills.stats": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取技能统计`);

      // 从数据库获取统计数据
      const stats = await getSkillStats();

      // 获取分类分布
      const categoryResult = await getCategoryList();
      const categoryDistribution = categoryResult.items.map((c) => ({
        category: c.id,
        categoryName: c.name,
        count: c.skillCount,
      }));

      // 获取 Top 技能
      const topResult = await getSkillList({
        status: "published",
        sortBy: "downloadCount",
        sortOrder: "desc",
        pageSize: 5,
      });
      const topSkills = topResult.items.map((s) => ({
        id: s.id,
        name: s.name,
        installCount: s.downloadCount,
      }));

      // 获取订阅分布（从数据库查询）
      const freeResult = await getSkillList({ subscriptionLevel: "free", pageSize: 1 });
      const proResult = await getSkillList({ subscriptionLevel: "pro", pageSize: 1 });
      const teamResult = await getSkillList({ subscriptionLevel: "team", pageSize: 1 });
      const enterpriseResult = await getSkillList({ subscriptionLevel: "enterprise", pageSize: 1 });

      const subscriptionDistribution = [
        { subscription: "free" as const, count: freeResult.total },
        { subscription: "pro" as const, count: proResult.total },
        { subscription: "team" as const, count: teamResult.total },
        { subscription: "enterprise" as const, count: enterpriseResult.total },
      ];

      // 计算总下载量
      const allSkillsResult = await getSkillList({ pageSize: 1000 });
      const totalInstalls = allSkillsResult.items.reduce((sum, s) => sum + s.downloadCount, 0);

      const responseData = {
        totalSkills: stats.total,
        publishedSkills: stats.published,
        pendingSkills: stats.pending,
        unpublishedSkills: stats.unpublished,
        rejectedSkills: stats.rejected,
        featuredSkills: stats.featured,
        totalInstalls,
        totalCategories: categoryResult.total,
        categoryDistribution,
        subscriptionDistribution,
        topSkills,
      };

      respond(true, { success: true, data: responseData }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取技能统计失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取技能列表
   */
  "admin.skills.list": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取技能列表`, { params });

      const page = validateNumberParam(params, "page", 1) || 1;
      const pageSize = validateNumberParam(params, "pageSize", 20) || 20;
      const search = validateStringParam(params, "search");
      const status = validateStringParam(params, "status") as SkillStatus | undefined;
      const categoryId = validateStringParam(params, "category");
      const subscriptionLevel = validateStringParam(params, "subscription") as
        | SubscriptionLevel
        | undefined;
      const featured = params.featured as boolean | undefined;
      const sortBy = validateStringParam(params, "sortBy") || "createdAt";
      const sortOrder = validateStringParam(params, "sortOrder") || "desc";

      // 构建查询参数
      const query: SkillListQuery = {
        page,
        pageSize,
        search,
        status,
        categoryId,
        subscriptionLevel,
        isFeatured: featured,
        sortBy: sortBy as SkillListQuery["sortBy"],
        sortOrder: sortOrder as SkillListQuery["sortOrder"],
      };

      const result = await getSkillList(query);

      // 获取分类列表用于补充分类名称
      const categoryResult = await getCategoryList();
      const categoryMap = new Map(categoryResult.items.map((c) => [c.id, c.name]));

      // 转换技能数据格式以匹配前端期望
      const skills = result.items.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description || "",
        version: s.version,
        category: s.categoryId || "",
        categoryName: s.categoryId ? categoryMap.get(s.categoryId) || "" : "",
        icon: s.iconUrl || "puzzle",
        author: s.authorName || "Unknown",
        authorId: s.authorId || "",
        status: s.status,
        subscription: s.subscriptionLevel,
        runMode: "local" as const,
        tags: (s.tags as string[]) || [],
        installCount: s.downloadCount,
        rating: s.ratingAvg ? parseFloat(s.ratingAvg) : undefined,
        ratingCount: s.ratingCount,
        featured: s.isFeatured,
        featuredOrder: s.featuredOrder,
        createdAt: s.createdAt?.toISOString() || "",
        updatedAt: s.updatedAt?.toISOString() || "",
        publishedAt: s.publishedAt?.toISOString() || undefined,
      }));

      respond(
        true,
        {
          success: true,
          skills,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取技能列表失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取技能详情
   */
  "admin.skills.get": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 获取技能详情`, { skillId });

      const skill = await getSkill(skillId);

      if (!skill) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Skill not found: ${skillId}`),
        );
        return;
      }

      // 获取分类名称
      let categoryName = "";
      if (skill.categoryId) {
        const categoryResult = await getCategoryList();
        const category = categoryResult.items.find((c) => c.id === skill.categoryId);
        categoryName = category?.name || "";
      }

      // 转换为详情格式
      const detail = {
        id: skill.id,
        name: skill.name,
        description: skill.description || "",
        version: skill.version,
        category: skill.categoryId || "",
        categoryName,
        icon: skill.iconUrl || "puzzle",
        author: skill.authorName || "Unknown",
        authorId: skill.authorId || "",
        status: skill.status,
        subscription: skill.subscriptionLevel,
        runMode: "local" as const,
        tags: (skill.tags as string[]) || [],
        installCount: skill.downloadCount,
        rating: skill.ratingAvg ? parseFloat(skill.ratingAvg) : undefined,
        ratingCount: skill.ratingCount,
        featured: skill.isFeatured,
        featuredOrder: skill.featuredOrder,
        createdAt: skill.createdAt?.toISOString() || "",
        updatedAt: skill.updatedAt?.toISOString() || "",
        publishedAt: skill.publishedAt?.toISOString() || undefined,
        readme:
          skill.readme || `# ${skill.name}\n\n${skill.description || ""}\n\n## 使用方法\n\n...`,
        changelog: `## v${skill.version}\n- 当前版本`,
        triggers: [],
        parameters: [],
        screenshots: [],
        manifestUrl: skill.manifestUrl,
        packageUrl: skill.packageUrl,
        config: skill.config,
        reviewNote: skill.reviewNote,
        reviewedBy: skill.reviewedBy,
        reviewedAt: skill.reviewedAt?.toISOString() || undefined,
      };

      respond(true, { success: true, skill: detail }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取技能详情失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, errorMessage));
    }
  },

  /**
   * 审核技能
   */
  "admin.skills.review": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);
      const action = validateStringParam(params, "action", true);
      const notes = validateStringParam(params, "notes");

      if (!skillId || !action) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      if (action !== "approve" && action !== "reject") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Invalid action"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 审核技能`, { skillId, action, notes });

      // 使用默认值，因为 GatewayRequestContext 不包含 adminId
      const adminId = "system";

      let result;
      if (action === "approve") {
        result = await approveSkill(skillId, adminId, notes);
      } else {
        result = await rejectSkill(skillId, adminId, notes || "审核未通过");
      }

      if (!result.success) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "审核失败"),
        );
        return;
      }

      respond(
        true,
        {
          success: true,
          skillId,
          status: result.skill?.status,
          message: action === "approve" ? "技能已通过审核" : "技能已拒绝",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 审核技能失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 发布/下架技能
   */
  "admin.skills.publish": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);
      const action = validateStringParam(params, "action", true);
      const reason = validateStringParam(params, "reason");

      if (!skillId || !action) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      if (action !== "publish" && action !== "unpublish") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Invalid action"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 发布/下架技能`, { skillId, action, reason });

      let result;
      if (action === "publish") {
        result = await publishSkill(skillId);
      } else {
        result = await unpublishSkill(skillId);
      }

      if (!result.success) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "操作失败"),
        );
        return;
      }

      respond(
        true,
        {
          success: true,
          skillId,
          status: result.skill?.status,
          message: action === "publish" ? "技能已上架" : "技能已下架",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 发布/下架技能失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 设置技能推荐
   */
  "admin.skills.setFeatured": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);
      const featured = params.featured as boolean;
      const order = validateNumberParam(params, "order");

      if (!skillId || featured === undefined) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 设置技能推荐`, { skillId, featured, order });

      const result = await setFeatured(skillId, featured, order);

      if (!result) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Skill not found: ${skillId}`),
        );
        return;
      }

      respond(
        true,
        {
          success: true,
          skillId,
          featured: result.isFeatured,
          featuredOrder: result.featuredOrder,
          message: featured ? "技能已设为推荐" : "技能已取消推荐",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 设置技能推荐失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取技能分类列表
   */
  "admin.skills.categories.list": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取技能分类列表`);

      const result = await getCategoryList();

      // 转换为前端期望的格式
      const categories = result.items.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.id,
        description: c.description || "",
        icon: c.icon || "folder",
        sortOrder: c.sortOrder,
        skillCount: c.skillCount,
        isActive: c.isActive,
        createdAt: c.createdAt?.toISOString() || "",
        updatedAt: c.updatedAt?.toISOString() || "",
      }));

      respond(
        true,
        {
          success: true,
          categories,
          total: result.total,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取技能分类列表失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 创建技能分类
   */
  "admin.skills.categories.create": async ({ params, respond, context }) => {
    try {
      const name = validateStringParam(params, "name", true);
      const code = validateStringParam(params, "code", true);
      const description = validateStringParam(params, "description");
      const icon = validateStringParam(params, "icon");
      const sortOrder = validateNumberParam(params, "sortOrder", 0);

      if (!name || !code) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 创建技能分类`, { name, code });

      const category = await createCategory({
        name,
        description: description || null,
        icon: icon || null,
        sortOrder: sortOrder || 0,
      });

      const responseCategory = {
        id: category.id,
        name: category.name,
        code: category.id,
        description: category.description || "",
        icon: category.icon || "folder",
        sortOrder: category.sortOrder,
        skillCount: category.skillCount,
        isActive: category.isActive,
        createdAt: category.createdAt?.toISOString() || "",
        updatedAt: category.updatedAt?.toISOString() || "",
      };

      respond(
        true,
        {
          success: true,
          category: responseCategory,
          message: "分类创建成功",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 创建技能分类失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 更新技能分类
   */
  "admin.skills.categories.update": async ({ params, respond, context }) => {
    try {
      const categoryId = validateStringParam(params, "categoryId", true);
      const name = validateStringParam(params, "name");
      const description = validateStringParam(params, "description");
      const icon = validateStringParam(params, "icon");
      const sortOrder = validateNumberParam(params, "sortOrder");
      const isActive = params.isActive as boolean | undefined;

      if (!categoryId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing categoryId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 更新技能分类`, { categoryId });

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (icon !== undefined) updateData.icon = icon;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (isActive !== undefined) updateData.isActive = isActive;

      const category = await updateCategory(categoryId, updateData);

      if (!category) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Category not found: ${categoryId}`),
        );
        return;
      }

      const responseCategory = {
        id: category.id,
        name: category.name,
        code: category.id,
        description: category.description || "",
        icon: category.icon || "folder",
        sortOrder: category.sortOrder,
        skillCount: category.skillCount,
        isActive: category.isActive,
        createdAt: category.createdAt?.toISOString() || "",
        updatedAt: category.updatedAt?.toISOString() || "",
      };

      respond(
        true,
        {
          success: true,
          category: responseCategory,
          message: "分类更新成功",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 更新技能分类失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 删除技能分类
   */
  "admin.skills.categories.delete": async ({ params, respond, context }) => {
    try {
      const categoryId = validateStringParam(params, "categoryId", true);

      if (!categoryId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing categoryId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 删除技能分类`, { categoryId });

      const success = await deleteCategory(categoryId);

      if (!success) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Category not found: ${categoryId}`),
        );
        return;
      }

      respond(
        true,
        {
          success: true,
          categoryId,
          message: "分类删除成功",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 删除技能分类失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取推荐技能列表
   */
  "admin.skills.featured.list": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取推荐技能列表`);

      const featuredSkills = await getFeaturedSkills();

      // 获取分类列表用于补充分类名称
      const categoryResult = await getCategoryList();
      const categoryMap = new Map(categoryResult.items.map((c) => [c.id, c.name]));

      // 转换为前端期望的格式
      const skills = featuredSkills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description || "",
        version: s.version,
        category: s.categoryId || "",
        categoryName: s.categoryId ? categoryMap.get(s.categoryId) || "" : "",
        icon: s.iconUrl || "puzzle",
        author: s.authorName || "Unknown",
        authorId: s.authorId || "",
        status: s.status,
        subscription: s.subscriptionLevel,
        runMode: "local" as const,
        tags: (s.tags as string[]) || [],
        installCount: s.downloadCount,
        rating: s.ratingAvg ? parseFloat(s.ratingAvg) : undefined,
        ratingCount: s.ratingCount,
        featured: s.isFeatured,
        featuredOrder: s.featuredOrder,
        createdAt: s.createdAt?.toISOString() || "",
        updatedAt: s.updatedAt?.toISOString() || "",
        publishedAt: s.publishedAt?.toISOString() || undefined,
      }));

      respond(
        true,
        {
          success: true,
          skills,
          total: skills.length,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取推荐技能列表失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 更新推荐技能排序
   */
  "admin.skills.featured.reorder": async ({ params, respond, context }) => {
    try {
      const skillIds = params.skillIds as string[];

      if (!skillIds || !Array.isArray(skillIds)) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillIds array"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 更新推荐技能排序`, { skillIds });

      // 构建排序更新数据
      const items = skillIds.map((id, index) => ({
        id,
        order: index + 1,
      }));

      await updateFeaturedOrder(items);

      respond(
        true,
        {
          success: true,
          message: "推荐排序更新成功",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 更新推荐技能排序失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 管理员创建技能并直接发布
   *
   * 管理员创建的技能跳过审核流程，直接设置为 published 状态
   *
   * 参数：
   * - name: string (必填) - 技能名称
   * - description: string - 技能描述
   * - version: string - 版本号 (默认 1.0.0)
   * - categoryId: string - 分类 ID
   * - subscriptionLevel: string - 订阅级别 (free/pro/team/enterprise)
   * - iconUrl: string - 图标 URL
   * - tags: string[] - 标签列表
   * - readme: string - 详细说明 (Markdown)
   * - manifestUrl: string - 配置文件 URL
   * - packageUrl: string - 技能包 URL
   * - config: object - 技能配置
   */
  "admin.skills.create": async ({ params, respond, context }) => {
    try {
      const name = validateStringParam(params, "name", true)!;
      const description = validateStringParam(params, "description");
      const version = validateStringParam(params, "version") || "1.0.0";
      const categoryId = validateStringParam(params, "categoryId");
      const subscriptionLevel = validateStringParam(params, "subscriptionLevel") || "free";
      const iconUrl = validateStringParam(params, "iconUrl");
      const readme = validateStringParam(params, "readme");
      const manifestUrl = validateStringParam(params, "manifestUrl");
      const packageUrl = validateStringParam(params, "packageUrl");
      const tags = params.tags as string[] | undefined;
      const config = params.config as Record<string, unknown> | undefined;

      context.logGateway.info(`[${LOG_TAG}] 管理员创建技能`, {
        name,
        categoryId,
        subscriptionLevel,
      });

      const skill = await createSkill({
        name,
        description: description || null,
        readme: readme || null,
        version,
        categoryId: categoryId || null,
        tags: tags || null,
        subscriptionLevel: (subscriptionLevel as SubscriptionLevel) || "free",
        iconUrl: iconUrl || null,
        manifestUrl: manifestUrl || null,
        packageUrl: packageUrl || null,
        config: config || null,
        // 管理员创建直接发布，跳过审核
        status: "published" as SkillStatus,
        authorId: null,
        authorName: "管理员",
      });

      context.logGateway.info(`[${LOG_TAG}] 技能创建成功`, { skillId: skill.id, name });

      respond(
        true,
        {
          success: true,
          skill,
          message: "技能创建成功，已直接发布",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 创建技能失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },
};
