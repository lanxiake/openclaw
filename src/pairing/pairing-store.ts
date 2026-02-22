/**
 * 频道配对存储层
 *
 * Adapter 模式：检测数据库是否可用
 * - DB 可用 → 委托给 ChannelPairingRequestRepository / ChannelBindingRepository
 * - DB 不可用 → 降级到原有文件存储 ({channel}-pairing.json / {channel}-allowFrom.json)
 *
 * 对外 6 个导出函数的签名完全不变，24 个调用者零改动。
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import lockfile from "proper-lockfile";
import { getPairingAdapter } from "../channels/plugins/pairing.js";
import type { ChannelId, ChannelPairingAdapter } from "../channels/plugins/types.js";
import { resolveOAuthDir, resolveStateDir } from "../config/paths.js";
import { getLogger } from "../logging/logger.js";

const logger = getLogger();

const PAIRING_CODE_LENGTH = 8;
const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAIRING_PENDING_TTL_MS = 60 * 60 * 1000;
const PAIRING_PENDING_MAX = 3;
const PAIRING_STORE_LOCK_OPTIONS = {
  retries: {
    retries: 10,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 10_000,
    randomize: true,
  },
  stale: 30_000,
} as const;

export type PairingChannel = ChannelId;

export type PairingRequest = {
  id: string;
  code: string;
  createdAt: string;
  lastSeenAt: string;
  meta?: Record<string, string>;
};

type PairingStore = {
  version: 1;
  requests: PairingRequest[];
};

type AllowFromStore = {
  version: 1;
  allowFrom: string[];
};

// ==================== DB 可用性检测 ====================

/**
 * 检测数据库是否可用
 *
 * 通过尝试获取 getDatabase() 判断。
 * 在 CLI 模式（无 DB）或测试环境（mock DB）下均能正确判断。
 */
function isDatabaseAvailable(): boolean {
  try {
    // 动态导入避免循环依赖，且不影响无 DB 的 CLI 场景
    const { getDatabase } = require("../db/connection.js") as {
      getDatabase: () => unknown;
    };
    return !!getDatabase();
  } catch {
    return false;
  }
}

/**
 * 获取配对请求仓库实例（仅在 DB 可用时调用）
 */
function getPairingRepo() {
  const { getChannelPairingRequestRepository } =
    require("../db/repositories/channel-pairing.js") as {
      getChannelPairingRequestRepository: () => import("../db/repositories/channel-pairing.js").ChannelPairingRequestRepository;
    };
  return getChannelPairingRequestRepository();
}

/**
 * 获取频道绑定仓库实例（仅在 DB 可用时调用）
 */
function getBindingRepo() {
  const { getChannelBindingRepository } = require("../db/repositories/channel-pairing.js") as {
    getChannelBindingRepository: () => import("../db/repositories/channel-pairing.js").ChannelBindingRepository;
  };
  return getChannelBindingRepository();
}

// ==================== 文件存储工具函数 ====================

function resolveCredentialsDir(env: NodeJS.ProcessEnv = process.env): string {
  const stateDir = resolveStateDir(env, os.homedir);
  return resolveOAuthDir(env, stateDir);
}

/** Sanitize channel ID for use in filenames (prevent path traversal). */
function safeChannelKey(channel: PairingChannel): string {
  const raw = String(channel).trim().toLowerCase();
  if (!raw) {
    throw new Error("invalid pairing channel");
  }
  const safe = raw.replace(/[\\/:*?"<>|]/g, "_").replace(/\.\./g, "_");
  if (!safe || safe === "_") {
    throw new Error("invalid pairing channel");
  }
  return safe;
}

function resolvePairingPath(channel: PairingChannel, env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveCredentialsDir(env), `${safeChannelKey(channel)}-pairing.json`);
}

function resolveAllowFromPath(
  channel: PairingChannel,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(resolveCredentialsDir(env), `${safeChannelKey(channel)}-allowFrom.json`);
}

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readJsonFile<T>(
  filePath: string,
  fallback: T,
): Promise<{ value: T; exists: boolean }> {
  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    const parsed = safeParseJson<T>(raw);
    if (parsed == null) {
      return { value: fallback, exists: true };
    }
    return { value: parsed, exists: true };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return { value: fallback, exists: false };
    }
    return { value: fallback, exists: false };
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
  const tmp = path.join(dir, `${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  await fs.promises.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf-8",
  });
  await fs.promises.chmod(tmp, 0o600);
  await fs.promises.rename(tmp, filePath);
}

async function ensureJsonFile(filePath: string, fallback: unknown) {
  try {
    await fs.promises.access(filePath);
  } catch {
    await writeJsonFile(filePath, fallback);
  }
}

async function withFileLock<T>(
  filePath: string,
  fallback: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  await ensureJsonFile(filePath, fallback);
  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(filePath, PAIRING_STORE_LOCK_OPTIONS);
    return await fn();
  } finally {
    if (release) {
      try {
        await release();
      } catch {
        // ignore unlock errors
      }
    }
  }
}

function parseTimestamp(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function isExpired(entry: PairingRequest, nowMs: number): boolean {
  const createdAt = parseTimestamp(entry.createdAt);
  if (!createdAt) {
    return true;
  }
  return nowMs - createdAt > PAIRING_PENDING_TTL_MS;
}

function pruneExpiredRequests(reqs: PairingRequest[], nowMs: number) {
  const kept: PairingRequest[] = [];
  let removed = false;
  for (const req of reqs) {
    if (isExpired(req, nowMs)) {
      removed = true;
      continue;
    }
    kept.push(req);
  }
  return { requests: kept, removed };
}

function resolveLastSeenAt(entry: PairingRequest): number {
  return parseTimestamp(entry.lastSeenAt) ?? parseTimestamp(entry.createdAt) ?? 0;
}

function pruneExcessRequests(reqs: PairingRequest[], maxPending: number) {
  if (maxPending <= 0 || reqs.length <= maxPending) {
    return { requests: reqs, removed: false };
  }
  const sorted = reqs.slice().toSorted((a, b) => resolveLastSeenAt(a) - resolveLastSeenAt(b));
  return { requests: sorted.slice(-maxPending), removed: true };
}

function randomCode(): string {
  // Human-friendly: 8 chars, upper, no ambiguous chars (0O1I).
  let out = "";
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    const idx = crypto.randomInt(0, PAIRING_CODE_ALPHABET.length);
    out += PAIRING_CODE_ALPHABET[idx];
  }
  return out;
}

function generateUniqueCode(existing: Set<string>): string {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const code = randomCode();
    if (!existing.has(code)) {
      return code;
    }
  }
  throw new Error("failed to generate unique pairing code");
}

function normalizeId(value: string | number): string {
  return String(value).trim();
}

function normalizeAllowEntry(channel: PairingChannel, entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed === "*") {
    return "";
  }
  const adapter = getPairingAdapter(channel);
  const normalized = adapter?.normalizeAllowEntry ? adapter.normalizeAllowEntry(trimmed) : trimmed;
  return String(normalized).trim();
}

// ==================== 导出函数（DB 优先 + 文件降级）====================

/**
 * 读取频道允许发送者列表
 *
 * DB 模式：从 user_channel_bindings 表查询
 * 文件模式：从 {channel}-allowFrom.json 读取
 */
export async function readChannelAllowFromStore(
  channel: PairingChannel,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string[]> {
  // DB 路径
  if (isDatabaseAvailable()) {
    logger.debug("[pairing-store] readChannelAllowFromStore via DB", { channel });
    try {
      const raw = await getBindingRepo().listAllowedSenders(channel);
      // 对 DB 返回值也应用渠道适配器归一化（与文件路径保持一致）
      return raw.map((v) => normalizeAllowEntry(channel, v)).filter(Boolean);
    } catch (err) {
      logger.warn("[pairing-store] DB 读取失败，降级到文件", { channel, error: String(err) });
    }
  }

  // 文件路径（降级）
  const filePath = resolveAllowFromPath(channel, env);
  const { value } = await readJsonFile<AllowFromStore>(filePath, {
    version: 1,
    allowFrom: [],
  });
  const list = Array.isArray(value.allowFrom) ? value.allowFrom : [];
  return list.map((v) => normalizeAllowEntry(channel, String(v))).filter(Boolean);
}

/**
 * 添加频道允许发送者条目
 *
 * DB 模式：插入 user_channel_bindings 记录
 * 文件模式：写入 {channel}-allowFrom.json
 */
export async function addChannelAllowFromStoreEntry(params: {
  channel: PairingChannel;
  entry: string | number;
  env?: NodeJS.ProcessEnv;
}): Promise<{ changed: boolean; allowFrom: string[] }> {
  // DB 路径
  if (isDatabaseAvailable()) {
    logger.debug("[pairing-store] addChannelAllowFromStoreEntry via DB", {
      channel: params.channel,
      entry: String(params.entry),
    });
    try {
      const normalized = normalizeAllowEntry(params.channel, normalizeId(params.entry));
      if (!normalized) {
        const current = await getBindingRepo().listAllowedSenders(params.channel);
        return { changed: false, allowFrom: current };
      }
      return await getBindingRepo().addBinding(params.channel, normalized);
    } catch (err) {
      logger.warn("[pairing-store] DB 写入失败，降级到文件", {
        channel: params.channel,
        error: String(err),
      });
    }
  }

  // 文件路径（降级）
  const env = params.env ?? process.env;
  const filePath = resolveAllowFromPath(params.channel, env);
  return await withFileLock(
    filePath,
    { version: 1, allowFrom: [] } satisfies AllowFromStore,
    async () => {
      const { value } = await readJsonFile<AllowFromStore>(filePath, {
        version: 1,
        allowFrom: [],
      });
      const current = (Array.isArray(value.allowFrom) ? value.allowFrom : [])
        .map((v) => normalizeAllowEntry(params.channel, String(v)))
        .filter(Boolean);
      const normalized = normalizeAllowEntry(params.channel, normalizeId(params.entry));
      if (!normalized) {
        return { changed: false, allowFrom: current };
      }
      if (current.includes(normalized)) {
        return { changed: false, allowFrom: current };
      }
      const next = [...current, normalized];
      await writeJsonFile(filePath, {
        version: 1,
        allowFrom: next,
      } satisfies AllowFromStore);
      return { changed: true, allowFrom: next };
    },
  );
}

/**
 * 移除频道允许发送者条目
 *
 * DB 模式：删除 user_channel_bindings 记录
 * 文件模式：修改 {channel}-allowFrom.json
 */
export async function removeChannelAllowFromStoreEntry(params: {
  channel: PairingChannel;
  entry: string | number;
  env?: NodeJS.ProcessEnv;
}): Promise<{ changed: boolean; allowFrom: string[] }> {
  // DB 路径
  if (isDatabaseAvailable()) {
    logger.debug("[pairing-store] removeChannelAllowFromStoreEntry via DB", {
      channel: params.channel,
      entry: String(params.entry),
    });
    try {
      const normalized = normalizeAllowEntry(params.channel, normalizeId(params.entry));
      if (!normalized) {
        const current = await getBindingRepo().listAllowedSenders(params.channel);
        return { changed: false, allowFrom: current };
      }
      return await getBindingRepo().removeBinding(params.channel, normalized);
    } catch (err) {
      logger.warn("[pairing-store] DB 删除失败，降级到文件", {
        channel: params.channel,
        error: String(err),
      });
    }
  }

  // 文件路径（降级）
  const env = params.env ?? process.env;
  const filePath = resolveAllowFromPath(params.channel, env);
  return await withFileLock(
    filePath,
    { version: 1, allowFrom: [] } satisfies AllowFromStore,
    async () => {
      const { value } = await readJsonFile<AllowFromStore>(filePath, {
        version: 1,
        allowFrom: [],
      });
      const current = (Array.isArray(value.allowFrom) ? value.allowFrom : [])
        .map((v) => normalizeAllowEntry(params.channel, String(v)))
        .filter(Boolean);
      const normalized = normalizeAllowEntry(params.channel, normalizeId(params.entry));
      if (!normalized) {
        return { changed: false, allowFrom: current };
      }
      const next = current.filter((entry) => entry !== normalized);
      if (next.length === current.length) {
        return { changed: false, allowFrom: current };
      }
      await writeJsonFile(filePath, {
        version: 1,
        allowFrom: next,
      } satisfies AllowFromStore);
      return { changed: true, allowFrom: next };
    },
  );
}

/**
 * 列出频道待处理配对请求
 *
 * DB 模式：从 channel_pairing_requests 表查询 pending 请求
 * 文件模式：从 {channel}-pairing.json 读取
 *
 * 注意：DB 返回值需转换为 PairingRequest 格式（createdAt/lastSeenAt 为 ISO 字符串）
 */
export async function listChannelPairingRequests(
  channel: PairingChannel,
  env: NodeJS.ProcessEnv = process.env,
): Promise<PairingRequest[]> {
  // DB 路径
  if (isDatabaseAvailable()) {
    logger.debug("[pairing-store] listChannelPairingRequests via DB", { channel });
    try {
      const dbRequests = await getPairingRepo().findPending(channel);
      // 转换 DB 记录为 PairingRequest 格式
      return dbRequests.map((r) => ({
        id: r.senderId,
        code: r.code,
        createdAt: r.createdAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
        ...(r.senderMeta ? { meta: r.senderMeta } : {}),
      }));
    } catch (err) {
      logger.warn("[pairing-store] DB 读取失败，降级到文件", { channel, error: String(err) });
    }
  }

  // 文件路径（降级）
  const filePath = resolvePairingPath(channel, env);
  return await withFileLock(
    filePath,
    { version: 1, requests: [] } satisfies PairingStore,
    async () => {
      const { value } = await readJsonFile<PairingStore>(filePath, {
        version: 1,
        requests: [],
      });
      const reqs = Array.isArray(value.requests) ? value.requests : [];
      const nowMs = Date.now();
      const { requests: prunedExpired, removed: expiredRemoved } = pruneExpiredRequests(
        reqs,
        nowMs,
      );
      const { requests: pruned, removed: cappedRemoved } = pruneExcessRequests(
        prunedExpired,
        PAIRING_PENDING_MAX,
      );
      if (expiredRemoved || cappedRemoved) {
        await writeJsonFile(filePath, {
          version: 1,
          requests: pruned,
        } satisfies PairingStore);
      }
      return pruned
        .filter(
          (r) =>
            r &&
            typeof r.id === "string" &&
            typeof r.code === "string" &&
            typeof r.createdAt === "string",
        )
        .slice()
        .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
  );
}

/**
 * 创建或更新频道配对请求
 *
 * DB 模式：委托给 ChannelPairingRequestRepository.upsertRequest
 * 文件模式：操作 {channel}-pairing.json
 */
export async function upsertChannelPairingRequest(params: {
  channel: PairingChannel;
  id: string | number;
  meta?: Record<string, string | undefined | null>;
  env?: NodeJS.ProcessEnv;
  /** Extension channels can pass their adapter directly to bypass registry lookup. */
  pairingAdapter?: ChannelPairingAdapter;
}): Promise<{ code: string; created: boolean }> {
  // 预处理 meta（清理 null/undefined 值）
  const cleanMeta =
    params.meta && typeof params.meta === "object"
      ? Object.fromEntries(
          Object.entries(params.meta)
            .map(([k, v]) => [k, String(v ?? "").trim()] as const)
            .filter(([_, v]) => Boolean(v)),
        )
      : undefined;

  // DB 路径
  if (isDatabaseAvailable()) {
    const senderId = normalizeId(params.id);
    logger.debug("[pairing-store] upsertChannelPairingRequest via DB", {
      channel: params.channel,
      senderId,
    });
    try {
      return await getPairingRepo().upsertRequest(params.channel, senderId, cleanMeta);
    } catch (err) {
      logger.warn("[pairing-store] DB 写入失败，降级到文件", {
        channel: params.channel,
        error: String(err),
      });
    }
  }

  // 文件路径（降级）
  const env = params.env ?? process.env;
  const filePath = resolvePairingPath(params.channel, env);
  return await withFileLock(
    filePath,
    { version: 1, requests: [] } satisfies PairingStore,
    async () => {
      const { value } = await readJsonFile<PairingStore>(filePath, {
        version: 1,
        requests: [],
      });
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const id = normalizeId(params.id);

      let reqs = Array.isArray(value.requests) ? value.requests : [];
      const { requests: prunedExpired, removed: expiredRemoved } = pruneExpiredRequests(
        reqs,
        nowMs,
      );
      reqs = prunedExpired;
      const existingIdx = reqs.findIndex((r) => r.id === id);
      const existingCodes = new Set(
        reqs.map((req) =>
          String(req.code ?? "")
            .trim()
            .toUpperCase(),
        ),
      );

      if (existingIdx >= 0) {
        const existing = reqs[existingIdx];
        const existingCode =
          existing && typeof existing.code === "string" ? existing.code.trim() : "";
        const code = existingCode || generateUniqueCode(existingCodes);
        const next: PairingRequest = {
          id,
          code,
          createdAt: existing?.createdAt ?? now,
          lastSeenAt: now,
          meta: cleanMeta ?? existing?.meta,
        };
        reqs[existingIdx] = next;
        const { requests: capped } = pruneExcessRequests(reqs, PAIRING_PENDING_MAX);
        await writeJsonFile(filePath, {
          version: 1,
          requests: capped,
        } satisfies PairingStore);
        return { code, created: false };
      }

      const { requests: capped, removed: cappedRemoved } = pruneExcessRequests(
        reqs,
        PAIRING_PENDING_MAX,
      );
      reqs = capped;
      if (PAIRING_PENDING_MAX > 0 && reqs.length >= PAIRING_PENDING_MAX) {
        if (expiredRemoved || cappedRemoved) {
          await writeJsonFile(filePath, {
            version: 1,
            requests: reqs,
          } satisfies PairingStore);
        }
        return { code: "", created: false };
      }
      const code = generateUniqueCode(existingCodes);
      const next: PairingRequest = {
        id,
        code,
        createdAt: now,
        lastSeenAt: now,
        ...(cleanMeta ? { meta: cleanMeta } : {}),
      };
      await writeJsonFile(filePath, {
        version: 1,
        requests: [...reqs, next],
      } satisfies PairingStore);
      return { code, created: true };
    },
  );
}

/**
 * 审批配对码
 *
 * DB 模式：委托给 ChannelPairingRequestRepository.approve + ChannelBindingRepository.addBinding
 * 文件模式：操作 {channel}-pairing.json + {channel}-allowFrom.json
 */
export async function approveChannelPairingCode(params: {
  channel: PairingChannel;
  code: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ id: string; entry?: PairingRequest } | null> {
  const code = params.code.trim().toUpperCase();
  if (!code) {
    return null;
  }

  // DB 路径
  if (isDatabaseAvailable()) {
    logger.debug("[pairing-store] approveChannelPairingCode via DB", {
      channel: params.channel,
      code,
    });
    try {
      const result = await getPairingRepo().approve(code);
      if (!result) {
        return null;
      }
      // 审批成功后，将 sender 加入绑定列表
      await getBindingRepo().addBinding(result.channel, result.senderId);
      // 构造兼容的返回值（使用 DB 中的真实时间戳）
      return {
        id: result.senderId,
        entry: {
          id: result.senderId,
          code,
          createdAt: result.createdAt.toISOString(),
          lastSeenAt: result.lastSeenAt.toISOString(),
          ...(result.senderMeta ? { meta: result.senderMeta } : {}),
        },
      };
    } catch (err) {
      logger.warn("[pairing-store] DB 审批失败，降级到文件", {
        channel: params.channel,
        error: String(err),
      });
    }
  }

  // 文件路径（降级）
  const env = params.env ?? process.env;
  const filePath = resolvePairingPath(params.channel, env);
  return await withFileLock(
    filePath,
    { version: 1, requests: [] } satisfies PairingStore,
    async () => {
      const { value } = await readJsonFile<PairingStore>(filePath, {
        version: 1,
        requests: [],
      });
      const reqs = Array.isArray(value.requests) ? value.requests : [];
      const nowMs = Date.now();
      const { requests: pruned, removed } = pruneExpiredRequests(reqs, nowMs);
      const idx = pruned.findIndex((r) => String(r.code ?? "").toUpperCase() === code);
      if (idx < 0) {
        if (removed) {
          await writeJsonFile(filePath, {
            version: 1,
            requests: pruned,
          } satisfies PairingStore);
        }
        return null;
      }
      const entry = pruned[idx];
      if (!entry) {
        return null;
      }
      pruned.splice(idx, 1);
      await writeJsonFile(filePath, {
        version: 1,
        requests: pruned,
      } satisfies PairingStore);
      await addChannelAllowFromStoreEntry({
        channel: params.channel,
        entry: entry.id,
        env,
      });
      return { id: entry.id, entry };
    },
  );
}
