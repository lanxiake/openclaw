/**
 * 技能管理 API 路由
 *
 * GET    /api/admin/skills              - 获取技能列表
 * GET    /api/admin/skills/stats        - 获取技能统计
 * GET    /api/admin/skills/featured     - 获取推荐技能
 * GET    /api/admin/skills/categories   - 获取分类列表
 * GET    /api/admin/skills/:id          - 获取技能详情
 * POST   /api/admin/skills/:id/review   - 审核技能
 * POST   /api/admin/skills/:id/publish  - 发布技能
 * POST   /api/admin/skills/:id/unpublish - 下架技能
 * POST   /api/admin/skills/:id/featured - 设置推荐
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getSkillStats,
  getSkillList,
  getSkill,
  getCategoryList,
  getFeaturedSkills,
  setFeatured,
} from "../../../../../src/assistant/skills/skill-service.js";
import {
  approveSkill,
  rejectSkill,
  publishSkill,
  unpublishSkill,
} from "../../../../../src/assistant/skills/skill-review-service.js";
import { getRequestAdmin } from "../../plugins/admin-auth.js";

/**
 * 注册技能管理路由
 */
export function registerAdminSkillsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/skills - 获取技能列表
   */
  server.get(
    "/api/admin/skills",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const query = request.query as {
        page?: string;
        pageSize?: string;
        search?: string;
        status?: string;
        categoryId?: string;
        sortBy?: string;
        sortOrder?: string;
      };

      const page = Math.max(1, parseInt(query.page || "1", 10));
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(query.pageSize || "20", 10)),
      );

      request.log.info(
        { adminId: admin.adminId, page, pageSize },
        "[admin-skills] 查询技能列表",
      );

      const result = await getSkillList({
        page,
        pageSize,
        search: query.search,
        status: query.status,
        categoryId: query.categoryId,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder as "asc" | "desc" | undefined,
      });

      return {
        success: true,
        data: result.skills,
        meta: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      };
    },
  );

  /**
   * GET /api/admin/skills/stats - 获取技能统计
   */
  server.get(
    "/api/admin/skills/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { adminId: admin.adminId },
        "[admin-skills] 查询技能统计",
      );

      const stats = await getSkillStats();

      return { success: true, data: stats };
    },
  );

  /**
   * GET /api/admin/skills/featured - 获取推荐技能
   */
  server.get(
    "/api/admin/skills/featured",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { adminId: admin.adminId },
        "[admin-skills] 查询推荐技能",
      );

      const skills = await getFeaturedSkills();

      return { success: true, data: skills };
    },
  );

  /**
   * GET /api/admin/skills/categories - 获取分类列表
   */
  server.get(
    "/api/admin/skills/categories",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { adminId: admin.adminId },
        "[admin-skills] 查询分类列表",
      );

      const result = await getCategoryList();

      return { success: true, data: result.categories };
    },
  );

  /**
   * GET /api/admin/skills/:id - 获取技能详情
   */
  server.get(
    "/api/admin/skills/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, skillId: id },
        "[admin-skills] 查询技能详情",
      );

      const skill = await getSkill(id);
      if (!skill) {
        return reply.code(404).send({
          success: false,
          error: "Skill not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: skill };
    },
  );

  /**
   * POST /api/admin/skills/:id/review - 审核技能
   */
  server.post(
    "/api/admin/skills/:id/review",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      if (admin.role === "operator") {
        return reply.code(403).send({
          success: false,
          error: "Insufficient permissions",
          code: "FORBIDDEN",
        });
      }

      const { id } = request.params as { id: string };
      const { action, note, reason } = request.body as {
        action: "approve" | "reject";
        note?: string;
        reason?: string;
      };

      if (!action || !["approve", "reject"].includes(action)) {
        return reply.code(400).send({
          success: false,
          error: "Action must be 'approve' or 'reject'",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { adminId: admin.adminId, skillId: id, action },
        "[admin-skills] 审核技能",
      );

      let result;
      if (action === "approve") {
        result = await approveSkill(id, admin.adminId, note);
      } else {
        if (!reason) {
          return reply.code(400).send({
            success: false,
            error: "Reason is required for rejection",
            code: "VALIDATION_ERROR",
          });
        }
        result = await rejectSkill(id, admin.adminId, reason);
      }

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Review failed",
          code: "REVIEW_FAILED",
        });
      }

      return { success: true, data: { message: `Skill ${action}d successfully` } };
    },
  );

  /**
   * POST /api/admin/skills/:id/publish - 发布技能
   */
  server.post(
    "/api/admin/skills/:id/publish",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      if (admin.role === "operator") {
        return reply.code(403).send({
          success: false,
          error: "Insufficient permissions",
          code: "FORBIDDEN",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, skillId: id },
        "[admin-skills] 发布技能",
      );

      const result = await publishSkill(id);

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Publish failed",
          code: "PUBLISH_FAILED",
        });
      }

      return { success: true, data: { message: "Skill published successfully" } };
    },
  );

  /**
   * POST /api/admin/skills/:id/unpublish - 下架技能
   */
  server.post(
    "/api/admin/skills/:id/unpublish",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      if (admin.role === "operator") {
        return reply.code(403).send({
          success: false,
          error: "Insufficient permissions",
          code: "FORBIDDEN",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info(
        { adminId: admin.adminId, skillId: id },
        "[admin-skills] 下架技能",
      );

      const result = await unpublishSkill(id);

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error || "Unpublish failed",
          code: "UNPUBLISH_FAILED",
        });
      }

      return { success: true, data: { message: "Skill unpublished successfully" } };
    },
  );

  /**
   * POST /api/admin/skills/:id/featured - 设置推荐
   */
  server.post(
    "/api/admin/skills/:id/featured",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const admin = getRequestAdmin(request);
      if (!admin) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      if (admin.role === "operator") {
        return reply.code(403).send({
          success: false,
          error: "Insufficient permissions",
          code: "FORBIDDEN",
        });
      }

      const { id } = request.params as { id: string };
      const { featured, order } = request.body as {
        featured: boolean;
        order?: number;
      };

      if (typeof featured !== "boolean") {
        return reply.code(400).send({
          success: false,
          error: "Featured must be a boolean",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { adminId: admin.adminId, skillId: id, featured, order },
        "[admin-skills] 设置推荐",
      );

      const skill = await setFeatured(id, featured, order);

      if (!skill) {
        return reply.code(404).send({
          success: false,
          error: "Skill not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: skill };
    },
  );
}
