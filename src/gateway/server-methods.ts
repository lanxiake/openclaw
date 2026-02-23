import { ErrorCodes, errorShape } from "./protocol/index.js";
import { agentHandlers } from "./server-methods/agent.js";
import { agentsHandlers } from "./server-methods/agents.js";
import { assistantHandlers } from "./server-methods/assistant.js";
import { assistantAuditMethods } from "./server-methods/assistant-audit.js";
import { authMethods } from "./server-methods/assistant-auth.js";
import { deviceMethods } from "./server-methods/assistant-device.js";
import { assistantSkillHandlers } from "./server-methods/assistant-skills.js";
import { assistantSubscriptionMethods } from "./server-methods/assistant-subscription.js";
import { assistantCreditsMethods } from "./server-methods/assistant-credits.js";
import { migrationRpcMethods } from "./server-methods/assistant-migration.js";
import { paymentMethods } from "./server-methods/assistant-payment.js";
import { adminAuthMethods } from "./server-methods/admin-auth.js";
import { adminUserMethods } from "./server-methods/admin-users.js";
import { adminSubscriptionMethods } from "./server-methods/admin-subscriptions.js";
import { adminAuditMethods } from "./server-methods/admin-audit.js";
import { adminDashboardMethods } from "./server-methods/admin-dashboard.js";
import { adminSkillHandlers } from "./server-methods/admin-skills.js";
import { userSkillHandlers } from "./server-methods/user-skills.js";
import { adminMonitorHandlers } from "./server-methods/admin-monitor.js";
import { adminConfigHandlers } from "./server-methods/admin-config.js";
import { adminAnalyticsHandlers } from "./server-methods/admin-analytics.js";
import { adminLlmLogHandlers } from "./server-methods/admin-llm-logs.js";
import { adminCreditHandlers } from "./server-methods/admin-credits.js";
import { adminAdminMethods } from "./server-methods/admin-admins.js";
import { memoryHandlers } from "./server-methods/memory.js";
import { browserHandlers } from "./server-methods/browser.js";
import { channelsHandlers } from "./server-methods/channels.js";
import { chatHandlers } from "./server-methods/chat.js";
import { chatTodoHandlers } from "./server-methods/chat-todo.js";
import { chatQueueHandlers } from "./server-methods/chat-queue.js";
import { chatCheckpointHandlers } from "./server-methods/chat-checkpoint.js";
import { configHandlers } from "./server-methods/config.js";
import { connectHandlers } from "./server-methods/connect.js";
import { cronHandlers } from "./server-methods/cron.js";
import { deviceHandlers } from "./server-methods/devices.js";
import { execApprovalsHandlers } from "./server-methods/exec-approvals.js";
import { healthHandlers } from "./server-methods/health.js";
import { logsHandlers } from "./server-methods/logs.js";
import { modelsHandlers } from "./server-methods/models.js";
import { nodeHandlers } from "./server-methods/nodes.js";
import { sendHandlers } from "./server-methods/send.js";
import { sessionsHandlers } from "./server-methods/sessions.js";
import { skillsHandlers } from "./server-methods/skills.js";
import { systemHandlers } from "./server-methods/system.js";
import { talkHandlers } from "./server-methods/talk.js";
import { ttsHandlers } from "./server-methods/tts.js";
import type { GatewayRequestHandlers, GatewayRequestOptions } from "./server-methods/types.js";
import { updateHandlers } from "./server-methods/update.js";
import { usageHandlers } from "./server-methods/usage.js";
import { voicewakeHandlers } from "./server-methods/voicewake.js";
import { webHandlers } from "./server-methods/web.js";
import { wizardHandlers } from "./server-methods/wizard.js";
import {
  checkUserQuota,
  recordQuotaUsage,
  createQuotaExceededError,
} from "./middleware/quota-check.js";
import { createEmptyRequestContext } from "./user-context.js";

const ADMIN_SCOPE = "operator.admin";
const READ_SCOPE = "operator.read";
const WRITE_SCOPE = "operator.write";
const APPROVALS_SCOPE = "operator.approvals";
const PAIRING_SCOPE = "operator.pairing";

/** user 角色的基础权限 scope */
const USER_BASIC_SCOPE = "user.basic";

const APPROVAL_METHODS = new Set(["exec.approval.request", "exec.approval.resolve"]);
const NODE_ROLE_METHODS = new Set(["node.invoke.result", "node.event", "skills.bins"]);
const PAIRING_METHODS = new Set([
  "node.pair.request",
  "node.pair.list",
  "node.pair.approve",
  "node.pair.reject",
  "node.pair.verify",
  "device.pair.list",
  "device.pair.approve",
  "device.pair.reject",
  "device.token.rotate",
  "device.token.revoke",
  "device.revoke",
  "node.rename",
]);
const ADMIN_METHOD_PREFIXES = ["exec.approvals."];
const READ_METHODS = new Set([
  "health",
  "logs.tail",
  "channels.status",
  "status",
  "usage.status",
  "usage.cost",
  "tts.status",
  "tts.providers",
  "models.list",
  "agents.list",
  "agent.identity.get",
  "skills.status",
  "voicewake.get",
  "sessions.list",
  "sessions.preview",
  "cron.list",
  "cron.status",
  "cron.runs",
  "system-presence",
  "last-heartbeat",
  "node.list",
  "node.describe",
  "chat.history",
  "assistant.info",
  "assistant.capabilities",
  "assistant.heartbeat",
  "heartbeat",
  // Assistant skill system methods
  "assistant.skills.list",
  "assistant.skills.listAll",
  "assistant.skills.get",
  "assistant.skills.tools",
  "assistant.skills.findByCommand",
  "assistant.skills.stats",
  // Assistant audit methods (read-only)
  "assistant.audit.query",
  "assistant.audit.recent",
  "assistant.audit.stats",
  "assistant.audit.config.get",
  // Assistant subscription methods (read-only)
  "assistant.subscription.plans",
  "assistant.subscription.plan",
  "assistant.subscription.get",
  "assistant.subscription.quota.check",
  "assistant.subscription.usage",
  "assistant.subscription.overview",
  // Assistant credits methods (read-only)
  "assistant.credits.balance",
  "assistant.credits.history",
  "assistant.credits.calculateCost",
  // Device methods (read-only)
  "device.list",
  "device.quota",
  "device.checkPaired",
  "device.info",
  "device.getUser",
  // Migration methods (read-only)
  "migration.status",
  "migration.getConfig",
  "migration.dualWrite.getStats",
  "migration.dualWrite.getConfig",
  "migration.rollback.status",
  // Payment methods (read-only)
  "payment.getOrder",
  "payment.queryOrders",
  "payment.getPaymentStatus",
  "payment.getRefundStatus",
  "payment.getUserPayments",
  "payment.getRecentTransactions",
  "payment.estimatePrice",
  "payment.getSupportedProviders",
  // Coupon methods (read-only)
  "coupon.validate",
  "coupon.get",
  "coupon.list",
  "coupon.getUserUsages",
  // Renewal methods (read-only)
  "renewal.getTasks",
  "renewal.getTask",
  "renewal.getConfig",
  // Memory methods (read-only)
  "memory.profile.fact.list",
  "memory.profile.fact.search",
  "memory.profile.preferences.get",
  "memory.profile.pattern.list",
  "memory.profile.export",
  "memory.episodic.conversation.history",
  "memory.episodic.conversation.summary",
  "memory.episodic.event.list",
  "memory.episodic.search",
  "memory.episodic.timeline",
  "memory.health",
  // Chat todo methods (read-only)
  "chat.todo.list",
  "chat.todo.get",
  // Chat queue methods (read-only)
  "chat.queue.list",
  // Chat checkpoint methods (read-only)
  "chat.checkpoint.list",
  "chat.checkpoint.load",
]);
const WRITE_METHODS = new Set([
  "send",
  "agent",
  "agent.wait",
  "wake",
  "talk.mode",
  "tts.enable",
  "tts.disable",
  "tts.convert",
  "tts.setProvider",
  "voicewake.set",
  "node.invoke",
  "chat.send",
  "chat.abort",
  "browser.request",
  "assistant.chat",
  "assistant.confirm.request",
  "assistant.confirm.response",
  // Assistant skill system methods
  "assistant.skills.execute",
  "assistant.skills.executeByCommand",
  "assistant.skills.reload",
  // Assistant skill client execution result
  "assistant.skill.result",
  // Assistant skill create and install
  "assistant.skills.createAndPush",
  "assistant.skill.installResult",
  // Assistant audit methods (write)
  "assistant.audit.init",
  "assistant.audit.write",
  "assistant.audit.export",
  "assistant.audit.clear",
  "assistant.audit.config.set",
  // Assistant subscription methods (write)
  "assistant.subscription.create",
  "assistant.subscription.update",
  "assistant.subscription.cancel",
  "assistant.subscription.usage.record",
  // Device methods (write)
  "device.link",
  "device.unlink",
  "device.setPrimary",
  "device.updateAlias",
  // Migration methods (write)
  "migration.start",
  "migration.verify",
  "migration.updateConfig",
  "migration.dualWrite.init",
  "migration.dualWrite.setMode",
  "migration.dualWrite.setReadStrategy",
  "migration.dualWrite.resetStats",
  "migration.rollback.preview",
  "migration.rollback.execute",
  // Payment methods (write)
  "payment.createOrder",
  "payment.cancelOrder",
  "payment.initiatePayment",
  "payment.requestRefund",
  // Coupon methods (write)
  "coupon.apply",
  "coupon.create",
  "coupon.update",
  "coupon.disable",
  // Renewal methods (write)
  "renewal.trigger",
  "renewal.cancel",
  "renewal.updateConfig",
  "renewal.start",
  "renewal.stop",
  // Memory methods (write)
  "memory.profile.fact.add",
  "memory.profile.fact.update",
  "memory.profile.fact.delete",
  "memory.profile.preferences.update",
  "memory.profile.preferences.reset",
  "memory.profile.pattern.add",
  "memory.profile.pattern.update",
  "memory.profile.pattern.delete",
  "memory.profile.pattern.confirm",
  "memory.episodic.conversation.add",
  "memory.episodic.conversation.delete",
  "memory.episodic.event.add",
  "memory.episodic.event.update",
  "memory.episodic.event.delete",
  // Chat queue methods (write)
  "chat.queue.enqueue",
  "chat.queue.dequeue",
  "chat.queue.remove",
  "chat.queue.clear",
  // Chat checkpoint methods (write)
  "chat.checkpoint.save",
  "chat.checkpoint.delete",
  "chat.checkpoint.resume",
]);

/**
 * user 角色允许的方法集合
 *
 * user 角色是面向最终用户（如 Windows/iOS/Android 客户端）的受限角色，
 * 可以执行聊天、查看会话、查看技能、管理设备等操作，
 * 但不能执行管理员专属操作（配置、通道管理、迁移等）。
 */
const USER_ALLOWED_METHODS = new Set([
  // 基础
  "health",
  "status",
  "heartbeat",
  // 聊天
  "chat.send",
  "chat.abort",
  "chat.history",
  "chat.todo.list",
  "chat.todo.get",
  "chat.queue.list",
  "chat.queue.enqueue",
  "chat.checkpoint.list",
  "chat.checkpoint.load",
  "chat.checkpoint.save",
  "chat.checkpoint.resume",
  // 助手
  "assistant.chat",
  "assistant.info",
  "assistant.capabilities",
  "assistant.heartbeat",
  "assistant.confirm.request",
  "assistant.confirm.response",
  "assistant.command.result",
  // 会话
  "sessions.list",
  "sessions.preview",
  // 技能（只读 + 执行）
  "assistant.skills.list",
  "assistant.skills.listAll",
  "assistant.skills.get",
  "assistant.skills.tools",
  "assistant.skills.findByCommand",
  "assistant.skills.stats",
  "assistant.skills.execute",
  "assistant.skills.executeByCommand",
  "assistant.skill.result",
  // 订阅（只读 + 创建/取消）
  "assistant.subscription.plans",
  "assistant.subscription.plan",
  "assistant.subscription.get",
  "assistant.subscription.quota.check",
  "assistant.subscription.usage",
  "assistant.subscription.overview",
  "assistant.subscription.create",
  "assistant.subscription.update",
  "assistant.subscription.cancel",
  // 积分
  "assistant.credits.balance",
  "assistant.credits.history",
  "assistant.credits.calculateCost",
  // 设备
  "device.list",
  "device.quota",
  "device.checkPaired",
  "device.info",
  "device.getUser",
  "device.link",
  "device.unlink",
  "device.updateAlias",
  "device.token.rotate",
  "device.token.revoke",
  "device.revoke",
  // 节点（只读）
  "node.list",
  "node.describe",
  // 模型
  "models.list",
  // 支付
  "payment.getOrder",
  "payment.queryOrders",
  "payment.getPaymentStatus",
  "payment.getUserPayments",
  "payment.estimatePrice",
  "payment.getSupportedProviders",
  "payment.createOrder",
  "payment.cancelOrder",
  "payment.initiatePayment",
  // 消息发送
  "send",
  "agent",
  "agent.wait",
  // 记忆（只读）
  "memory.profile.fact.list",
  "memory.profile.fact.search",
  "memory.profile.preferences.get",
  "memory.profile.pattern.list",
  "memory.profile.export",
  "memory.episodic.conversation.history",
  "memory.episodic.conversation.summary",
  "memory.episodic.event.list",
  "memory.episodic.search",
  "memory.episodic.timeline",
  "memory.health",
]);

/**
 * 认证豁免方法前缀和名称
 *
 * 这些方法不需要用户认证（允许未认证连接调用）
 */
const AUTH_EXEMPT_PREFIXES = ["auth.", "admin."];
const AUTH_EXEMPT_METHODS = new Set(["connect", "heartbeat", "assistant.heartbeat"]);

function isAuthExemptMethod(method: string): boolean {
  if (AUTH_EXEMPT_METHODS.has(method)) {
    return true;
  }
  return AUTH_EXEMPT_PREFIXES.some((p) => method.startsWith(p));
}

function authorizeGatewayMethod(method: string, client: GatewayRequestOptions["client"]) {
  // Auth methods are public (no authentication required)
  if (method.startsWith("auth.")) {
    return null;
  }
  // Admin console authentication methods are public
  if (method.startsWith("admin.")) {
    return null;
  }
  if (!client?.connect) {
    return null;
  }
  const role = client.connect.role ?? "operator";
  const scopes = client.connect.scopes ?? [];
  if (NODE_ROLE_METHODS.has(method)) {
    if (role === "node") {
      return null;
    }
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  if (role === "node") {
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }

  // user 角色：只允许调用 USER_ALLOWED_METHODS 中定义的方法
  if (role === "user") {
    if (USER_ALLOWED_METHODS.has(method)) {
      return null;
    }
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized method for user role: ${method}`);
  }

  // operator 角色：基于 scopes 的细粒度权限检查
  if (role !== "operator") {
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  if (scopes.includes(ADMIN_SCOPE)) {
    return null;
  }
  if (APPROVAL_METHODS.has(method) && !scopes.includes(APPROVALS_SCOPE)) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.approvals");
  }
  if (PAIRING_METHODS.has(method) && !scopes.includes(PAIRING_SCOPE)) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.pairing");
  }
  if (READ_METHODS.has(method) && !(scopes.includes(READ_SCOPE) || scopes.includes(WRITE_SCOPE))) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.read");
  }
  if (WRITE_METHODS.has(method) && !scopes.includes(WRITE_SCOPE)) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.write");
  }
  if (APPROVAL_METHODS.has(method)) {
    return null;
  }
  if (PAIRING_METHODS.has(method)) {
    return null;
  }
  if (READ_METHODS.has(method)) {
    return null;
  }
  if (WRITE_METHODS.has(method)) {
    return null;
  }
  if (ADMIN_METHOD_PREFIXES.some((prefix) => method.startsWith(prefix))) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.admin");
  }
  if (
    method.startsWith("config.") ||
    method.startsWith("wizard.") ||
    method.startsWith("update.") ||
    method === "channels.logout" ||
    method === "skills.install" ||
    method === "skills.update" ||
    method === "cron.add" ||
    method === "cron.update" ||
    method === "cron.remove" ||
    method === "cron.run" ||
    method === "sessions.patch" ||
    method === "sessions.reset" ||
    method === "sessions.delete" ||
    method === "sessions.compact"
  ) {
    return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.admin");
  }
  return errorShape(ErrorCodes.INVALID_REQUEST, "missing scope: operator.admin");
}

export const coreGatewayHandlers: GatewayRequestHandlers = {
  ...connectHandlers,
  ...logsHandlers,
  ...voicewakeHandlers,
  ...healthHandlers,
  ...channelsHandlers,
  ...chatHandlers,
  ...chatTodoHandlers,
  ...chatQueueHandlers,
  ...chatCheckpointHandlers,
  ...cronHandlers,
  ...deviceHandlers,
  ...execApprovalsHandlers,
  ...webHandlers,
  ...modelsHandlers,
  ...configHandlers,
  ...wizardHandlers,
  ...talkHandlers,
  ...ttsHandlers,
  ...skillsHandlers,
  ...sessionsHandlers,
  ...systemHandlers,
  ...updateHandlers,
  ...nodeHandlers,
  ...sendHandlers,
  ...usageHandlers,
  ...agentHandlers,
  ...agentsHandlers,
  ...browserHandlers,
  ...assistantHandlers,
  ...assistantAuditMethods,
  ...assistantSkillHandlers,
  ...assistantSubscriptionMethods,
  ...assistantCreditsMethods,
  ...authMethods,
  ...deviceMethods,
  ...paymentMethods,
  ...migrationRpcMethods,
  ...adminAuthMethods,
  ...adminUserMethods,
  ...adminSubscriptionMethods,
  ...adminAuditMethods,
  ...adminDashboardMethods,
  ...adminSkillHandlers,
  ...userSkillHandlers,
  ...adminMonitorHandlers,
  ...adminConfigHandlers,
  ...adminAnalyticsHandlers,
  ...adminLlmLogHandlers,
  ...adminCreditHandlers,
  ...adminAdminMethods,
  ...memoryHandlers,
};

export async function handleGatewayRequest(
  opts: GatewayRequestOptions & { extraHandlers?: GatewayRequestHandlers },
): Promise<void> {
  const { req, respond, client, isWebchatConnect, context } = opts;

  // 1. 角色/权限检查
  const authError = authorizeGatewayMethod(req.method, client);
  if (authError) {
    respond(false, undefined, authError);
    return;
  }

  // 1.5 用户认证检查 (Phase 0: 非豁免方法要求已认证用户)
  const authenticatedUser = (client as { authenticatedUser?: { userId: string } })
    ?.authenticatedUser;
  const userId = authenticatedUser?.userId;

  if (!isAuthExemptMethod(req.method) && !userId) {
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INVALID_REQUEST, "user authentication required"),
    );
    return;
  }

  // 2. 配额检查 (多租户模式)
  if (userId) {
    const quotaContext = createEmptyRequestContext(req.id);
    const quotaResult = await checkUserQuota(userId, req.method, quotaContext);

    if (quotaResult && !quotaResult.allowed) {
      respond(false, undefined, createQuotaExceededError(quotaResult));
      return;
    }
  }

  // 3. 查找并执行处理器
  const handler = opts.extraHandlers?.[req.method] ?? coreGatewayHandlers[req.method];
  if (!handler) {
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INVALID_REQUEST, `unknown method: ${req.method}`),
    );
    return;
  }

  // 4. 执行处理器
  await handler({
    req,
    params: (req.params ?? {}) as Record<string, unknown>,
    client,
    isWebchatConnect,
    respond,
    context,
  });

  // 5. 记录配额使用 (成功执行后)
  // 注意：这里简化处理，实际应该在 handler 成功返回后记录
  // 更精确的实现需要包装 respond 函数来检测成功响应
  if (userId) {
    const quotaContext = createEmptyRequestContext(req.id);
    void recordQuotaUsage(userId, req.method, quotaContext).catch(() => {
      // 配额记录失败不影响请求处理
    });
  }
}
