/**
 * 绠＄悊鍛樻妧鑳藉晢搴楃鐞?RPC 鏂规硶澶勭悊鍣? *
 * 鎻愪緵绠＄悊鍛樼鐞嗘妧鑳藉晢搴楃殑 RPC 鏂规硶锛屼娇鐢ㄧ湡瀹炴暟鎹簱鏌ヨ
 */

import { ErrorCodes, errorShape } from "../../protocol/index.js";
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
  type SkillListQuery,
} from "../../assistant/skills/skill-service.js";
import {
  approveSkill,
  rejectSkill,
  publishSkill,
  unpublishSkill,
} from "../../assistant/skills/skill-review-service.js";
import type { SkillStatus, SubscriptionLevel } from "../../db/schema/index.js";

// 鏃ュ織鏍囩
const LOG_TAG = "admin-skills";

/**
 * 楠岃瘉瀛楃涓插弬鏁? */
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
 * 楠岃瘉鏁板瓧鍙傛暟
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
 * 绠＄悊鍛樻妧鑳藉晢搴楃鐞?RPC 鏂规硶澶勭悊鍣? */
export const adminSkillHandlers: GatewayRequestHandlers = {
  /**
   * 鑾峰彇鎶€鑳界粺璁?   */
  "admin.skills.stats": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鎶€鑳界粺璁);

      // 浠庢暟鎹簱鑾峰彇缁熻鏁版嵁
      const stats = await getSkillStats();

      // 鑾峰彇鍒嗙被鍒嗗竷
      const categoryResult = await getCategoryList();
      const categoryDistribution = categoryResult.items.map((c) => ({
        category: c.id,
        categoryName: c.name,
        count: c.skillCount,
      }));

      // 鑾峰彇 Top 鎶€鑳?      const topResult = await getSkillList({
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

      // 鑾峰彇璁㈤槄鍒嗗竷锛堜粠鏁版嵁搴撴煡璇級
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

      // 璁＄畻鎬讳笅杞介噺
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
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇鎶€鑳界粺璁″け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鑾峰彇鎶€鑳藉垪琛?   */
  "admin.skills.list": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鎶€鑳藉垪琛╜, { params });

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

      // 鏋勫缓鏌ヨ鍙傛暟
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

      // 鑾峰彇鍒嗙被鍒楄〃鐢ㄤ簬琛ュ厖鍒嗙被鍚嶇О
      const categoryResult = await getCategoryList();
      const categoryMap = new Map(categoryResult.items.map((c) => [c.id, c.name]));

      // 杞崲鎶€鑳芥暟鎹牸寮忎互鍖归厤鍓嶇鏈熸湜
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
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇鎶€鑳藉垪琛ㄥけ璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鑾峰彇鎶€鑳借鎯?   */
  "admin.skills.get": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鎶€鑳借鎯卄, { skillId });

      const skill = await getSkill(skillId);

      if (!skill) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Skill not found: ${skillId}`),
        );
        return;
      }

      // 鑾峰彇鍒嗙被鍚嶇О
      let categoryName = "";
      if (skill.categoryId) {
        const categoryResult = await getCategoryList();
        const category = categoryResult.items.find((c) => c.id === skill.categoryId);
        categoryName = category?.name || "";
      }

      // 杞崲涓鸿鎯呮牸寮?      const detail = {
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
          skill.readme || `# ${skill.name}\n\n${skill.description || ""}\n\n## 浣跨敤鏂规硶\n\n...`,
        changelog: `## v${skill.version}\n- 褰撳墠鐗堟湰`,
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
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇鎶€鑳借鎯呭け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, errorMessage));
    }
  },

  /**
   * 瀹℃牳鎶€鑳?   */
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

      context.logGateway.info(`[${LOG_TAG}] 瀹℃牳鎶€鑳絗, { skillId, action, notes });

      // 浣跨敤榛樿鍊硷紝鍥犱负 GatewayRequestContext 涓嶅寘鍚?adminId
      const adminId = "system";

      let result;
      if (action === "approve") {
        result = await approveSkill(skillId, adminId, notes);
      } else {
        result = await rejectSkill(skillId, adminId, notes || "瀹℃牳鏈€氳繃");
      }

      if (!result.success) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "瀹℃牳澶辫触"),
        );
        return;
      }

      respond(
        true,
        {
          success: true,
          skillId,
          status: result.skill?.status,
          message: action === "approve" ? "鎶€鑳藉凡閫氳繃瀹℃牳" : "鎶€鑳藉凡鎷掔粷",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 瀹℃牳鎶€鑳藉け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鍙戝竷/涓嬫灦鎶€鑳?   */
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

      context.logGateway.info(`[${LOG_TAG}] 鍙戝竷/涓嬫灦鎶€鑳絗, { skillId, action, reason });

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
          errorShape(ErrorCodes.INVALID_REQUEST, result.error || "鎿嶄綔澶辫触"),
        );
        return;
      }

      respond(
        true,
        {
          success: true,
          skillId,
          status: result.skill?.status,
          message: action === "publish" ? "鎶€鑳藉凡涓婃灦" : "鎶€鑳藉凡涓嬫灦",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鍙戝竷/涓嬫灦鎶€鑳藉け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 璁剧疆鎶€鑳芥帹鑽?   */
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

      context.logGateway.info(`[${LOG_TAG}] 璁剧疆鎶€鑳芥帹鑽恅, { skillId, featured, order });

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
          message: featured ? "鎶€鑳藉凡璁句负鎺ㄨ崘" : "鎶€鑳藉凡鍙栨秷鎺ㄨ崘",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 璁剧疆鎶€鑳芥帹鑽愬け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鑾峰彇鎶€鑳藉垎绫诲垪琛?   */
  "admin.skills.categories.list": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鎶€鑳藉垎绫诲垪琛╜);

      const result = await getCategoryList();

      // 杞崲涓哄墠绔湡鏈涚殑鏍煎紡
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
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇鎶€鑳藉垎绫诲垪琛ㄥけ璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鍒涘缓鎶€鑳藉垎绫?   */
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

      context.logGateway.info(`[${LOG_TAG}] 鍒涘缓鎶€鑳藉垎绫籤, { name, code });

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
          message: "鍒嗙被鍒涘缓鎴愬姛",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鍒涘缓鎶€鑳藉垎绫诲け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鏇存柊鎶€鑳藉垎绫?   */
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

      context.logGateway.info(`[${LOG_TAG}] 鏇存柊鎶€鑳藉垎绫籤, { categoryId });

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
          message: "鍒嗙被鏇存柊鎴愬姛",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鏇存柊鎶€鑳藉垎绫诲け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鍒犻櫎鎶€鑳藉垎绫?   */
  "admin.skills.categories.delete": async ({ params, respond, context }) => {
    try {
      const categoryId = validateStringParam(params, "categoryId", true);

      if (!categoryId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing categoryId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 鍒犻櫎鎶€鑳藉垎绫籤, { categoryId });

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
          message: "鍒嗙被鍒犻櫎鎴愬姛",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鍒犻櫎鎶€鑳藉垎绫诲け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鑾峰彇鎺ㄨ崘鎶€鑳藉垪琛?   */
  "admin.skills.featured.list": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鎺ㄨ崘鎶€鑳藉垪琛╜);

      const featuredSkills = await getFeaturedSkills();

      // 鑾峰彇鍒嗙被鍒楄〃鐢ㄤ簬琛ュ厖鍒嗙被鍚嶇О
      const categoryResult = await getCategoryList();
      const categoryMap = new Map(categoryResult.items.map((c) => [c.id, c.name]));

      // 杞崲涓哄墠绔湡鏈涚殑鏍煎紡
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
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇鎺ㄨ崘鎶€鑳藉垪琛ㄥけ璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 鏇存柊鎺ㄨ崘鎶€鑳芥帓搴?   */
  "admin.skills.featured.reorder": async ({ params, respond, context }) => {
    try {
      const skillIds = params.skillIds as string[];

      if (!skillIds || !Array.isArray(skillIds)) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillIds array"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 鏇存柊鎺ㄨ崘鎶€鑳芥帓搴廯, { skillIds });

      // 鏋勫缓鎺掑簭鏇存柊鏁版嵁
      const items = skillIds.map((id, index) => ({
        id,
        order: index + 1,
      }));

      await updateFeaturedOrder(items);

      respond(
        true,
        {
          success: true,
          message: "鎺ㄨ崘鎺掑簭鏇存柊鎴愬姛",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鏇存柊鎺ㄨ崘鎶€鑳芥帓搴忓け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },
};
