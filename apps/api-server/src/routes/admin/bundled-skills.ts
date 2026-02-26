/**
 * Bundled 技能管理 API 路由
 *
 * 管理员通过这些端点控制哪些 bundled 技能对用户可见。
 * 禁用列表存储在 systemConfigs 表的 bundled_skills.disabled 配置键中。
 *
 * GET    /api/admin/bundled-skills              - 获取所有 bundled 技能列表（含启用/禁用状态）
 * PUT    /api/admin/bundled-skills/:name/disable - 禁用一个 bundled 技能
 * PUT    /api/admin/bundled-skills/:name/enable  - 启用一个 bundled 技能
 * PUT    /api/admin/bundled-skills/batch         - 批量更新禁用列表
 */

import fs from "node:fs";
import path from "node:path";

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getConfigValue,
  setConfigValue,
} from "../../../../../src/assistant/config/config-service.js";
import { CONFIG_KEYS } from "../../../../../src/db/schema/system-config.js";
import { resolveBundledSkillsDir } from "../../../../../src/agents/skills/bundled-dir.js";
import { parseFrontmatter, resolveMtBotMetadata } from "../../../../../src/agents/skills/frontmatter.js";
import { getRequiredAdmin } from "../../plugins/admin-auth.js";
import { requirePermission } from "../../plugins/permission-guard.js";
import { getClientInfo } from "../../plugins/request-utils.js";

/**
 * Bundled 技能信息（API 返回类型）
 */
interface BundledSkillInfo {
  /** 技能名称（目录名） */
  name: string;
  /** 技能描述（来自 frontmatter） */
  description: string;
  /** 是否被管理员禁用 */
  isDisabled: boolean;
  /** 技能元数据（来自 frontmatter） */
  metadata: Record<string, unknown>;
}

/**
 * 扫描 bundled 技能目录并读取每个技能的元信息
 *
 * @returns bundled 技能信息列表
 */
function scanBundledSkills(): Array<Omit<BundledSkillInfo, "isDisabled">> {
  const bundledDir = resolveBundledSkillsDir();
  if (!bundledDir || !fs.existsSync(bundledDir)) {
    return [];
  }

  const entries = fs.readdirSync(bundledDir, { withFileTypes: true });
  const skills: Array<Omit<BundledSkillInfo, "isDisabled">> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillDir = path.join(bundledDir, entry.name);
    const skillMdPath = path.join(skillDir, "SKILL.md");

    let description = "";
    let metadata: Record<string, unknown> = {};

    if (fs.existsSync(skillMdPath)) {
      try {
        const content = fs.readFileSync(skillMdPath, "utf-8");
        const frontmatter = parseFrontmatter(content);
        description = (typeof frontmatter.description === "string" ? frontmatter.description : "") || "";
        const resolved = resolveMtBotMetadata(frontmatter);
        metadata = resolved ? { ...resolved } : {};
      } catch {
        // 忽略解析失败的技能文件
      }
    }

    skills.push({
      name: entry.name,
      description,
      metadata,
    });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 获取当前禁用的 bundled 技能名称列表
 *
 * @returns 禁用的技能名称数组
 */
async function getDisabledList(): Promise<string[]> {
  const raw = await getConfigValue<unknown>(CONFIG_KEYS.BUNDLED_SKILLS_DISABLED, []);
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string");
  }
  return [];
}

/**
 * 保存禁用列表到 systemConfigs 表
 *
 * @param disabled - 禁用的技能名称数组
 * @param adminId - 操作管理员 ID
 * @param clientInfo - 客户端信息
 */
async function saveDisabledList(
  disabled: string[],
  adminId: string,
  clientInfo: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  await setConfigValue(CONFIG_KEYS.BUNDLED_SKILLS_DISABLED, disabled, {
    enableHistory: true,
    adminId,
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
  });
}

/**
 * 注册 bundled 技能管理路由
 */
export function registerAdminBundledSkillsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/bundled-skills - 获取所有 bundled 技能列表
   *
   * 扫描文件系统 skills/ 目录，结合 systemConfigs 中的禁用列表
   * 返回每个技能的名称、描述、启用状态和元数据
   */
  server.get(
    "/api/admin/bundled-skills",
    { preHandler: requirePermission("system", "viewConfig") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      request.log.info(
        { adminId: admin.adminId },
        "[admin-bundled-skills] 查询 bundled 技能列表",
      );

      const [rawSkills, disabledList] = await Promise.all([
        Promise.resolve(scanBundledSkills()),
        getDisabledList(),
      ]);

      const disabledSet = new Set(disabledList);
      const skills: BundledSkillInfo[] = rawSkills.map((skill) => ({
        ...skill,
        isDisabled: disabledSet.has(skill.name),
      }));

      return {
        success: true,
        data: skills,
        meta: {
          total: skills.length,
          disabledCount: disabledList.length,
        },
      };
    },
  );

  /**
   * PUT /api/admin/bundled-skills/batch - 批量更新禁用列表
   *
   * 直接覆盖整个禁用列表。body: { disabled: string[] }
   */
  server.put(
    "/api/admin/bundled-skills/batch",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const body = request.body as { disabled?: unknown };
      const clientInfo = getClientInfo(request);

      if (!body || !Array.isArray(body.disabled)) {
        return {
          success: false,
          error: "请求体必须包含 disabled 数组",
        };
      }

      const disabled = body.disabled.filter((v): v is string => typeof v === "string");

      request.log.info(
        { adminId: admin.adminId, count: disabled.length },
        "[admin-bundled-skills] 批量更新禁用列表",
      );

      await saveDisabledList(disabled, admin.adminId, clientInfo);

      return {
        success: true,
        data: { disabled },
      };
    },
  );

  /**
   * PUT /api/admin/bundled-skills/:name/disable - 禁用一个 bundled 技能
   *
   * 将指定技能名称加入禁用列表
   */
  server.put(
    "/api/admin/bundled-skills/:name/disable",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { name } = request.params as { name: string };
      const clientInfo = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, skillName: name },
        "[admin-bundled-skills] 禁用 bundled 技能",
      );

      const currentList = await getDisabledList();
      if (!currentList.includes(name)) {
        currentList.push(name);
        await saveDisabledList(currentList, admin.adminId, clientInfo);
      }

      return {
        success: true,
        data: { name, isDisabled: true },
      };
    },
  );

  /**
   * PUT /api/admin/bundled-skills/:name/enable - 启用一个 bundled 技能
   *
   * 将指定技能名称从禁用列表移除
   */
  server.put(
    "/api/admin/bundled-skills/:name/enable",
    { preHandler: requirePermission("system", "editConfig") },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const admin = getRequiredAdmin(request);
      const { name } = request.params as { name: string };
      const clientInfo = getClientInfo(request);

      request.log.info(
        { adminId: admin.adminId, skillName: name },
        "[admin-bundled-skills] 启用 bundled 技能",
      );

      const currentList = await getDisabledList();
      const newList = currentList.filter((n) => n !== name);

      if (newList.length !== currentList.length) {
        await saveDisabledList(newList, admin.adminId, clientInfo);
      }

      return {
        success: true,
        data: { name, isDisabled: false },
      };
    },
  );
}
