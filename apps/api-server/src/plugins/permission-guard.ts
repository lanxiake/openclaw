/**
 * 权限守卫插件
 *
 * 实现 RBAC + PBAC 混合权限模型：
 * 1. super_admin 拥有所有权限
 * 2. 检查 JWT 内嵌的自定义权限（数据库覆盖）
 * 3. 检查角色默认权限
 * 4. 拒绝访问
 */

import type { FastifyRequest, FastifyReply } from "fastify";

import type { AdminRole, AdminPermissions } from "../../../../src/db/schema/admins.js";

import { getRequestAdmin, type RequestAdmin } from "./admin-auth.js";

/**
 * 角色默认权限映射
 *
 * 定义每个角色的基础权限，可被数据库中的自定义权限覆盖
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<AdminRole, AdminPermissions> = {
  /** operator: 只读权限 */
  operator: {
    users: { view: true },
    subscriptions: { view: true },
    skills: { view: true },
    system: { viewLogs: true },
  },
  /** admin: 管理权限（不含管理员管理和用户删除） */
  admin: {
    users: { view: true, edit: true, suspend: true },
    subscriptions: { view: true, edit: true },
    skills: { view: true, create: true, edit: true, publish: true, delete: true },
    system: { viewConfig: true, editConfig: true, viewLogs: true /* resetConfig: 仅 super_admin */ },
    admins: { view: true },
  },
  /** super_admin: 拥有所有权限，无需枚举 */
  super_admin: {},
};

/**
 * 检查管理员是否拥有指定权限
 *
 * 权限检查优先级：
 * 1. super_admin → 拥有所有权限
 * 2. admin.permissions[resource][action] → 数据库覆盖（JWT 内嵌）
 * 3. ROLE_DEFAULT_PERMISSIONS[role][resource][action] → 角色默认
 * 4. 拒绝访问
 *
 * @param admin - 管理员信息
 * @param resource - 资源类型
 * @param action - 操作类型
 * @returns 是否有权限
 */
export function hasPermission(
  admin: RequestAdmin,
  resource: keyof AdminPermissions,
  action: string,
): boolean {
  // 1. super_admin 拥有所有权限
  if (admin.role === "super_admin") {
    return true;
  }

  // 2. 检查 JWT 内嵌的自定义权限
  const customPerms = admin.permissions?.[resource];
  if (customPerms && action in customPerms) {
    return customPerms[action as keyof typeof customPerms] === true;
  }

  // 3. 检查角色默认权限
  const rolePerms = ROLE_DEFAULT_PERMISSIONS[admin.role];
  if (rolePerms) {
    const resourcePerms = rolePerms[resource];
    if (resourcePerms && action in resourcePerms) {
      return resourcePerms[action as keyof typeof resourcePerms] === true;
    }
  }

  // 4. 拒绝访问
  return false;
}

/**
 * 权限检查守卫工厂
 *
 * 创建一个 Fastify preHandler 中间件，用于检查管理员是否拥有指定权限
 *
 * @param resource - 资源类型 (users, subscriptions, skills, system, admins)
 * @param action - 操作类型 (view, edit, create, delete, suspend, etc.)
 * @returns Fastify preHandler 中间件
 *
 * @example
 * ```typescript
 * server.post(
 *   "/api/admin/users/:id/suspend",
 *   { preHandler: requirePermission("users", "suspend") },
 *   handler
 * );
 * ```
 */
export function requirePermission(resource: keyof AdminPermissions, action: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const admin = getRequestAdmin(request);

    // 未认证
    if (!admin) {
      return reply.code(401).send({
        success: false,
        error: "Admin authentication required",
        code: "ADMIN_UNAUTHORIZED",
      });
    }

    // 检查权限
    if (hasPermission(admin, resource, action)) {
      return;
    }

    // 权限不足，记录日志
    request.log.warn(
      { adminId: admin.adminId, role: admin.role, resource, action },
      "[permission-guard] 权限不足",
    );

    return reply.code(403).send({
      success: false,
      error: `Insufficient permissions: ${resource}.${action}`,
      code: "FORBIDDEN",
    });
  };
}
