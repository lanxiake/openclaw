/**
 * 审计日志 Fastify 插件
 *
 * 在 API Server 关键操作完成后自动写入审计日志
 * 支持认证、技能安装/卸载、设置变更等操作的审计记录
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  initAuditLog,
  writeAuditLog,
  type AuditEventType,
  type AuditSeverity,
  type CreateAuditLogInput,
} from "../../../../src/assistant/audit/index.js";

/**
 * 路由到审计事件的映射规则
 */
interface AuditRouteRule {
  /** HTTP 方法 */
  method: string;
  /** URL 前缀匹配 */
  urlPattern: string;
  /** 审计事件类型 */
  eventType: AuditEventType;
  /** 事件标题生成函数 */
  getTitle: (req: FastifyRequest) => string;
  /** 事件详情生成函数 */
  getDetail: (req: FastifyRequest) => string;
  /** 严重级别 */
  severity?: AuditSeverity;
}

/**
 * 审计路由规则
 */
const AUDIT_RULES: AuditRouteRule[] = [
  // 认证事件
  {
    method: "POST",
    urlPattern: "/api/auth/login",
    eventType: "auth.pair.success",
    getTitle: () => "用户登录",
    getDetail: (req) => `用户登录请求，IP: ${req.ip}`,
  },
  {
    method: "POST",
    urlPattern: "/api/auth/register",
    eventType: "auth.pair.success",
    getTitle: () => "用户注册",
    getDetail: () => "新用户注册",
  },
  // 技能安装/卸载
  {
    method: "POST",
    urlPattern: "/api/store/skills/",
    eventType: "skill.install",
    getTitle: () => "安装技能",
    getDetail: (req) => {
      const params = req.params as Record<string, string>;
      return `安装技能: ${params.id || "未知"}`;
    },
  },
  {
    method: "DELETE",
    urlPattern: "/api/store/skills/",
    eventType: "skill.uninstall",
    getTitle: () => "卸载技能",
    getDetail: (req) => {
      const params = req.params as Record<string, string>;
      return `卸载技能: ${params.id || "未知"}`;
    },
  },
  // 技能启用/禁用
  {
    method: "PATCH",
    urlPattern: "/api/store/skills/",
    eventType: "skill.enable",
    getTitle: (req) => {
      const url = req.url;
      return url.includes("/enable") ? "启用技能" : "禁用技能";
    },
    getDetail: (req) => {
      const params = req.params as Record<string, string>;
      const url = req.url;
      const action = url.includes("/enable") ? "启用" : "禁用";
      return `${action}技能: ${params.id || "未知"}`;
    },
  },
  // 设置变更
  {
    method: "PUT",
    urlPattern: "/api/audit/config",
    eventType: "settings.change",
    getTitle: () => "更新审计配置",
    getDetail: () => "修改审计日志配置",
  },
  {
    method: "PUT",
    urlPattern: "/api/users/me",
    eventType: "settings.change",
    getTitle: () => "更新用户资料",
    getDetail: () => "用户修改个人资料",
  },
  {
    method: "POST",
    urlPattern: "/api/users/me/change-password",
    eventType: "settings.change",
    getTitle: () => "修改密码",
    getDetail: () => "用户修改登录密码",
    severity: "warn",
  },
  // 设备配对
  {
    method: "POST",
    urlPattern: "/api/devices/pair",
    eventType: "auth.pair.request",
    getTitle: () => "设备配对",
    getDetail: () => "发起设备配对请求",
  },
];

/**
 * 匹配请求的审计规则
 */
function matchAuditRule(
  method: string,
  url: string,
): AuditRouteRule | undefined {
  return AUDIT_RULES.find(
    (rule) =>
      rule.method === method && url.startsWith(rule.urlPattern),
  );
}

/**
 * 从请求中获取用户 ID
 */
function getUserIdFromRequest(req: FastifyRequest): string | undefined {
  const user = (req as unknown as { user?: { userId?: string } }).user;
  return user?.userId;
}

/**
 * 注册审计日志中间件
 *
 * 在 Fastify 实例上注册 onResponse 钩子，
 * 请求完成后匹配审计规则并写入审计日志
 */
export async function registerAuditMiddleware(
  server: FastifyInstance,
): Promise<void> {
  // 初始化审计日志系统
  await initAuditLog();

  server.log.info("[audit-middleware] 审计日志中间件已注册");

  // 注册 onResponse 钩子
  server.addHook(
    "onResponse",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rule = matchAuditRule(request.method, request.url);
      if (!rule) {
        return;
      }

      const isSuccess = reply.statusCode >= 200 && reply.statusCode < 400;

      const input: CreateAuditLogInput = {
        eventType: rule.eventType,
        severity: rule.severity ?? "info",
        title: rule.getTitle(request),
        detail: rule.getDetail(request),
        source: {
          type: "user",
          name: "api-server",
          ip: request.ip,
        },
        result: isSuccess ? "success" : "failure",
        userId: getUserIdFromRequest(request),
        metadata: {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
        },
      };

      // 异步写入，不阻塞响应
      writeAuditLog(input).catch((err: unknown) => {
        request.log.error(
          { error: String(err) },
          "[audit-middleware] 写入审计日志失败",
        );
      });
    },
  );
}
