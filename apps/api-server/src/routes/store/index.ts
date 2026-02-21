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
import {
  getCategoryList,
  getSkill,
  installSkillForUser,
  uninstallSkillForUser,
  getUserInstalledSkills,
} from "../../../../../src/assistant/skills/skill-service.js";
import { downloadSkillFile } from "../../../../../src/assistant/skills/skill-storage-service.js";

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
   * GET /api/store/skills/installed - 获取用户已安装技能列表（需认证）
   */
  server.get(
    "/api/store/skills/installed",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info({ userId: user.userId }, "[store] 查询已安装技能");

      const results = await getUserInstalledSkills(user.userId);

      return {
        success: true,
        data: results.map((r) => ({
          ...r.installed,
          skill: r.skill,
        })),
      };
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

      const result = await installSkillForUser(user.userId, id);

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.message,
          code: "INSTALL_FAILED",
        });
      }

      /** 获取完整技能信息用于返回下载 URL */
      const skill = await getSkill(id);
      const hasPackage = skill?.packageStorageKey != null;

      return {
        success: true,
        data: {
          message: result.message,
          skillId: id,
          installed: result.installed,
          downloadUrl: hasPackage ? `/api/store/skills/${id}/download` : null,
        },
      };
    },
  );

  /**
   * GET /api/store/skills/:id/download - 下载技能包（需认证 + 已安装）
   */
  server.get(
    "/api/store/skills/:id/download",
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
        "[store] 下载技能包",
      );

      /** 确认技能存在且有包文件 */
      const skill = await getSkill(id);
      if (!skill) {
        return reply.code(404).send({
          success: false,
          error: "Skill not found",
          code: "NOT_FOUND",
        });
      }

      if (!skill.packageStorageKey) {
        return reply.code(404).send({
          success: false,
          error: "Skill package not available",
          code: "NO_PACKAGE",
        });
      }

      /** 下载文件流 */
      try {
        const stream = await downloadSkillFile(skill.packageStorageKey);

        return reply
          .header("Content-Type", "application/octet-stream")
          .header("Content-Disposition", `attachment; filename="skill-${id}.zip"`)
          .header("X-Package-Hash", skill.packageHash || "")
          .header("X-Package-Size", String(skill.packageSize || 0))
          .send(stream);
      } catch (error) {
        request.log.error(
          { skillId: id, error },
          "[store] 下载技能包失败",
        );
        return reply.code(500).send({
          success: false,
          error: "Failed to download skill package",
          code: "DOWNLOAD_FAILED",
        });
      }
    },
  );

  /**
   * GET /api/store/skills/updates - 检查已安装技能的更新（需认证）
   */
  server.get(
    "/api/store/skills/updates",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { userId: user.userId },
        "[store] 检查技能更新",
      );

      /** 获取已安装技能并对比版本 */
      const installed = await getUserInstalledSkills(user.userId);
      const updates = installed
        .filter((item) => item.installed.installedVersion !== item.skill.version)
        .map((item) => ({
          skillId: item.skill.id,
          name: item.skill.name,
          installedVersion: item.installed.installedVersion,
          latestVersion: item.skill.version,
        }));

      return {
        success: true,
        data: {
          skills: updates,
          total: updates.length,
        },
      };
    },
  );

  /**
   * POST /api/store/refresh - 刷新商店缓存（需认证）
   */
  server.post(
    "/api/store/refresh",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { userId: user.userId },
        "[store] 刷新商店缓存",
      );

      const stats = await getStoreStats();

      return {
        success: true,
        data: {
          refreshed: true,
          stats,
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

      const result = await uninstallSkillForUser(user.userId, id);

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.message,
          code: "UNINSTALL_FAILED",
        });
      }

      return {
        success: true,
        data: {
          message: result.message,
          skillId: id,
        },
      };
    },
  );
}
