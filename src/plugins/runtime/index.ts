import { createRequire } from "node:module";

import {
  chunkByNewline,
  chunkMarkdownText,
  chunkMarkdownTextWithMode,
  chunkText,
  chunkTextWithMode,
  resolveChunkMode,
  resolveTextChunkLimit,
} from "../../auto-reply/chunk.js";
import {
  hasControlCommand,
  isControlCommandMessage,
  shouldComputeCommandAuthorized,
} from "../../auto-reply/command-detection.js";
import { shouldHandleTextCommands } from "../../auto-reply/commands-registry.js";
import {
  createInboundDebouncer,
  resolveInboundDebounceMs,
} from "../../auto-reply/inbound-debounce.js";
import {
  formatAgentEnvelope,
  formatInboundEnvelope,
  resolveEnvelopeFormatOptions,
} from "../../auto-reply/envelope.js";
import { dispatchReplyFromConfig } from "../../auto-reply/reply/dispatch-from-config.js";
import {
  buildMentionRegexes,
  matchesMentionPatterns,
  matchesMentionWithExplicit,
} from "../../auto-reply/reply/mentions.js";
import { dispatchReplyWithBufferedBlockDispatcher } from "../../auto-reply/reply/provider-dispatcher.js";
import { createReplyDispatcherWithTyping } from "../../auto-reply/reply/reply-dispatcher.js";
import { finalizeInboundContext } from "../../auto-reply/reply/inbound-context.js";
import {
  resolveEffectiveMessagesConfig,
  resolveHumanDelayConfig,
} from "../../agent/runtime/identity.js";
import { createMemoryGetTool, createMemorySearchTool } from "../../agent/tools/memory-tool.js";
import { handleSlackAction } from "../../agent/tools/slack-actions.js";
import { handleWhatsAppAction } from "../../agent/tools/whatsapp-actions.js";
import {
  removeAckReactionAfterReply,
  shouldAckReaction,
} from "../../channels/core/ack-reactions.js";
import { resolveCommandAuthorizedFromAuthorizers } from "../../channels/core/command-gating.js";
import { recordInboundSession } from "../../channels/core/session.js";
import { discordMessageActions } from "../../channels/core/plugins/actions/discord.js";
import { signalMessageActions } from "../../channels/core/plugins/actions/signal.js";
import { telegramMessageActions } from "../../channels/core/plugins/actions/telegram.js";
import { createWhatsAppLoginTool } from "../../channels/core/plugins/agent-tools/whatsapp-login.js";
import { monitorWebChannel } from "../../channels/core/web/index.js";
import {
  resolveChannelGroupPolicy,
  resolveChannelGroupRequireMention,
} from "../../config/group-policy.js";
import { resolveMarkdownTableMode } from "../../config/markdown-tables.js";
import { resolveStateDir } from "../../config/paths.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import {
  readSessionUpdatedAt,
  recordSessionMetaFromInbound,
  resolveStorePath,
  updateLastRoute,
} from "../../config/sessions.js";
import { auditDiscordChannelPermissions } from "../../channels/discord/audit.js";
import {
  listDiscordDirectoryGroupsLive,
  listDiscordDirectoryPeersLive,
} from "../../channels/discord/directory-live.js";
import { monitorDiscordProvider } from "../../channels/discord/monitor.js";
import { probeDiscord } from "../../channels/discord/probe.js";
import { resolveDiscordChannelAllowlist } from "../../channels/discord/resolve-channels.js";
import { resolveDiscordUserAllowlist } from "../../channels/discord/resolve-users.js";
import { sendMessageDiscord, sendPollDiscord } from "../../channels/discord/send.js";
import { getChannelActivity, recordChannelActivity } from "../../infra/channel-activity.js";
import { enqueueSystemEvent } from "../../infra/system-events.js";
import { monitorIMessageProvider } from "../../channels/imessage/monitor.js";
import { probeIMessage } from "../../channels/imessage/probe.js";
import { sendMessageIMessage } from "../../channels/imessage/send.js";
import { shouldLogVerbose } from "../../globals.js";
import { convertMarkdownTables } from "../../shared/markdown/tables.js";
import { getChildLogger } from "../../logging.js";
import { normalizeLogLevel } from "../../shared/logging/levels.js";
import { isVoiceCompatibleAudio } from "../../services/media/audio.js";
import { mediaKindFromMime } from "../../services/media/constants.js";
import { fetchRemoteMedia } from "../../services/media/fetch.js";
import { getImageMetadata, resizeToJpeg } from "../../services/media/image-ops.js";
import { detectMime } from "../../services/media/mime.js";
import { saveMediaBuffer } from "../../services/media/store.js";
import { buildPairingReply } from "../../infra/device/pairing/pairing-messages.js";
import {
  readChannelAllowFromStore,
  upsertChannelPairingRequest,
} from "../../infra/device/pairing/pairing-store.js";
import { runCommandWithTimeout } from "../../infra/process/exec.js";
import { resolveAgentRoute } from "../../routing/resolve-route.js";
import { monitorSignalProvider } from "../../channels/signal/index.js";
import { probeSignal } from "../../channels/signal/probe.js";
import { sendMessageSignal } from "../../channels/signal/send.js";
import { monitorSlackProvider } from "../../channels/slack/index.js";
import {
  listSlackDirectoryGroupsLive,
  listSlackDirectoryPeersLive,
} from "../../channels/slack/directory-live.js";
import { probeSlack } from "../../channels/slack/probe.js";
import { resolveSlackChannelAllowlist } from "../../channels/slack/resolve-channels.js";
import { resolveSlackUserAllowlist } from "../../channels/slack/resolve-users.js";
import { sendMessageSlack } from "../../channels/slack/send.js";
import {
  auditTelegramGroupMembership,
  collectTelegramUnmentionedGroupIds,
} from "../../channels/telegram/audit.js";
import { monitorTelegramProvider } from "../../channels/telegram/monitor.js";
import { probeTelegram } from "../../channels/telegram/probe.js";
import { sendMessageTelegram } from "../../channels/telegram/send.js";
import { resolveTelegramToken } from "../../channels/telegram/token.js";
import { loadWebMedia } from "../../channels/whatsapp/media.js";
import { getActiveWebListener } from "../../channels/whatsapp/active-listener.js";
import {
  getWebAuthAgeMs,
  logoutWeb,
  logWebSelfId,
  readWebSelfId,
  webAuthExists,
} from "../../channels/whatsapp/auth-store.js";
import { loginWeb } from "../../channels/whatsapp/login.js";
import { startWebLoginWithQr, waitForWebLogin } from "../../channels/whatsapp/login-qr.js";
import { sendMessageWhatsApp, sendPollWhatsApp } from "../../channels/whatsapp/outbound.js";
import { registerMemoryCli } from "../../cli/memory-cli.js";
import { formatNativeDependencyHint } from "./native-deps.js";
import { textToSpeechTelephony } from "../../services/tts/tts.js";
import {
  listLineAccountIds,
  normalizeAccountId as normalizeLineAccountId,
  resolveDefaultLineAccountId,
  resolveLineAccount,
} from "../../channels/line/accounts.js";
import { probeLineBot } from "../../channels/line/probe.js";
import {
  createQuickReplyItems,
  pushMessageLine,
  pushMessagesLine,
  pushFlexMessage,
  pushTemplateMessage,
  pushLocationMessage,
  pushTextMessageWithQuickReplies,
  sendMessageLine,
} from "../../channels/line/send.js";
import { monitorLineProvider } from "../../channels/line/monitor.js";
import { buildTemplateMessageFromPayload } from "../../channels/line/template-messages.js";

import type { PluginRuntime } from "./types.js";

let cachedVersion: string | null = null;

function resolveVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../../../package.json") as { version?: string };
    cachedVersion = pkg.version ?? "unknown";
    return cachedVersion;
  } catch {
    cachedVersion = "unknown";
    return cachedVersion;
  }
}

export function createPluginRuntime(): PluginRuntime {
  return {
    version: resolveVersion(),
    config: {
      loadConfig,
      writeConfigFile,
    },
    system: {
      enqueueSystemEvent,
      runCommandWithTimeout,
      formatNativeDependencyHint,
    },
    media: {
      loadWebMedia,
      detectMime,
      mediaKindFromMime,
      isVoiceCompatibleAudio,
      getImageMetadata,
      resizeToJpeg,
    },
    tts: {
      textToSpeechTelephony,
    },
    tools: {
      createMemoryGetTool,
      createMemorySearchTool,
      registerMemoryCli,
    },
    channel: {
      text: {
        chunkByNewline,
        chunkMarkdownText,
        chunkMarkdownTextWithMode,
        chunkText,
        chunkTextWithMode,
        resolveChunkMode,
        resolveTextChunkLimit,
        hasControlCommand,
        resolveMarkdownTableMode,
        convertMarkdownTables,
      },
      reply: {
        dispatchReplyWithBufferedBlockDispatcher,
        createReplyDispatcherWithTyping,
        resolveEffectiveMessagesConfig,
        resolveHumanDelayConfig,
        dispatchReplyFromConfig,
        finalizeInboundContext,
        formatAgentEnvelope,
        formatInboundEnvelope,
        resolveEnvelopeFormatOptions,
      },
      routing: {
        resolveAgentRoute,
      },
      pairing: {
        buildPairingReply,
        readAllowFromStore: readChannelAllowFromStore,
        upsertPairingRequest: upsertChannelPairingRequest,
      },
      media: {
        fetchRemoteMedia,
        saveMediaBuffer,
      },
      activity: {
        record: recordChannelActivity,
        get: getChannelActivity,
      },
      session: {
        resolveStorePath,
        readSessionUpdatedAt,
        recordSessionMetaFromInbound,
        recordInboundSession,
        updateLastRoute,
      },
      mentions: {
        buildMentionRegexes,
        matchesMentionPatterns,
        matchesMentionWithExplicit,
      },
      reactions: {
        shouldAckReaction,
        removeAckReactionAfterReply,
      },
      groups: {
        resolveGroupPolicy: resolveChannelGroupPolicy,
        resolveRequireMention: resolveChannelGroupRequireMention,
      },
      debounce: {
        createInboundDebouncer,
        resolveInboundDebounceMs,
      },
      commands: {
        resolveCommandAuthorizedFromAuthorizers,
        isControlCommandMessage,
        shouldComputeCommandAuthorized,
        shouldHandleTextCommands,
      },
      discord: {
        messageActions: discordMessageActions,
        auditChannelPermissions: auditDiscordChannelPermissions,
        listDirectoryGroupsLive: listDiscordDirectoryGroupsLive,
        listDirectoryPeersLive: listDiscordDirectoryPeersLive,
        probeDiscord,
        resolveChannelAllowlist: resolveDiscordChannelAllowlist,
        resolveUserAllowlist: resolveDiscordUserAllowlist,
        sendMessageDiscord,
        sendPollDiscord,
        monitorDiscordProvider,
      },
      slack: {
        listDirectoryGroupsLive: listSlackDirectoryGroupsLive,
        listDirectoryPeersLive: listSlackDirectoryPeersLive,
        probeSlack,
        resolveChannelAllowlist: resolveSlackChannelAllowlist,
        resolveUserAllowlist: resolveSlackUserAllowlist,
        sendMessageSlack,
        monitorSlackProvider,
        handleSlackAction,
      },
      telegram: {
        auditGroupMembership: auditTelegramGroupMembership,
        collectUnmentionedGroupIds: collectTelegramUnmentionedGroupIds,
        probeTelegram,
        resolveTelegramToken,
        sendMessageTelegram,
        monitorTelegramProvider,
        messageActions: telegramMessageActions,
      },
      signal: {
        probeSignal,
        sendMessageSignal,
        monitorSignalProvider,
        messageActions: signalMessageActions,
      },
      imessage: {
        monitorIMessageProvider,
        probeIMessage,
        sendMessageIMessage,
      },
      whatsapp: {
        getActiveWebListener,
        getWebAuthAgeMs,
        logoutWeb,
        logWebSelfId,
        readWebSelfId,
        webAuthExists,
        sendMessageWhatsApp,
        sendPollWhatsApp,
        loginWeb,
        startWebLoginWithQr,
        waitForWebLogin,
        monitorWebChannel,
        handleWhatsAppAction,
        createLoginTool: createWhatsAppLoginTool,
      },
      line: {
        listLineAccountIds,
        resolveDefaultLineAccountId,
        resolveLineAccount,
        normalizeAccountId: normalizeLineAccountId,
        probeLineBot,
        sendMessageLine,
        pushMessageLine,
        pushMessagesLine,
        pushFlexMessage,
        pushTemplateMessage,
        pushLocationMessage,
        pushTextMessageWithQuickReplies,
        createQuickReplyItems,
        buildTemplateMessageFromPayload,
        monitorLineProvider,
      },
    },
    logging: {
      shouldLogVerbose,
      getChildLogger: (bindings, opts) => {
        const logger = getChildLogger(bindings, {
          level: opts?.level ? normalizeLogLevel(opts.level) : undefined,
        });
        return {
          debug: (message) => logger.debug?.(message),
          info: (message) => logger.info(message),
          warn: (message) => logger.warn(message),
          error: (message) => logger.error(message),
        };
      },
    },
    state: {
      resolveStateDir,
    },
  };
}

export type { PluginRuntime } from "./types.js";
