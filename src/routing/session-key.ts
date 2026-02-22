import { parseAgentSessionKey, type ParsedAgentSessionKey } from "../sessions/session-key-utils.js";

export {
  isAcpSessionKey,
  isSubagentSessionKey,
  parseAgentSessionKey,
  type ParsedAgentSessionKey,
} from "../sessions/session-key-utils.js";

export const DEFAULT_AGENT_ID = "main";
export const DEFAULT_MAIN_KEY = "main";
export const DEFAULT_ACCOUNT_ID = "default";

// Pre-compiled regex
const VALID_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_CHARS_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;

function normalizeToken(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeMainKey(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.toLowerCase() : DEFAULT_MAIN_KEY;
}

export function toAgentRequestSessionKey(storeKey: string | undefined | null): string | undefined {
  const raw = (storeKey ?? "").trim();
  if (!raw) {
    return undefined;
  }
  return parseAgentSessionKey(raw)?.rest ?? raw;
}

export function toAgentStoreSessionKey(params: {
  agentId: string;
  requestKey: string | undefined | null;
  mainKey?: string | undefined;
}): string {
  const raw = (params.requestKey ?? "").trim();
  if (!raw || raw === DEFAULT_MAIN_KEY) {
    return buildAgentMainSessionKey({ agentId: params.agentId, mainKey: params.mainKey });
  }
  const lowered = raw.toLowerCase();
  if (lowered.startsWith("agent:")) {
    return lowered;
  }
  if (lowered.startsWith("subagent:")) {
    return `agent:${normalizeAgentId(params.agentId)}:${lowered}`;
  }
  return `agent:${normalizeAgentId(params.agentId)}:${lowered}`;
}

export function resolveAgentIdFromSessionKey(sessionKey: string | undefined | null): string {
  const parsed = parseAgentSessionKey(sessionKey);
  return normalizeAgentId(parsed?.agentId ?? DEFAULT_AGENT_ID);
}

export function normalizeAgentId(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return DEFAULT_AGENT_ID;
  }
  // Keep it path-safe + shell-friendly.
  if (VALID_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  // Best-effort fallback: collapse invalid characters to "-"
  return (
    trimmed
      .toLowerCase()
      .replace(INVALID_CHARS_RE, "-")
      .replace(LEADING_DASH_RE, "")
      .replace(TRAILING_DASH_RE, "")
      .slice(0, 64) || DEFAULT_AGENT_ID
  );
}

export function sanitizeAgentId(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return DEFAULT_AGENT_ID;
  }
  if (VALID_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return (
    trimmed
      .toLowerCase()
      .replace(INVALID_CHARS_RE, "-")
      .replace(LEADING_DASH_RE, "")
      .replace(TRAILING_DASH_RE, "")
      .slice(0, 64) || DEFAULT_AGENT_ID
  );
}

export function normalizeAccountId(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return DEFAULT_ACCOUNT_ID;
  }
  if (VALID_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return (
    trimmed
      .toLowerCase()
      .replace(INVALID_CHARS_RE, "-")
      .replace(LEADING_DASH_RE, "")
      .replace(TRAILING_DASH_RE, "")
      .slice(0, 64) || DEFAULT_ACCOUNT_ID
  );
}

/**
 * 规范化用户 ID
 *
 * 多用户模式下，空值抛出错误，强制调用方提供有效的 userId
 */
export function normalizeUserId(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error("userId is required in multi-user mode");
  }
  if (VALID_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const normalized = trimmed
    .toLowerCase()
    .replace(INVALID_CHARS_RE, "-")
    .replace(LEADING_DASH_RE, "")
    .replace(TRAILING_DASH_RE, "")
    .slice(0, 64);
  if (!normalized) {
    throw new Error(`userId "${value}" could not be normalized to a valid ID`);
  }
  return normalized;
}

/**
 * 构建带用户维度的 Agent Session Key
 *
 * 格式: user:{userId}:agent:{agentId}:{mainKey}
 * userId 为空时抛出错误，Phase 0 后所有连接必须有真实 userId
 */
export function buildUserAgentSessionKey(params: {
  userId: string;
  agentId: string;
  mainKey?: string | undefined;
}): string {
  const userId = normalizeUserId(params.userId);
  const agentId = normalizeAgentId(params.agentId);
  const mainKey = normalizeMainKey(params.mainKey);

  return `user:${userId}:agent:${agentId}:${mainKey}`;
}

/**
 * 从 Session Key 解析用户 ID
 *
 * 支持新格式 user:{userId}:agent:... 和旧格式 agent:...
 * 旧格式返回 undefined（Phase 0 后旧格式不应再出现）
 */
export function extractUserIdFromSessionKey(
  sessionKey: string | undefined | null,
): string | undefined {
  const key = (sessionKey ?? "").trim().toLowerCase();
  if (!key) {
    return undefined;
  }

  // 新格式: user:{userId}:agent:...
  if (key.startsWith("user:")) {
    const parts = key.split(":");
    if (parts.length >= 2 && parts[1]) {
      return parts[1];
    }
  }

  // 旧格式: agent:... 无法提取 userId
  return undefined;
}

export function buildAgentMainSessionKey(params: {
  agentId: string;
  mainKey?: string | undefined;
}): string {
  const agentId = normalizeAgentId(params.agentId);
  const mainKey = normalizeMainKey(params.mainKey);
  return `agent:${agentId}:${mainKey}`;
}

export function buildAgentPeerSessionKey(params: {
  agentId: string;
  mainKey?: string | undefined;
  channel: string;
  accountId?: string | null;
  peerKind?: "dm" | "group" | "channel" | null;
  peerId?: string | null;
  identityLinks?: Record<string, string[]>;
  /** DM session scope. */
  dmScope?: "main" | "per-peer" | "per-channel-peer" | "per-account-channel-peer";
}): string {
  const peerKind = params.peerKind ?? "dm";
  if (peerKind === "dm") {
    const dmScope = params.dmScope ?? "main";
    let peerId = (params.peerId ?? "").trim();
    const linkedPeerId =
      dmScope === "main"
        ? null
        : resolveLinkedPeerId({
            identityLinks: params.identityLinks,
            channel: params.channel,
            peerId,
          });
    if (linkedPeerId) {
      peerId = linkedPeerId;
    }
    peerId = peerId.toLowerCase();
    if (dmScope === "per-account-channel-peer" && peerId) {
      const channel = (params.channel ?? "").trim().toLowerCase() || "unknown";
      const accountId = normalizeAccountId(params.accountId);
      return `agent:${normalizeAgentId(params.agentId)}:${channel}:${accountId}:dm:${peerId}`;
    }
    if (dmScope === "per-channel-peer" && peerId) {
      const channel = (params.channel ?? "").trim().toLowerCase() || "unknown";
      return `agent:${normalizeAgentId(params.agentId)}:${channel}:dm:${peerId}`;
    }
    if (dmScope === "per-peer" && peerId) {
      return `agent:${normalizeAgentId(params.agentId)}:dm:${peerId}`;
    }
    return buildAgentMainSessionKey({
      agentId: params.agentId,
      mainKey: params.mainKey,
    });
  }
  const channel = (params.channel ?? "").trim().toLowerCase() || "unknown";
  const peerId = ((params.peerId ?? "").trim() || "unknown").toLowerCase();
  return `agent:${normalizeAgentId(params.agentId)}:${channel}:${peerKind}:${peerId}`;
}

function resolveLinkedPeerId(params: {
  identityLinks?: Record<string, string[]>;
  channel: string;
  peerId: string;
}): string | null {
  const identityLinks = params.identityLinks;
  if (!identityLinks) {
    return null;
  }
  const peerId = params.peerId.trim();
  if (!peerId) {
    return null;
  }
  const candidates = new Set<string>();
  const rawCandidate = normalizeToken(peerId);
  if (rawCandidate) {
    candidates.add(rawCandidate);
  }
  const channel = normalizeToken(params.channel);
  if (channel) {
    const scopedCandidate = normalizeToken(`${channel}:${peerId}`);
    if (scopedCandidate) {
      candidates.add(scopedCandidate);
    }
  }
  if (candidates.size === 0) {
    return null;
  }
  for (const [canonical, ids] of Object.entries(identityLinks)) {
    const canonicalName = canonical.trim();
    if (!canonicalName) {
      continue;
    }
    if (!Array.isArray(ids)) {
      continue;
    }
    for (const id of ids) {
      const normalized = normalizeToken(id);
      if (normalized && candidates.has(normalized)) {
        return canonicalName;
      }
    }
  }
  return null;
}

export function buildGroupHistoryKey(params: {
  channel: string;
  accountId?: string | null;
  peerKind: "group" | "channel";
  peerId: string;
}): string {
  const channel = normalizeToken(params.channel) || "unknown";
  const accountId = normalizeAccountId(params.accountId);
  const peerId = params.peerId.trim().toLowerCase() || "unknown";
  return `${channel}:${accountId}:${params.peerKind}:${peerId}`;
}

export function resolveThreadSessionKeys(params: {
  baseSessionKey: string;
  threadId?: string | null;
  parentSessionKey?: string;
  useSuffix?: boolean;
}): { sessionKey: string; parentSessionKey?: string } {
  const threadId = (params.threadId ?? "").trim();
  if (!threadId) {
    return { sessionKey: params.baseSessionKey, parentSessionKey: undefined };
  }
  const normalizedThreadId = threadId.toLowerCase();
  const useSuffix = params.useSuffix ?? true;
  const sessionKey = useSuffix
    ? `${params.baseSessionKey}:thread:${normalizedThreadId}`
    : params.baseSessionKey;
  return { sessionKey, parentSessionKey: params.parentSessionKey };
}

/**
 * 将客户端发送的会话键改写为包含用户前缀的格式
 *
 * 规则:
 * 1. userId 为空 → 原样返回（向后兼容）
 * 2. 已有 user: 前缀且 userId 匹配 → 原样返回
 * 3. 已有 user: 前缀但 userId 不匹配 → 拒绝
 * 4. 旧格式 agent:xxx:yyy → 改写为 user:{userId}:agent:xxx:yyy
 * 5. global/unknown/空值 → 原样返回（不作用户隔离）
 */
export function rewriteSessionKeyForUser(params: {
  sessionKey: string;
  userId: string | undefined;
}): { ok: true; sessionKey: string } | { ok: false; reason: string } {
  const key = params.sessionKey.trim();
  const { userId } = params;

  // 无 userId → 向后兼容，不改写
  if (!userId) {
    return { ok: true, sessionKey: key };
  }

  // 空键、global、unknown → 不作用户隔离
  if (!key || key === "global" || key === "unknown") {
    return { ok: true, sessionKey: key };
  }

  const normalizedUserId = normalizeUserId(userId);
  const keyLower = key.toLowerCase();

  // 已有 user: 前缀
  if (keyLower.startsWith("user:")) {
    const existingUserId = extractUserIdFromSessionKey(key);
    if (existingUserId === normalizedUserId) {
      return { ok: true, sessionKey: keyLower };
    }
    return {
      ok: false,
      reason: `session key userId mismatch: expected ${normalizedUserId}, got ${existingUserId}`,
    };
  }

  // 旧格式 agent:xxx:yyy → 改写为 user:{userId}:agent:xxx:yyy
  if (keyLower.startsWith("agent:")) {
    return { ok: true, sessionKey: `user:${normalizedUserId}:${keyLower}` };
  }

  // 其他未识别格式 → 包裹为默认 agent 键
  return {
    ok: true,
    sessionKey: `user:${normalizedUserId}:agent:${normalizeAgentId(undefined)}:${keyLower}`,
  };
}

/**
 * 剥离 user: 前缀，返回底层 agent 键
 *
 * user:alice:agent:main:main → agent:main:main
 * agent:main:main → agent:main:main (原样)
 */
export function stripUserPrefix(sessionKey: string): string {
  const key = sessionKey.trim().toLowerCase();
  if (!key.startsWith("user:")) {
    return key;
  }
  const agentIdx = key.indexOf(":agent:");
  if (agentIdx < 0) {
    return key;
  }
  // 跳过 ":agent:" 前面的冒号，返回 "agent:..."
  return key.slice(agentIdx + 1);
}
