import {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  formatPairingApproveHint,
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
  applyAccountNameToChannelSection,
  type ChannelPlugin,
  type OpenClawConfig,
  type ChannelMeta,
} from "openclaw/plugin-sdk";

import { getWeChatRuntime } from "./runtime.js";
import {
  listWeChatAccountIds,
  resolveDefaultWeChatAccountId,
  resolveWeChatAccount,
  isWeChatAccountConfigured,
  getWeChatConfig,
} from "./config.js";
import { createGateway, removeGateway, getGateway } from "./gateway.js";
import type { ResolvedWeChatAccount, WeChatAccountRuntime, WeChatMessage } from "./types.js";

const meta: ChannelMeta = {
  id: "wechat",
  label: "WeChat",
  selectionLabel: "WeChat (wxauto)",
  docsPath: "/channels/wechat",
  blurb: "Personal WeChat via wxauto-bridge (Windows only)",
  order: 50,
  aliases: ["wx"],
};

/**
 * Normalize WeChat target ID for messaging.
 */
function normalizeWeChatMessagingTarget(target: string): string {
  return target.trim();
}

/**
 * Check if a string looks like a WeChat target ID.
 */
function looksLikeWeChatTargetId(target: string): boolean {
  // WeChat IDs can be wxid_xxx or nicknames
  return Boolean(target?.trim());
}

/**
 * Chunk text for WeChat messages.
 */
function chunkWeChatText(text: string, limit: number): string[] {
  if (text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    // Try to break at newline
    let breakPoint = remaining.lastIndexOf("\n", limit);
    if (breakPoint === -1 || breakPoint < limit / 2) {
      // Try to break at space
      breakPoint = remaining.lastIndexOf(" ", limit);
    }
    if (breakPoint === -1 || breakPoint < limit / 2) {
      // Force break at limit
      breakPoint = limit;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trimStart();
  }

  return chunks;
}

export const wechatPlugin: ChannelPlugin<ResolvedWeChatAccount> = {
  id: "wechat",
  meta: {
    ...meta,
    label: "WeChat",
    description: "WeChat messaging via wxauto-bridge",
    quickstartAllowFrom: true,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: false,
    threads: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.wechat"] },
  pairing: {
    idLabel: "wechatId",
    normalizeAllowEntry: (entry) => entry.replace(/^wechat:/i, ""),
    notifyApproval: async ({ id }) => {
      // Send approval notification via gateway
      const gateway = getGateway(DEFAULT_ACCOUNT_ID);
      if (gateway?.isConnected()) {
        gateway.sendText(id, "Your pairing request has been approved. You can now send messages.");
      }
    },
  },
  config: {
    listAccountIds: (cfg) => listWeChatAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveWeChatAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultWeChatAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "wechat",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "wechat",
        accountId,
        clearBaseFields: ["bridgeUrl", "name"],
      }),
    isConfigured: (account) => isWeChatAccountConfigured(account),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: isWeChatAccountConfigured(account),
      bridgeUrlSource: account.bridgeUrlSource,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveWeChatAccount({ cfg, accountId }).config.allowFrom ?? []).map((entry) =>
        String(entry)
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.replace(/^wechat:/i, "")),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const wechat = getWeChatConfig(cfg);
      const accounts = wechat?.accounts;
      const useAccountPath = Boolean(accounts?.[resolvedAccountId]);
      const basePath = useAccountPath
        ? `channels.wechat.accounts.${resolvedAccountId}.`
        : "channels.wechat.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("wechat"),
        normalizeEntry: (raw) => raw.replace(/^wechat:/i, ""),
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const channels = cfg.channels as Record<string, unknown> | undefined;
      const defaults = channels?.defaults as Record<string, unknown> | undefined;
      const defaultGroupPolicy = defaults?.groupPolicy as string | undefined;
      const groupPolicy = account.config.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
      if (groupPolicy !== "open") return [];
      const groupAllowlistConfigured =
        account.config.groups && Object.keys(account.config.groups).length > 0;
      if (groupAllowlistConfigured) {
        return [
          `- WeChat groups: groupPolicy="open" allows any member in allowed groups to trigger (mention-gated). Set channels.wechat.groupPolicy="allowlist" + channels.wechat.groupAllowFrom to restrict senders.`,
        ];
      }
      return [
        `- WeChat groups: groupPolicy="open" with no channels.wechat.groups allowlist; any group can add + ping (mention-gated). Set channels.wechat.groupPolicy="allowlist" + channels.wechat.groupAllowFrom or configure channels.wechat.groups.`,
      ];
    },
  },
  groups: {
    resolveRequireMention: ({ cfg, groupId, accountId }) => {
      const account = resolveWeChatAccount({ cfg, accountId });
      const groupConfig = account.config.groups?.[groupId];
      // Default to requiring mention in groups
      return groupConfig?.requireMention ?? true;
    },
    resolveToolPolicy: ({ cfg, groupId, accountId }) => {
      const account = resolveWeChatAccount({ cfg, accountId });
      const groupConfig = account.config.groups?.[groupId];
      return groupConfig?.tools ?? null;
    },
  },
  messaging: {
    normalizeTarget: normalizeWeChatMessagingTarget,
    targetResolver: {
      looksLikeId: looksLikeWeChatTargetId,
      hint: "<wxid or nickname>",
    },
  },
  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg,
        channelKey: "wechat",
        accountId,
        name,
      }),
    validateInput: ({ accountId, input }) => {
      if (input.useEnv && accountId !== DEFAULT_ACCOUNT_ID) {
        return "WECHAT_BRIDGE_URL can only be used for the default account.";
      }
      if (!input.useEnv && !input.bridgeUrl) {
        return "WeChat requires bridgeUrl (or --use-env).";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "wechat",
        accountId,
        name: input.name,
      });

      const channels = namedConfig.channels as Record<string, unknown> | undefined;
      const existingWechat = (channels?.wechat ?? {}) as Record<string, unknown>;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...namedConfig,
          channels: {
            ...channels,
            wechat: {
              ...existingWechat,
              enabled: true,
              ...(input.useEnv ? {} : input.bridgeUrl ? { bridgeUrl: input.bridgeUrl } : {}),
            },
          },
        };
      }

      const existingAccounts = (existingWechat.accounts ?? {}) as Record<string, unknown>;
      const existingAccount = (existingAccounts[accountId] ?? {}) as Record<string, unknown>;

      return {
        ...namedConfig,
        channels: {
          ...channels,
          wechat: {
            ...existingWechat,
            enabled: true,
            accounts: {
              ...existingAccounts,
              [accountId]: {
                ...existingAccount,
                enabled: true,
                ...(input.bridgeUrl ? { bridgeUrl: input.bridgeUrl } : {}),
              },
            },
          },
        },
      };
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: chunkWeChatText,
    chunkerMode: "length",
    textChunkLimit: 2000,
    sendText: async ({ to, text, accountId }) => {
      const gateway = getGateway(accountId ?? DEFAULT_ACCOUNT_ID);
      if (!gateway?.isConnected()) {
        throw new Error("WeChat gateway not connected");
      }

      const success = await gateway.sendText(to, text);
      if (!success) {
        throw new Error("Failed to send WeChat message");
      }

      return {
        channel: "wechat",
        ok: true,
        to,
      };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId }) => {
      const gateway = getGateway(accountId ?? DEFAULT_ACCOUNT_ID);
      if (!gateway?.isConnected()) {
        throw new Error("WeChat gateway not connected");
      }

      // Send media file if URL is a local path
      if (mediaUrl) {
        const success = await gateway.sendFile(to, mediaUrl);
        if (!success) {
          throw new Error("Failed to send WeChat media");
        }
      }

      // Send text caption if provided
      if (text) {
        const success = await gateway.sendText(to, text);
        if (!success) {
          throw new Error("Failed to send WeChat caption");
        }
      }

      return {
        channel: "wechat",
        ok: true,
        to,
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
    } as WeChatAccountRuntime,
    collectStatusIssues: (accounts) => {
      const issues: Array<{ level: "error" | "warning"; message: string; accountId?: string }> = [];

      for (const account of accounts) {
        if (!account.configured) {
          issues.push({
            level: "error",
            message: "WeChat bridge not configured",
            accountId: account.accountId,
          });
        }
      }

      return issues;
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      bridgeUrlSource: snapshot.bridgeUrlSource ?? "none",
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      wxid: snapshot.wxid ?? null,
      nickname: snapshot.nickname ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }) => {
      // Simple probe: check if bridge URL is reachable
      if (!account.bridgeUrl) {
        return { ok: false, error: "No bridge URL configured" };
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs ?? 5000);

        // Try HTTP health check endpoint if available
        const healthUrl = account.bridgeUrl.replace(/^ws/, "http").replace(/\/$/, "") + "/health";
        const response = await fetch(healthUrl, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        return {
          ok: response.ok,
          status: response.status,
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    buildAccountSnapshot: ({ account, runtime }) => {
      const configured = isWeChatAccountConfigured(account);
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured,
        bridgeUrlSource: account.bridgeUrlSource,
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        wxid: (runtime as WeChatAccountRuntime)?.wxid ?? null,
        nickname: (runtime as WeChatAccountRuntime)?.nickname ?? null,
        lastInboundAt: runtime?.lastInboundAt ?? null,
        lastOutboundAt: runtime?.lastOutboundAt ?? null,
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const { account, cfg, log, abortSignal } = ctx;

      if (!account.bridgeUrl) {
        throw new Error("WeChat bridge URL not configured");
      }

      log?.info(`[${account.accountId}] Starting WeChat gateway`);

      const gateway = createGateway({
        bridgeUrl: account.bridgeUrl,
        accountId: account.accountId,
        listenChats: account.config.listenChats,
        onMessage: (message: WeChatMessage) => {
          // Route message to OpenClaw runtime
          const runtime = getWeChatRuntime();
          runtime.channel.inbound.handleInbound({
            channel: "wechat",
            accountId: account.accountId,
            chatType: message.chatType === "group" ? "group" : "direct",
            from: message.from,
            to: message.to,
            text: message.text,
            timestamp: message.timestamp,
            groupId: message.chatType === "group" ? message.to : undefined,
            groupName: message.groupName,
            senderName: message.senderName,
            mediaUrl: message.mediaUrl,
          });
        },
        onStatus: (status) => {
          if (status.connected) {
            log?.info(
              `[${account.accountId}] Connected as ${status.nickname} (${status.wxid})`
            );
          } else if (status.error) {
            log?.error(`[${account.accountId}] Connection error: ${status.error}`);
          }
        },
      });

      await gateway.connect();

      // Handle abort signal
      abortSignal?.addEventListener("abort", () => {
        removeGateway(account.accountId);
      });

      return {
        running: true,
        wxid: gateway.getWxid(),
        nickname: gateway.getNickname(),
      };
    },
    logoutAccount: async ({ accountId, cfg }) => {
      removeGateway(accountId);

      // Clear config if needed
      const nextCfg = { ...cfg } as OpenClawConfig;
      const wechat = getWeChatConfig(cfg);
      let cleared = false;
      let changed = false;

      if (wechat) {
        const nextWechat = { ...wechat };

        if (accountId === DEFAULT_ACCOUNT_ID && nextWechat.bridgeUrl) {
          delete nextWechat.bridgeUrl;
          cleared = true;
          changed = true;
        }

        const accounts = nextWechat.accounts as Record<string, unknown> | undefined;
        if (accounts && accountId in accounts) {
          delete accounts[accountId];
          changed = true;
          cleared = true;
        }

        if (changed) {
          (nextCfg.channels as Record<string, unknown>).wechat = nextWechat;
          await getWeChatRuntime().config.writeConfigFile(nextCfg);
        }
      }

      return {
        cleared,
        envToken: Boolean(process.env.WECHAT_BRIDGE_URL),
        loggedOut: true,
      };
    },
  },
};

// Export the WebSocket upgrade handler for Gateway integration
export { handleWeChatUpgrade } from "./gateway.js";
