/**
 * Feishu webhook monitoring and message handling
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type {
  FeishuWebhookPayload,
  FeishuEventPayload,
  FeishuMessageEvent,
  FeishuTextContent,
} from "./types.js";
import type { ResolvedFeishuAccount } from "./types.js";
import { getFeishuRuntime } from "./runtime.js";

type FeishuCoreRuntime = ReturnType<typeof getFeishuRuntime>;

/**
 * Webhook target registration
 */
type WebhookTarget = {
  account: ResolvedFeishuAccount;
  config: OpenClawConfig;
  verificationToken: string;
  path: string;
  core: FeishuCoreRuntime;
};

const webhookTargets = new Map<string, WebhookTarget[]>();

/**
 * Normalize webhook path
 */
function normalizeWebhookPath(raw?: string): string {
  const trimmed = raw?.trim() || "";
  if (!trimmed) {
    return "/";
  }
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

/**
 * Resolve webhook path from config
 */
function resolveWebhookPath(
  webhookPath?: string,
  webhookUrl?: string
): string | null {
  const trimmedPath = webhookPath?.trim();
  if (trimmedPath) {
    return normalizeWebhookPath(trimmedPath);
  }
  if (webhookUrl?.trim()) {
    try {
      const parsed = new URL(webhookUrl);
      return normalizeWebhookPath(parsed.pathname || "/");
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Register webhook target
 */
export function registerFeishuWebhookTarget(
  target: WebhookTarget
): () => void {
  const key = normalizeWebhookPath(target.path);
  const normalizedTarget = { ...target, path: key };
  const existing = webhookTargets.get(key) ?? [];
  const next = [...existing, normalizedTarget];
  webhookTargets.set(key, next);

  return () => {
    const updated = (webhookTargets.get(key) ?? []).filter(
      (entry) => entry !== normalizedTarget
    );
    if (updated.length > 0) {
      webhookTargets.set(key, updated);
    } else {
      webhookTargets.delete(key);
    }
  };
}

/**
 * Read JSON body from request
 */
async function readJsonBody(
  req: IncomingMessage,
  maxBytes: number
): Promise<{ ok: boolean; value?: unknown; error?: string }> {
  const chunks: Buffer[] = [];
  let total = 0;

  return await new Promise((resolve) => {
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        resolve({ ok: false, error: "payload too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!raw.trim()) {
          resolve({ ok: false, error: "empty payload" });
          return;
        }
        resolve({ ok: true, value: JSON.parse(raw) as unknown });
      } catch (err) {
        resolve({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    req.on("error", (err) => {
      resolve({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });
}

/**
 * Check if sender is allowed based on allowFrom config
 */
function isSenderAllowed(senderId: string, allowFrom?: (string | number)[]): boolean {
  if (!allowFrom || allowFrom.length === 0) {
    return true;
  }

  if (allowFrom.includes("*")) {
    return true;
  }

  const normalizedSenderId = senderId.toLowerCase();
  return allowFrom.some((entry) => {
    const normalized = String(entry)
      .toLowerCase()
      .replace(/^(feishu|lark|fs):/i, "");
    return normalized === normalizedSenderId;
  });
}

/**
 * Process Feishu message event
 */
async function processMessageEvent(
  event: FeishuMessageEvent,
  target: WebhookTarget
): Promise<void> {
  const { message, sender } = event;

  // Parse message content
  let text = "";
  try {
    const content = JSON.parse(message.content) as FeishuTextContent;
    text = content.text || "";
  } catch {
    // If parsing fails, treat content as plain text
    text = message.content;
  }

  // Get sender ID (prefer open_id)
  const senderId =
    sender.sender_id.open_id ||
    sender.sender_id.user_id ||
    sender.sender_id.union_id ||
    "";

  if (!senderId) {
    return;
  }

  // Check sender permission
  if (!isSenderAllowed(senderId, target.config.feishu?.allowFrom)) {
    return;
  }

  // Determine chat type
  const chatType = message.chat_type === "p2p" ? "direct" : "group";

  // Submit inbound message to OpenClaw
  try {
    await target.core.messaging.submitInbound({
      channel: "feishu",
      accountId: target.account.accountId,
      chatId: message.chat_id,
      chatType,
      messageId: message.message_id,
      from: {
        id: senderId,
        name: sender.sender_id.user_id || senderId,
      },
      text,
      timestamp: Number(message.create_time),
      metadata: {
        rootId: message.root_id,
        parentId: message.parent_id,
        messageType: message.message_type,
      },
    });
  } catch (err) {
    throw new Error(
      `Failed to submit inbound message: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Handle Feishu webhook request
 */
export async function handleFeishuWebhookRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalizeWebhookPath(url.pathname);
  const targets = webhookTargets.get(path);

  if (!targets || targets.length === 0) {
    return false;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return true;
  }

  const body = await readJsonBody(req, 1024 * 1024);
  if (!body.ok) {
    res.statusCode = body.error === "payload too large" ? 413 : 400;
    res.end(body.error ?? "invalid payload");
    return true;
  }

  const payload = body.value as FeishuWebhookPayload;

  // Handle URL verification
  if (payload.type === "url_verification") {
    const challenge = payload.challenge;
    const token = payload.token;

    // Verify token
    const target = targets.find((t) => t.verificationToken === token);
    if (!target) {
      res.statusCode = 401;
      res.end("invalid token");
      return true;
    }

    // Return challenge
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ challenge }));
    return true;
  }

  // Handle event payload
  const eventPayload = payload as FeishuEventPayload;
  if (!eventPayload.header || !eventPayload.event) {
    res.statusCode = 400;
    res.end("invalid event payload");
    return true;
  }

  // Verify token
  const target = targets.find(
    (t) => t.verificationToken === eventPayload.header.token
  );
  if (!target) {
    res.statusCode = 401;
    res.end("invalid token");
    return true;
  }

  // Process message event
  if (eventPayload.header.event_type === "im.message.receive_v1") {
    const messageEvent = eventPayload.event as FeishuMessageEvent;
    processMessageEvent(messageEvent, target).catch((err) => {
      console.error(
        `[feishu:${target.account.accountId}] Failed to process message:`,
        err
      );
    });
  }

  // Always return 200 OK to acknowledge receipt
  res.statusCode = 200;
  res.end("ok");
  return true;
}

/**
 * Setup webhook for Feishu account
 */
export function setupFeishuWebhook(params: {
  account: ResolvedFeishuAccount;
  config: OpenClawConfig;
  webhookPath?: string;
  webhookUrl?: string;
}): { ok: boolean; cleanup?: () => void; error?: string } {
  const { account, config, webhookPath, webhookUrl } = params;

  const path = resolveWebhookPath(webhookPath, webhookUrl);
  if (!path) {
    return { ok: false, error: "No webhook path configured" };
  }

  if (!account.verificationToken) {
    return { ok: false, error: "No verification token configured" };
  }

  const core = getFeishuRuntime();

  const target: WebhookTarget = {
    account,
    config,
    verificationToken: account.verificationToken,
    path,
    core,
  };

  const cleanup = registerFeishuWebhookTarget(target);

  return { ok: true, cleanup };
}
