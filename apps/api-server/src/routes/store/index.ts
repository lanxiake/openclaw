/**
 * 技能商店 API 路由
 *
 * 提供技能商店的浏览、搜索、安装等功能
 * 浏览 API 公开（无需认证），安装/评价需要用户认证
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  queryStoreSkills,
  getStoreSkillDetail,
  getFeaturedSkills,
  getPopularSkills,
  getRecentSkills,
  getStoreStats,
  searchSkills,
  type StoreFilters,
} from "../../../../../src/assistant/skills/store.js";
import { getCategoryList } from "../../../../../src/assistant/skills/skill-service.js";

/**
 * 从请求中获取当前用户信息
 */
function getRequestUser(request: FastifyRequest): { userId: string } | null {
  return (request as unknown as { user?: { userId: string } }).user ?? null;
}

/**
 * 注册技能商店路由
 */
export function registerStoreRoutes(server: FastifyInstance): void {
  /**
   * GET /api/store/skills - 获取技能列表（公开）
   */
  server.get(
    "/api/store/skills",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const query = request.query as {
        category?: string;
        tags?: string;
        subscription?: string;
        sortBy?: string;
        search?: string;
        offset?: string;
        limit?: string;
      };

      request.log.info("[store] 查询技能列表");

      const filters: StoreFilters = {
        category: query.category,
        tags: query.tags ? query.tags.split(",") : undefined,
        subscription: query.subscription as "free" | "premium" | "enterprise" | "all" | undefined,
        sortBy: query.sortBy as "downloads" | "rating" | "updated" | "name" | undefined,
        search: query.search,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
      };

      const result = await queryStoreSkills(filters);

      return {
        success: true,
        data: result.skills,
        meta: {
          total: result.total,
          limit: filters.limit ?? 20,
          offset: filters.offset ?? 0,
        },
      };
    },
  );

  /**
   * GET /api/store/skills/featured - 获取推荐技能（公开）
   */
  server.get(
    "/api/store/skills/featured",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const query = request.query as { limit?: string };

      request.log.info("[store] 查询推荐技能");

      const limit = query.limit ? parseInt(query.limit, 10) : 10;
      const skills = await getFeaturedSkills(limit);

      return { success: true, data: skills };
    },
  );

  /**
   * GET /api/store/skills/popular - 获取热门技能（公开）
   */
  server.get(
    "/api/store/skills/popular",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const query = request.query as { limit?: string };

      request.log.info("[store] 查询热门技能");

      const limit = query.limit ? parseInt(query.limit, 10) : 10;
      const skills = await getPopularSkills(limit);

      return { success: true, data: skills };
    },
  );

  /**
   * GET /api/store/skills/recent - 获取最新技能（公开）
   */
  server.get(
    "/api/store/skills/recent",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const query = request.query as { limit?: string };

      request.log.info("[store] 查询最新技能");

      const limit = query.limit ? parseInt(query.limit, 10) : 10;
      const skills = await getRecentSkills(limit);

      return { success: true, data: skills };
    },
  );

  /**
   * GET /api/store/skills/search - 搜索技能（公开）
   */
  server.get(
    "/api/store/skills/search",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as {
        q?: string;
        limit?: string;
      };

      if (!query.q) {
        return reply.code(400).send({
          success: false,
          error: "Search query is required",
          code: "BAD_REQUEST",
        });
      }

      request.log.info({ query: query.q }, "[store] 搜索技能");

      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const skills = await searchSkills(query.q, limit);

      return { success: true, data: skills };
    },
  );

  /**
   * GET /api/store/skills/:id - 获取技能详情（公开）
   */
  server.get(
    "/api/store/skills/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      request.log.info({ skillId: id }, "[store] 查询技能详情");

      const skill = await getStoreSkillDetail(id);

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
   * GET /api/store/categories - 获取分类列表（公开）
   */
  server.get(
    "/api/store/categories",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      request.log.info("[store] 查询分类列表");

      const categories = await getCategoryList();

      return { success: true, data: categories };
    },
  );

  /**
   * GET /api/store/stats - 获取商店统计（公开）
   */
  server.get(
    "/api/store/stats",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      request.log.info("[store] 查询商店统计");

      const stats = await getStoreStats();

      return { success: true, data: stats };
    },
  );

  /**
   * POST /api/store/skills/:id/install - 安装技能（需认证）
   */
  server.post(
    "/api/store/skills/:id/install",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info(
        { userId: user.userId, skillId: id },
        "[store] 安装技能",
      );

      // 实际安装逻辑在 Sprint 11 实现
      // 当前仅返回成功响应
      return {
        success: true,
        data: {
          message: "Skill installation queued",
          skillId: id,
          userId: user.userId,
        },
      };
    },
  );

  /**
   * DELETE /api/store/skills/:id/install - 卸载技能（需认证）
   */
  server.delete(
    "/api/store/skills/:id/install",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info(
        { userId: user.userId, skillId: id },
        "[store] 卸载技能",
      );

      // 实际卸载逻辑在 Sprint 11 实现
      return {
        success: true,
        data: {
          message: "Skill uninstalled",
          skillId: id,
        },
      };
    },
  );
}
