/**
 * Feishu channel plugin implementation
 */

import type {
  ChannelAccountSnapshot,
  ChannelDock,
  ChannelPlugin,
  OpenClawConfig,
} from "openclaw/plugin-sdk";
import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  PAIRING_APPROVED_MESSAGE,
  setAccountEnabledInConfigSection,
} from "openclaw/plugin-sdk";

import {
  listFeishuAccountIds,
  resolveDefaultFeishuAccountId,
  resolveFeishuAccount,
  type ResolvedFeishuAccount,
} from "./accounts.js";
import { FeishuConfigSchema } from "./config-schema.js";
import { sendFeishuMessage } from "./send.js";
import { collectFeishuStatusIssues } from "./status-issues.js";
import { probeFeishuAccount } from "./probe.js";

const meta = {
  id: "feishu",
  label: "Feishu",
  selectionLabel: "Feishu/Lark (Bot API)",
  docsPath: "/channels/feishu",
  docsLabel: "feishu",
  blurb: "China-focused enterprise messaging platform with Bot API.",
  aliases: ["lark", "fs"],
  order: 85,
  quickstartAllowFrom: true,
};

/**
 * Normalize Feishu messaging target
 */
function normalizeFeishuMessagingTarget(raw: string): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/^(feishu|lark|fs):/i, "");
}

/**
 * Feishu channel dock configuration
 */
export const feishuDock: ChannelDock = {
  id: "feishu",
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    blockStreaming: true,
  },
  outbound: { textChunkLimit: 4000 },
  config: {
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveFeishuAccount({ cfg, accountId }).config.allowFrom ?? []).map(
        (entry) => String(entry)
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.replace(/^(feishu|lark|fs):/i, ""))
        .map((entry) => entry.toLowerCase()),
  },
  groups: {
    resolveRequireMention: () => false,
  },
  threading: {
    resolveReplyToMode: () => "off",
  },
};

/**
 * Feishu channel plugin
 */
export const feishuPlugin: ChannelPlugin<ResolvedFeishuAccount> = {
  id: "feishu",
  meta,
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: false,
    threads: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.feishu"] },
  configSchema: buildChannelConfigSchema(FeishuConfigSchema),
  config: {
    listAccountIds: (cfg) => listFeishuAccountIds(cfg),
    resolveAccount: (cfg, accountId) =>
      resolveFeishuAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultFeishuAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "feishu",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "feishu",
        accountId,
        clearBaseFields: ["appId", "appSecret", "verificationToken", "name"],
      }),
    isConfigured: (account) =>
      Boolean(account.appId?.trim() && account.appSecret?.trim()),
    describeAccount: (account): ChannelAccountSnapshot => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.appId?.trim() && account.appSecret?.trim()),
      credentialSource: account.credentialSource,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveFeishuAccount({ cfg, accountId }).config.allowFrom ?? []).map(
        (entry) => String(entry)
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.replace(/^(feishu|lark|fs):/i, ""))
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId =
        accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(
        cfg.channels?.feishu?.accounts?.[resolvedAccountId]
      );
      const basePath = useAccountPath
        ? `channels.feishu.accounts.${resolvedAccountId}.`
        : "channels.feishu.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("feishu"),
        normalizeEntry: (raw) => raw.replace(/^(feishu|lark|fs):/i, ""),
      };
    },
  },
  groups: {
    resolveRequireMention: () => false,
  },
  threading: {
    resolveReplyToMode: () => "off",
  },
  messaging: {
    normalizeTarget: normalizeFeishuMessagingTarget,
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) {
          return false;
        }
        // Feishu IDs typically start with "ou_" (open_id) or "oc_" (chat_id)
        return /^(ou_|oc_|on_)[a-zA-Z0-9]+$/.test(trimmed);
      },
      hint: "<open_id or chat_id>",
    },
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, accountId, query, limit }) => {
      const account = resolveFeishuAccount({ cfg, accountId });
      const q = query?.trim().toLowerCase() || "";
      const peers = Array.from(
        new Set(
          (account.config.allowFrom ?? [])
            .map((entry) => String(entry).trim())
            .filter((entry) => Boolean(entry) && entry !== "*")
            .map((entry) => entry.replace(/^(feishu|lark|fs):/i, ""))
        )
      )
        .filter((id) => (q ? id.toLowerCase().includes(q) : true))
        .slice(0, limit && limit > 0 ? limit : undefined)
        .map((id) => ({ kind: "user", id }) as const);
      return peers;
    },
    listGroups: async () => [],
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg,
        channelKey: "feishu",
        accountId,
        name,
      }),
    validateInput: ({ accountId, input }) => {
      if (input.useEnv && accountId !== DEFAULT_ACCOUNT_ID) {
        return "FEISHU_APP_ID and FEISHU_APP_SECRET can only be used for the default account.";
      }
      if (!input.useEnv && !input.appId) {
        return "Feishu requires appId (or --use-env).";
      }
      if (!input.useEnv && !input.appSecret) {
        return "Feishu requires appSecret (or --use-env).";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "feishu",
        accountId,
        name: input.name,
      });
      const next =
        accountId !== DEFAULT_ACCOUNT_ID
          ? migrateBaseNameToDefaultAccount({
              cfg: namedConfig,
              channelKey: "feishu",
            })
          : namedConfig;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...next,
          channels: {
            ...next.channels,
            feishu: {
              ...next.channels?.feishu,
              enabled: true,
              ...(input.useEnv
                ? {}
                : {
                    appId: input.appId,
                    appSecret: input.appSecret,
                    verificationToken: input.verificationToken,
                  }),
            },
          },
        } as OpenClawConfig;
      }

      return {
        ...next,
        channels: {
          ...next.channels,
          feishu: {
            ...next.channels?.feishu,
            enabled: true,
            accounts: {
              ...next.channels?.feishu?.accounts,
              [accountId]: {
                ...next.channels?.feishu?.accounts?.[accountId],
                enabled: true,
                appId: input.appId,
                appSecret: input.appSecret,
                verificationToken: input.verificationToken,
              },
            },
          },
        },
      } as OpenClawConfig;
    },
  },
  pairing: {
    idLabel: "feishuUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(feishu|lark|fs):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const account = resolveFeishuAccount({ cfg });
      if (!account.appId || !account.appSecret) {
        throw new Error("Feishu credentials not configured");
      }
      await sendFeishuMessage(id, PAIRING_APPROVED_MESSAGE, { cfg });
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => {
      if (!text) {
        return [];
      }
      if (limit <= 0 || text.length <= limit) {
        return [text];
      }
      const chunks: string[] = [];
      let remaining = text;
      while (remaining.length > limit) {
        const window = remaining.slice(0, limit);
        const lastNewline = window.lastIndexOf("\n");
        const lastSpace = window.lastIndexOf(" ");
        let breakIdx = lastNewline > 0 ? lastNewline : lastSpace;
        if (breakIdx <= 0) {
          breakIdx = limit;
        }
        const rawChunk = remaining.slice(0, breakIdx);
        const chunk = rawChunk.trimEnd();
        if (chunk.length > 0) {
          chunks.push(chunk);
        }
        const brokeOnSeparator =
          breakIdx < remaining.length && /\s/.test(remaining[breakIdx]);
        const nextStart = Math.min(
          remaining.length,
          breakIdx + (brokeOnSeparator ? 1 : 0)
        );
        remaining = remaining.slice(nextStart).trimStart();
      }
      if (remaining.length) {
        chunks.push(remaining);
      }
      return chunks;
    },
    chunkerMode: "text",
    textChunkLimit: 4000,
    sendText: async ({ to, text, accountId, cfg }) => {
      const result = await sendFeishuMessage(to, text, {
        accountId: accountId ?? undefined,
        cfg,
      });
      return {
        channel: "feishu",
        ok: result.ok,
        messageId: result.messageId ?? "",
        error: result.error ? new Error(result.error) : undefined,
      };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId, cfg }) => {
      // For now, send media URL as text
      // TODO: Implement proper media upload and sending
      const fullText = mediaUrl ? `${text}\n${mediaUrl}` : text;
      const result = await sendFeishuMessage(to, fullText, {
        accountId: accountId ?? undefined,
        cfg,
      });
      return {
        channel: "feishu",
        ok: result.ok,
        messageId: result.messageId ?? "",
        error: result.error ? new Error(result.error) : undefined,
      };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: collectFeishuStatusIssues,
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      credentialSource: snapshot.credentialSource ?? "none",
    }),
  },
  gateway: {
    probe: async ({ account }) => {
      const result = await probeFeishuAccount(account);
      return {
        ok: result.ok,
        error: result.error ? new Error(result.error) : undefined,
      };
    },
  },
};
