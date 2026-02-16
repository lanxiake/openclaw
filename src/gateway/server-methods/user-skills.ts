/**
 * 用户技能商店 RPC 方法处理器
 *
 * 提供用户上传、管理自己技能的 RPC 方法
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import {
  getSkillList,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  type SkillListQuery,
} from "../../assistant/skills/skill-service.js";
import {
  uploadSkillFile,
  deleteAllSkillFiles,
  type SkillFileUploadParams,
} from "../../assistant/skills/skill-storage-service.js";
import { extractUserContext } from "../auth-context.js";
import type { SkillStatus, SubscriptionLevel } from "../../db/schema/index.js";

// 日志标签
const LOG_TAG = "user-skills";

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
 * 用户技能商店 RPC 方法处理器
 */
export const userSkillHandlers: GatewayRequestHandlers = {
  /**
   * 获取我的技能列表
   */
  "user.skills.mySkills": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取我的技能列表`);

      // 提取用户认证上下文
      const authContext = extractUserContext(params);
      if (!authContext) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "未授权：需要用户登录"),
        );
        return;
      }

      const { userId } = authContext;

      // 构建查询参数
      const query: SkillListQuery = {
        authorId: userId,
        page: typeof params.page === "number" ? params.page : 1,
        pageSize: typeof params.pageSize === "number" ? params.pageSize : 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      };

      // 查询技能列表
      const result = await getSkillList(query);

      respond(true, result, undefined);
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] 获取我的技能列表失败`, { error });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : "获取技能列表失败",
        ),
      );
    }
  },

  /**
   * 创建技能
   */
  "user.skills.create": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 创建技能`);

      // 提取用户认证上下文
      const authContext = extractUserContext(params);
      if (!authContext) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "未授权：需要用户登录"),
        );
        return;
      }

      const { userId } = authContext;

      // 验证参数
      const name = validateStringParam(params, "name", true);
      const description = validateStringParam(params, "description");
      const readme = validateStringParam(params, "readme");
      const categoryId = validateStringParam(params, "categoryId");
      const version = validateStringParam(params, "version") || "1.0.0";

      if (!name) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "技能名称不能为空"),
        );
        return;
      }

      // 创建技能（状态为 pending，等待审核）
      const skill = await createSkill({
        name,
        description,
        readme,
        authorId: userId,
        version,
        categoryId,
        status: "pending" as SkillStatus,
        subscriptionLevel: "free" as SubscriptionLevel,
        tags: Array.isArray(params.tags) ? params.tags : [],
      });

      context.logGateway.info(`[${LOG_TAG}] 技能创建成功`, {
        skillId: skill.id,
        name: skill.name,
      });

      respond(true, skill, undefined);
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] 创建技能失败`, { error });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : "创建技能失败",
        ),
      );
    }
  },

  /**
   * 更新技能
   */
  "user.skills.update": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 更新技能`);

      // 提取用户认证上下文
      const authContext = extractUserContext(params);
      if (!authContext) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "未授权：需要用户登录"),
        );
        return;
      }

      const { userId } = authContext;

      // 验证参数
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "技能 ID 不能为空"),
        );
        return;
      }

      // 检查技能是否存在且属于当前用户
      const existingSkill = await getSkill(skillId);
      if (!existingSkill) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "技能不存在"),
        );
        return;
      }

      if (existingSkill.authorId !== userId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "无权限修改此技能"),
        );
        return;
      }

      // 构建更新数据
      const updates: Record<string, unknown> = {};

      const name = validateStringParam(params, "name");
      if (name) updates.name = name;

      const description = validateStringParam(params, "description");
      if (description !== undefined) updates.description = description;

      const readme = validateStringParam(params, "readme");
      if (readme !== undefined) updates.readme = readme;

      const version = validateStringParam(params, "version");
      if (version) updates.version = version;

      const categoryId = validateStringParam(params, "categoryId");
      if (categoryId !== undefined) updates.categoryId = categoryId;

      if (Array.isArray(params.tags)) {
        updates.tags = params.tags;
      }

      // 更新技能
      const updatedSkill = await updateSkill(skillId, updates);

      context.logGateway.info(`[${LOG_TAG}] 技能更新成功`, {
        skillId,
        updates: Object.keys(updates),
      });

      respond(true, updatedSkill, undefined);
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] 更新技能失败`, { error });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : "更新技能失败",
        ),
      );
    }
  },

  /**
   * 删除技能
   */
  "user.skills.delete": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 删除技能`);

      // 提取用户认证上下文
      const authContext = extractUserContext(params);
      if (!authContext) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "未授权：需要用户登录"),
        );
        return;
      }

      const { userId } = authContext;

      // 验证参数
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "技能 ID 不能为空"),
        );
        return;
      }

      // 检查技能是否存在且属于当前用户
      const existingSkill = await getSkill(skillId);
      if (!existingSkill) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "技能不存在"),
        );
        return;
      }

      if (existingSkill.authorId !== userId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "无权限删除此技能"),
        );
        return;
      }

      // 删除技能文件
      await deleteAllSkillFiles(skillId);

      // 删除技能记录
      await deleteSkill(skillId);

      context.logGateway.info(`[${LOG_TAG}] 技能删除成功`, { skillId });

      respond(true, { success: true }, undefined);
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] 删除技能失败`, { error });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : "删除技能失败",
        ),
      );
    }
  },

  /**
   * 上传技能文件
   *
   * 注意：此方法接收 Base64 编码的文件数据
   * 实际生产环境应使用预签名 URL 直接上传到 MinIO
   */
  "user.skills.uploadFile": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 上传技能文件`);

      // 提取用户认证上下文
      const authContext = extractUserContext(params);
      if (!authContext) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "未授权：需要用户登录"),
        );
        return;
      }

      const { userId } = authContext;

      // 验证参数
      const skillId = validateStringParam(params, "skillId", true);
      const fileType = validateStringParam(params, "fileType", true);
      const originalName = validateStringParam(params, "originalName", true);
      const contentType = validateStringParam(params, "contentType", true);
      const dataBase64 = validateStringParam(params, "data", true);

      if (!skillId || !fileType || !originalName || !contentType || !dataBase64) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "缺少必需参数"),
        );
        return;
      }

      // 验证文件类型
      if (!["package", "icon", "manifest"].includes(fileType)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "无效的文件类型"),
        );
        return;
      }

      // 检查技能是否存在且属于当前用户
      const existingSkill = await getSkill(skillId);
      if (!existingSkill) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "技能不存在"),
        );
        return;
      }

      if (existingSkill.authorId !== userId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "无权限上传此技能的文件"),
        );
        return;
      }

      // 解码 Base64 数据
      const data = Buffer.from(dataBase64, "base64");

      // 上传文件
      const uploadParams: SkillFileUploadParams = {
        skillId,
        fileType: fileType as "package" | "icon" | "manifest",
        data,
        originalName,
        contentType,
        userId,
      };

      const result = await uploadSkillFile(uploadParams);

      // 更新技能记录中的文件 URL
      const updates: Record<string, string> = {};
      if (fileType === "package") {
        updates.packageUrl = result.url;
      } else if (fileType === "icon") {
        updates.iconUrl = result.url;
      } else if (fileType === "manifest") {
        updates.manifestUrl = result.url;
      }

      await updateSkill(skillId, updates);

      context.logGateway.info(`[${LOG_TAG}] 技能文件上传成功`, {
        skillId,
        fileType,
        size: result.size,
      });

      respond(true, result, undefined);
    } catch (error) {
      context.logGateway.error(`[${LOG_TAG}] 上传技能文件失败`, { error });
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          error instanceof Error ? error.message : "上传文件失败",
        ),
      );
    }
  },
};
