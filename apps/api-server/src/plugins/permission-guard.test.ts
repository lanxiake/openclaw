/**
 * 权限守卫插件测试
 *
 * 测试用例：
 * - PERM-001: super_admin 访问任意资源成功
 * - PERM-002: admin 访问默认权限内资源成功
 * - PERM-003: operator 访问受限资源返回 403
 * - PERM-004: operator 有自定义权限时访问成功
 * - PERM-005: 无 token 返回 401
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";

import type { AdminPermissions, AdminRole } from "../../../../src/db/schema/admins.js";

import {
  requirePermission,
  ROLE_DEFAULT_PERMISSIONS,
  hasPermission,
} from "./permission-guard.js";
import type { RequestAdmin } from "./admin-auth.js";

// Mock getRequestAdmin
vi.mock("./admin-auth.js", () => ({
  getRequestAdmin: vi.fn(),
}));

import { getRequestAdmin } from "./admin-auth.js";

const mockGetRequestAdmin = vi.mocked(getRequestAdmin);

/**
 * 创建 mock request 对象
 */
function createMockRequest(): FastifyRequest {
  return {
    log: {
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    },
  } as unknown as FastifyRequest;
}

/**
 * 创建 mock reply 对象
 */
function createMockReply(): FastifyReply & { sentCode: number; sentBody: unknown } {
  const reply = {
    sentCode: 0,
    sentBody: null as unknown,
    code: vi.fn().mockImplementation(function (this: typeof reply, code: number) {
      this.sentCode = code;
      return this;
    }),
    send: vi.fn().mockImplementation(function (this: typeof reply, body: unknown) {
      this.sentBody = body;
      return this;
    }),
  };
  return reply as unknown as FastifyReply & { sentCode: number; sentBody: unknown };
}

describe("permission-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ROLE_DEFAULT_PERMISSIONS", () => {
    it("应该为 operator 定义基础只读权限", () => {
      const operatorPerms = ROLE_DEFAULT_PERMISSIONS.operator;
      expect(operatorPerms.users?.view).toBe(true);
      expect(operatorPerms.users?.edit).toBeUndefined();
      expect(operatorPerms.users?.suspend).toBeUndefined();
      expect(operatorPerms.subscriptions?.view).toBe(true);
      expect(operatorPerms.skills?.view).toBe(true);
      expect(operatorPerms.system?.viewLogs).toBe(true);
    });

    it("应该为 admin 定义管理权限", () => {
      const adminPerms = ROLE_DEFAULT_PERMISSIONS.admin;
      expect(adminPerms.users?.view).toBe(true);
      expect(adminPerms.users?.edit).toBe(true);
      expect(adminPerms.users?.suspend).toBe(true);
      expect(adminPerms.subscriptions?.view).toBe(true);
      expect(adminPerms.subscriptions?.edit).toBe(true);
      expect(adminPerms.skills?.create).toBe(true);
      expect(adminPerms.skills?.publish).toBe(true);
      expect(adminPerms.system?.editConfig).toBe(true);
    });

    it("应该为 super_admin 定义空对象（拥有所有权限）", () => {
      const superAdminPerms = ROLE_DEFAULT_PERMISSIONS.super_admin;
      expect(Object.keys(superAdminPerms)).toHaveLength(0);
    });
  });

  describe("hasPermission", () => {
    it("super_admin 应该拥有所有权限", () => {
      const admin: RequestAdmin = {
        adminId: "admin-1",
        role: "super_admin",
        type: "admin",
      };
      expect(hasPermission(admin, "users", "delete")).toBe(true);
      expect(hasPermission(admin, "admins", "delete")).toBe(true);
      expect(hasPermission(admin, "system", "editConfig")).toBe(true);
    });

    it("admin 应该拥有角色默认权限", () => {
      const admin: RequestAdmin = {
        adminId: "admin-1",
        role: "admin",
        type: "admin",
      };
      expect(hasPermission(admin, "users", "suspend")).toBe(true);
      expect(hasPermission(admin, "skills", "publish")).toBe(true);
    });

    it("admin 不应该拥有超出角色的权限", () => {
      const admin: RequestAdmin = {
        adminId: "admin-1",
        role: "admin",
        type: "admin",
      };
      expect(hasPermission(admin, "admins", "delete")).toBe(false);
      expect(hasPermission(admin, "users", "delete")).toBe(false);
    });

    it("operator 应该只有只读权限", () => {
      const admin: RequestAdmin = {
        adminId: "admin-1",
        role: "operator",
        type: "admin",
      };
      expect(hasPermission(admin, "users", "view")).toBe(true);
      expect(hasPermission(admin, "users", "suspend")).toBe(false);
      expect(hasPermission(admin, "skills", "create")).toBe(false);
    });

    it("operator 有自定义权限时应该覆盖默认", () => {
      const admin: RequestAdmin = {
        adminId: "admin-1",
        role: "operator",
        type: "admin",
        permissions: {
          users: { suspend: true },
          skills: { create: true, publish: true },
        },
      };
      expect(hasPermission(admin, "users", "suspend")).toBe(true);
      expect(hasPermission(admin, "skills", "create")).toBe(true);
      expect(hasPermission(admin, "skills", "publish")).toBe(true);
      // 未授权的仍然拒绝
      expect(hasPermission(admin, "users", "delete")).toBe(false);
    });

    it("自定义权限显式设为 false 时应覆盖角色默认权限", () => {
      const admin: RequestAdmin = {
        adminId: "admin-1",
        role: "admin",
        type: "admin",
        permissions: {
          users: { suspend: false },
        },
      };
      // admin 角色默认有 suspend 权限，但自定义权限显式禁用
      expect(hasPermission(admin, "users", "suspend")).toBe(false);
      // 未被自定义覆盖的权限仍从角色默认获取
      expect(hasPermission(admin, "users", "view")).toBe(true);
      expect(hasPermission(admin, "users", "edit")).toBe(true);
    });

    it("未知角色应拒绝所有权限", () => {
      const admin: RequestAdmin = {
        adminId: "admin-1",
        role: "unknown_role" as AdminRole,
        type: "admin",
      };
      expect(hasPermission(admin, "users", "view")).toBe(false);
      expect(hasPermission(admin, "system", "viewLogs")).toBe(false);
    });
  });

  describe("requirePermission middleware", () => {
    it("PERM-001: super_admin 访问任意资源成功", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      mockGetRequestAdmin.mockReturnValue({
        adminId: "super-admin-1",
        role: "super_admin",
        type: "admin",
      });

      const middleware = requirePermission("admins", "delete");
      await middleware(request, reply);

      // 不应该调用 reply.code 或 reply.send
      expect(reply.code).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it("PERM-002: admin 访问默认权限内资源成功", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      mockGetRequestAdmin.mockReturnValue({
        adminId: "admin-1",
        role: "admin",
        type: "admin",
      });

      const middleware = requirePermission("users", "suspend");
      await middleware(request, reply);

      expect(reply.code).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it("PERM-003: operator 访问受限资源返回 403", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      mockGetRequestAdmin.mockReturnValue({
        adminId: "operator-1",
        role: "operator",
        type: "admin",
      });

      const middleware = requirePermission("users", "suspend");
      await middleware(request, reply);

      expect(reply.sentCode).toBe(403);
      expect(reply.sentBody).toMatchObject({
        success: false,
        error: "Insufficient permissions: users.suspend",
        code: "FORBIDDEN",
      });
    });

    it("PERM-004: operator 有自定义权限时访问成功", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      mockGetRequestAdmin.mockReturnValue({
        adminId: "operator-1",
        role: "operator",
        type: "admin",
        permissions: {
          users: { suspend: true },
        },
      });

      const middleware = requirePermission("users", "suspend");
      await middleware(request, reply);

      expect(reply.code).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it("PERM-005: 无 token 返回 401", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      mockGetRequestAdmin.mockReturnValue(null);

      const middleware = requirePermission("users", "view");
      await middleware(request, reply);

      expect(reply.sentCode).toBe(401);
      expect(reply.sentBody).toMatchObject({
        success: false,
        error: "Admin authentication required",
        code: "ADMIN_UNAUTHORIZED",
      });
    });

    it("应该记录权限不足的警告日志", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      mockGetRequestAdmin.mockReturnValue({
        adminId: "operator-1",
        role: "operator",
        type: "admin",
      });

      const middleware = requirePermission("skills", "delete");
      await middleware(request, reply);

      expect(request.log.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: "operator-1",
          role: "operator",
          resource: "skills",
          action: "delete",
        }),
        expect.stringContaining("权限不足"),
      );
    });
  });
});
