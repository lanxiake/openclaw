import { ErrorCodes, errorShape } from "./protocol/index.js";
import { agentHandlers } from "./server-methods/agent.js";
import { agentsHandlers } from "./server-methods/agents.js";
import { assistantHandlers } from "./server-methods/assistant.js";
import { assistantAuditMethods } from "./server-methods/assistant-audit.js";
import { authMethods } from "./server-methods/assistant-auth.js";
import { deviceMethods } from "./server-methods/assistant-device.js";
import { assistantSkillHandlers } from "./server-methods/assistant-skills.js";
import { assistantSubscriptionMethods } from "./server-methods/assistant-subscription.js";
import { migrationRpcMethods } from "./server-methods/assistant-migration.js";
import { paymentMethods } from "./server-methods/assistant-payment.js";
import { adminAuthMethods } from "./server-methods/admin-auth.js";
import { adminUserMethods } from "./server-methods/admin-users.js";
import { adminSubscriptionMethods } from "./server-methods/admin-subscriptions.js";
import { adminAuditMethods } from "./server-methods/admin-audit.js";
import { adminDashboardMethods } from "./server-methods/admin-dashboard.js";
import { adminSkillHandlers } from "./server-methods/admin-skills.js";
import { adminMonitorHandlers } from "./server-methods/admin-monitor.js";
import { adminConfigHandlers } from "./server-methods/admin-config.js";
import { adminAnalyticsHandlers } from "./server-methods/admin-analytics.js";
import { browserHandlers } from "./server-methods/browser.js";
import { channelsHandlers } from "./server-methods/channels.js";
import { chatHandlers } from "./server-methods/chat.js";
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

const ADMIN_SCOPE = "operator.admin";
const READ_SCOPE = "operator.read";
const WRITE_SCOPE = "operator.write";
const APPROVALS_SCOPE = "operator.approvals";
const PAIRING_SCOPE = "operator.pairing";

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
  // Assistant skill system methods
  "assistant.skills.list",
  "assistant.skills.get",
  "assistant.skills.tools",
  "assistant.skills.findByCommand",
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
]);

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
  ...adminMonitorHandlers,
  ...adminConfigHandlers,
  ...adminAnalyticsHandlers,
};

export async function handleGatewayRequest(
  opts: GatewayRequestOptions & { extraHandlers?: GatewayRequestHandlers },
): Promise<void> {
  const { req, respond, client, isWebchatConnect, context } = opts;
  const authError = authorizeGatewayMethod(req.method, client);
  if (authError) {
    respond(false, undefined, authError);
    return;
  }
  const handler = opts.extraHandlers?.[req.method] ?? coreGatewayHandlers[req.method];
  if (!handler) {
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INVALID_REQUEST, `unknown method: ${req.method}`),
    );
    return;
  }
  await handler({
    req,
    params: (req.params ?? {}) as Record<string, unknown>,
    client,
    isWebchatConnect,
    respond,
    context,
  });
}
