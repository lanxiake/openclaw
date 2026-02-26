import { imessageOutbound } from "../channels/plugins/outbound/imessage.js";
import { slackOutbound } from "../channels/plugins/outbound/slack.js";
import { telegramOutbound } from "../channels/plugins/outbound/telegram.js";
import { whatsappOutbound } from "../channels/plugins/outbound/whatsapp.js";
import { discordOutbound } from "../channels/plugins/outbound/discord.js";
import fs from "node:fs";
import type { MtBotConfig } from "../config/config.js";
import { normalizeWhatsAppTarget } from "../whatsapp/normalize.js";
import type {
  ChannelCapabilities,
  ChannelId,
  ChannelOutboundAdapter,
  ChannelAccountSnapshot,
  ChannelStatusIssue,
  ChannelPlugin,
} from "../channels/plugins/types.js";
import type { PluginRegistry } from "../plugins/registry.js";
import { normalizeIMessageHandle } from "../imessage/targets.js";

/**
 * Returns a channel-scoped config object and normalized account id.
 */
function resolveChannelConfigRecord(params: {
  cfg: MtBotConfig;
  channelId: ChannelId;
  accountId?: string | null;
}) {
  const channels = (params.cfg.channels as Record<string, unknown> | undefined) ?? {};
  const raw = channels[params.channelId] as
    | ({ accounts?: Record<string, unknown> } & Record<string, unknown>)
    | undefined;
  const resolvedAccountId = (params.accountId ?? "default").trim() || "default";
  const accountConfig = raw?.accounts?.[resolvedAccountId] as Record<string, unknown> | undefined;
  return {
    raw,
    resolvedAccountId,
    accountConfig,
  };
}

/**
 * Produces a shallow-cloned config with updated channel block.
 */
function withUpdatedChannelConfig(
  cfg: MtBotConfig,
  channelId: ChannelId,
  updater: (channelConfig: Record<string, unknown>) => Record<string, unknown>,
): MtBotConfig {
  const channels = { ...(cfg.channels as Record<string, unknown> | undefined) };
  const current = (channels[channelId] as Record<string, unknown> | undefined) ?? {};
  channels[channelId] = updater({ ...current });
  return { ...cfg, channels };
}

/**
 * Migrates legacy root-level account fields into accounts.default.
 */
function migrateRootFieldsToDefaultAccount(channelConfig: Record<string, unknown>) {
  const fieldsToMigrate = [
    "name",
    "token",
    "tokenFile",
    "botToken",
    "appToken",
    "account",
    "signalNumber",
  ] as const;
  const accounts = {
    ...(channelConfig.accounts as Record<string, unknown> | undefined),
  };
  const defaultAccount = (accounts.default as Record<string, unknown> | undefined) ?? {};
  const migrated: Record<string, unknown> = { ...defaultAccount };
  let changed = false;
  for (const field of fieldsToMigrate) {
    if (field in channelConfig && migrated[field] === undefined) {
      migrated[field] = channelConfig[field];
      changed = true;
    }
    if (field in channelConfig) {
      delete channelConfig[field];
    }
  }
  if (changed || accounts.default) {
    accounts.default = migrated;
    channelConfig.accounts = accounts;
  }
  return channelConfig;
}

/**
 * Applies channel add input into either root config or account-scoped config.
 */
function applySetupInputToChannelConfig(params: {
  channelId: ChannelId;
  accountId: string;
  cfg: MtBotConfig;
  input: Record<string, unknown>;
}): MtBotConfig {
  return withUpdatedChannelConfig(params.cfg, params.channelId, (current) => {
    const channelConfig: Record<string, unknown> = {
      ...current,
      enabled: true,
    };
    const useAccounts =
      params.accountId !== "default" ||
      (channelConfig.accounts && typeof channelConfig.accounts === "object");
    const normalizedValues: Record<string, unknown> = {};
    if (typeof params.input.name === "string" && params.input.name.trim()) {
      normalizedValues.name = params.input.name.trim();
    }
    if (typeof params.input.token === "string" && params.input.token.trim()) {
      normalizedValues[params.channelId === "telegram" ? "botToken" : "token"] =
        params.input.token.trim();
    }
    if (typeof params.input.tokenFile === "string" && params.input.tokenFile.trim()) {
      normalizedValues.tokenFile = params.input.tokenFile.trim();
    }
    if (typeof params.input.botToken === "string" && params.input.botToken.trim()) {
      normalizedValues.botToken = params.input.botToken.trim();
    }
    if (typeof params.input.appToken === "string" && params.input.appToken.trim()) {
      normalizedValues.appToken = params.input.appToken.trim();
    }
    if (typeof params.input.signalNumber === "string" && params.input.signalNumber.trim()) {
      normalizedValues.account = params.input.signalNumber.trim();
    }

    if (!useAccounts) {
      return { ...channelConfig, ...normalizedValues };
    }

    const migrated = migrateRootFieldsToDefaultAccount(channelConfig);
    const accounts = {
      ...(migrated.accounts as Record<string, unknown> | undefined),
    };
    const target = (accounts[params.accountId] as Record<string, unknown> | undefined) ?? {};
    accounts[params.accountId] = { ...target, ...normalizedValues };
    return { ...migrated, accounts };
  });
}

export const createTestRegistry = (channels: PluginRegistry["channels"] = []): PluginRegistry => ({
  plugins: [],
  tools: [],
  hooks: [],
  typedHooks: [],
  channels,
  providers: [],
  gatewayHandlers: {},
  httpHandlers: [],
  httpRoutes: [],
  cliRegistrars: [],
  services: [],
  commands: [],
  diagnostics: [],
});

export const createIMessageTestPlugin = (params?: {
  outbound?: ChannelOutboundAdapter;
}): ChannelPlugin => ({
  id: "imessage",
  meta: {
    id: "imessage",
    label: "iMessage",
    selectionLabel: "iMessage (imsg)",
    docsPath: "/channels/imessage",
    blurb: "iMessage test stub.",
    aliases: ["imsg"],
  },
  capabilities: { chatTypes: ["direct", "group"], media: true },
  config: {
    listAccountIds: () => [],
    resolveAccount: () => ({}),
  },
  status: {
    collectStatusIssues: (accounts) =>
      accounts.flatMap((account) => {
        const lastError = typeof account.lastError === "string" ? account.lastError.trim() : "";
        if (!lastError) {
          return [];
        }
        return [
          {
            channel: "imessage",
            accountId: account.accountId,
            kind: "runtime",
            message: `Channel error: ${lastError}`,
          },
        ];
      }),
  },
  outbound: params?.outbound ?? imessageOutbound,
  messaging: {
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) {
          return false;
        }
        if (/^(imessage:|sms:|auto:|chat_id:|chat_guid:|chat_identifier:)/i.test(trimmed)) {
          return true;
        }
        if (trimmed.includes("@")) {
          return true;
        }
        return /^\+?\d{3,}$/.test(trimmed);
      },
      hint: "<handle|chat_id:ID>",
    },
    normalizeTarget: (raw) => normalizeIMessageHandle(raw),
  },
});

/**
 * Creates a minimal channel plugin for registry/config tests.
 */
export const createBasicChannelTestPlugin = (params: {
  id: ChannelId;
  label?: string;
  aliases?: string[];
  docsPath?: string;
  capabilities?: ChannelCapabilities;
}): ChannelPlugin => ({
  id: params.id,
  meta: {
    id: params.id,
    label: params.label ?? String(params.id),
    selectionLabel: params.label ?? String(params.id),
    docsPath: params.docsPath ?? `/channels/${params.id}`,
    blurb: "test stub.",
    ...(params.aliases && params.aliases.length > 0 ? { aliases: params.aliases } : {}),
  },
  capabilities: params.capabilities ?? { chatTypes: ["direct"] },
  config: {
    listAccountIds: (cfg: MtBotConfig) => {
      const channels = (cfg.channels as Record<string, unknown> | undefined) ?? {};
      const raw = channels[params.id] as
        | { accounts?: Record<string, unknown> }
        | undefined;
      const accountIds = raw?.accounts ? Object.keys(raw.accounts) : [];
      return accountIds.length > 0 ? accountIds : ["default"];
    },
    resolveAccount: (cfg: MtBotConfig, accountId?: string | null) => {
      const { raw, resolvedAccountId, accountConfig } = resolveChannelConfigRecord({
        cfg,
        channelId: params.id,
        accountId,
      });
      return {
        accountId: resolvedAccountId,
        config: accountConfig ?? raw ?? {},
        ...(raw?.dm ? { dm: raw.dm } : {}),
      };
    },
    isEnabled: (account: unknown) =>
      ((account as { config?: { enabled?: boolean } })?.config?.enabled ?? true),
    isConfigured: (account: unknown) => {
      const config = (account as { config?: Record<string, unknown> } | undefined)?.config ?? {};
      const tokenFields = [
        "token",
        "botToken",
        "appToken",
        "password",
        "accessToken",
        "serverUrl",
        "baseUrl",
      ];
      return tokenFields.some((key) => typeof config[key] === "string" && config[key]?.trim()) || false;
    },
    describeAccount: (account: unknown) => {
      const typed = account as { accountId?: string; config?: Record<string, unknown> };
      return {
        accountId: typed.accountId ?? "default",
        name: typeof typed.config?.name === "string" ? typed.config.name : undefined,
      };
    },
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      withUpdatedChannelConfig(cfg, params.id, (channelConfig) => {
        const resolvedAccountId = accountId?.trim() || "default";
        const hasAccounts =
          Boolean(channelConfig.accounts) && typeof channelConfig.accounts === "object";
        if (resolvedAccountId === "default" && !hasAccounts) {
          return { ...channelConfig, enabled };
        }
        const accounts = {
          ...(channelConfig.accounts as Record<string, unknown> | undefined),
        };
        const current = (accounts[resolvedAccountId] as Record<string, unknown> | undefined) ?? {};
        accounts[resolvedAccountId] = { ...current, enabled };
        return { ...channelConfig, accounts };
      }),
    deleteAccount: ({ cfg, accountId }) =>
      withUpdatedChannelConfig(cfg, params.id, (channelConfig) => {
        const resolvedAccountId = accountId?.trim() || "default";
        const accounts = {
          ...(channelConfig.accounts as Record<string, unknown> | undefined),
        };
        if (resolvedAccountId in accounts) {
          delete accounts[resolvedAccountId];
        }
        return { ...channelConfig, accounts };
      }),
  },
  setup: {
    applyAccountName: ({ cfg, accountId, name }) =>
      applySetupInputToChannelConfig({
        cfg,
        channelId: params.id,
        accountId,
        input: { name },
      }),
    applyAccountConfig: ({ cfg, accountId, input }) =>
      applySetupInputToChannelConfig({
        cfg,
        channelId: params.id,
        accountId,
        input,
      }),
  },
  security: {},
});

/**
 * Creates a Signal-like plugin stub with runtime error surfacing.
 */
export const createSignalTestPlugin = (): ChannelPlugin => ({
  ...createBasicChannelTestPlugin({
    id: "signal",
    label: "Signal",
    docsPath: "/channels/signal",
  }),
  status: {
    collectStatusIssues: (accounts: ChannelAccountSnapshot[]): ChannelStatusIssue[] =>
      accounts.flatMap((account) => {
        const lastError = typeof account.lastError === "string" ? account.lastError.trim() : "";
        if (!lastError) {
          return [];
        }
        return [
          {
            channel: "signal",
            accountId: account.accountId,
            kind: "runtime",
            message: `Channel error: ${lastError}`,
          },
        ];
      }),
  },
});

/**
 * Creates a Slack-like plugin stub using core outbound adapter.
 */
export const createSlackTestPlugin = (): ChannelPlugin =>
  ({
    ...createOutboundTestPlugin({
      id: "slack",
      label: "Slack",
      docsPath: "/channels/slack",
      outbound: slackOutbound,
    }),
    messaging: {
      targetResolver: {
        looksLikeId: (raw: string) => {
          const trimmed = raw.trim();
          return /^([#@])?[a-z0-9_.-]+$/i.test(trimmed) || /^channel:[a-z0-9_.-]+$/i.test(trimmed);
        },
        hint: "<channel|#channel|channel:ID>",
      },
      normalizeTarget: (raw: string) => {
        let trimmed = raw.trim();
        if (!trimmed) {
          return "";
        }
        trimmed = trimmed.replace(/^slack:/i, "");
        if (trimmed.startsWith("#")) {
          trimmed = trimmed.slice(1);
        }
        if (!/^channel:/i.test(trimmed)) {
          trimmed = `channel:${trimmed}`;
        }
        return trimmed.toLowerCase();
      },
    },
    security: {},
  }) satisfies ChannelPlugin;

/**
 * Creates a Telegram-like plugin stub using core outbound adapter.
 */
export const createTelegramTestPlugin = (): ChannelPlugin =>
  ({
    ...createOutboundTestPlugin({
      id: "telegram",
      label: "Telegram",
      docsPath: "/channels/telegram",
      outbound: telegramOutbound,
    }),
    messaging: {
      targetResolver: {
        looksLikeId: (raw: string) => {
          const trimmed = raw.trim();
          return Boolean(trimmed);
        },
        hint: "<chat-id|@username>",
      },
      normalizeTarget: (raw: string) => raw.trim().replace(/^telegram:/i, ""),
    },
    config: {
      ...createBasicChannelTestPlugin({ id: "telegram", label: "Telegram" }).config,
      isConfigured: (account: unknown) => {
        const config = (account as { config?: Record<string, unknown> } | undefined)?.config ?? {};
        const botToken = typeof config.botToken === "string" ? config.botToken.trim() : "";
        if (botToken) {
          return true;
        }
        const tokenFile = typeof config.tokenFile === "string" ? config.tokenFile.trim() : "";
        if (!tokenFile) {
          return false;
        }
        if (!fs.existsSync(tokenFile)) {
          return false;
        }
        const fileToken = fs.readFileSync(tokenFile, "utf-8").trim();
        return Boolean(fileToken);
      },
    },
    status: {
      probeAccount: async ({ account }) => {
        const config = (account as { config?: Record<string, unknown> } | undefined)?.config ?? {};
        const tokenFromConfig = typeof config.botToken === "string" ? config.botToken.trim() : "";
        const tokenFile = typeof config.tokenFile === "string" ? config.tokenFile.trim() : "";
        const tokenFromFile =
          tokenFile && fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, "utf-8").trim() : "";
        const token = tokenFromConfig || tokenFromFile;
        const startedAt = Date.now();
        const getMeUrl = `https://api.telegram.org/bot${token}/getMe`;
        const getMeResponse = await fetch(getMeUrl);
        const getMePayload = (await getMeResponse.json()) as Record<string, unknown>;
        if (!getMeResponse.ok || getMePayload.ok === false) {
          const descriptionRaw = getMePayload.description;
          const description =
            typeof descriptionRaw === "string" && descriptionRaw.trim()
              ? descriptionRaw
              : "telegram probe failed";
          return {
            ok: false,
            status: getMeResponse.status,
            error: description,
            elapsedMs: Date.now() - startedAt,
          };
        }
        const webhookUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
        const webhookResponse = await fetch(webhookUrl);
        const webhookPayload = (await webhookResponse.json()) as Record<string, unknown>;
        return {
          ok: true,
          status: webhookResponse.status,
          bot: (getMePayload.result as Record<string, unknown> | undefined) ?? null,
          webhook: (webhookPayload.result as Record<string, unknown> | undefined) ?? null,
          elapsedMs: Date.now() - startedAt,
        };
      },
      collectStatusIssues: (accounts: ChannelAccountSnapshot[]): ChannelStatusIssue[] =>
        accounts.flatMap((account) => {
          const issues: ChannelStatusIssue[] = [];
          if (!account.allowUnmentionedGroups) {
            // continue to evaluate audit warnings even when this flag is off
          } else {
            issues.push({
              channel: "telegram",
              accountId: account.accountId,
              kind: "config",
              message: "Telegram Bot API privacy mode may block group mentions.",
            });
          }
          const audit = account.audit as
            | {
                hasWildcardUnmentionedGroups?: boolean;
                groups?: Array<{ chatId?: string; ok?: boolean }>;
              }
            | undefined;
          if (audit?.hasWildcardUnmentionedGroups) {
            issues.push({
              channel: "telegram",
              accountId: account.accountId,
              kind: "config",
              message: "membership probing is not possible when wildcard unmentioned groups are enabled.",
            });
          }
          const failedGroup = audit?.groups?.find((entry) => entry.ok === false);
          if (failedGroup?.chatId) {
            issues.push({
              channel: "telegram",
              accountId: account.accountId,
              kind: "runtime",
              message: `Group ${failedGroup.chatId} membership audit failed.`,
            });
          }
          return issues;
        }),
    },
    security: {},
  }) satisfies ChannelPlugin;

/**
 * Creates a WhatsApp-like plugin stub using core outbound adapter.
 */
export const createWhatsAppTestPlugin = (): ChannelPlugin =>
  ({
    ...createOutboundTestPlugin({
      id: "whatsapp",
      label: "WhatsApp",
      docsPath: "/channels/whatsapp",
      outbound: whatsappOutbound,
    }),
    config: {
      ...createBasicChannelTestPlugin({ id: "whatsapp", label: "WhatsApp" }).config,
      resolveAllowFrom: ({ cfg }: { cfg: MtBotConfig }) => cfg.channels?.whatsapp?.allowFrom,
    },
    messaging: {
      targetResolver: {
        looksLikeId: (raw: string) => Boolean(normalizeWhatsAppTarget(raw)),
        hint: "<E.164|group JID>",
      },
      normalizeTarget: (raw: string) => normalizeWhatsAppTarget(raw) ?? "",
    },
    heartbeat: {
      checkReady: async ({ deps }) => {
        const linked = (await deps?.webAuthExists?.()) ?? false;
        const running = deps?.hasActiveWebListener?.() ?? false;
        return linked && running
          ? { ok: true, reason: "" }
          : { ok: false, reason: "whatsapp-not-linked" };
      },
    },
    security: {},
  }) satisfies ChannelPlugin;

/**
 * Creates a Discord-like plugin stub for channel registry tests.
 */
export const createDiscordTestPlugin = (): ChannelPlugin =>
  ({
    ...createBasicChannelTestPlugin({
      id: "discord",
      label: "Discord",
      docsPath: "/channels/discord",
    }),
    outbound: {
      ...discordOutbound,
    },
    messaging: {
      targetResolver: {
        looksLikeId: (raw: string) => Boolean(raw.trim()),
        hint: "<channel:ID|ID>",
      },
      normalizeTarget: (raw: string) => {
        const trimmed = raw.trim().replace(/^discord:/i, "");
        return /^channel:/i.test(trimmed) ? trimmed.toLowerCase() : `channel:${trimmed.toLowerCase()}`;
      },
    },
    status: {
      collectStatusIssues: (accounts: ChannelAccountSnapshot[]): ChannelStatusIssue[] =>
        accounts.flatMap((account) => {
          const issues: ChannelStatusIssue[] = [];
          const app = account.application as { intents?: { messageContent?: string } } | undefined;
          if (app?.intents?.messageContent === "disabled") {
            issues.push({
              channel: "discord",
              accountId: account.accountId,
              kind: "intent",
              message: "Message Content Intent is disabled.",
            });
          }
          const audit = account.audit as
            | { unresolvedChannels?: number; channels?: Array<{ channelId?: string; ok?: boolean }> }
            | undefined;
          if ((audit?.unresolvedChannels ?? 0) > 0) {
            const firstFailed = audit?.channels?.find((entry) => entry.ok === false);
            issues.push({
              channel: "discord",
              accountId: account.accountId,
              kind: "runtime",
              message: `permission audit failed${firstFailed?.channelId ? ` (Channel ${firstFailed.channelId})` : ""}`,
            });
          }
          return issues;
        }),
    },
    security: {},
  }) satisfies ChannelPlugin;

export const createOutboundTestPlugin = (params: {
  id: ChannelId;
  outbound: ChannelOutboundAdapter;
  label?: string;
  docsPath?: string;
  capabilities?: ChannelCapabilities;
}): ChannelPlugin => ({
  ...createBasicChannelTestPlugin({
    id: params.id,
    label: params.label,
    docsPath: params.docsPath,
    capabilities: params.capabilities,
  }),
  outbound: params.outbound,
});
