import type { LogLevel } from "../../shared/logging/levels.js";

type ShouldLogVerbose = typeof import("../../globals.js").shouldLogVerbose;
type DispatchReplyWithBufferedBlockDispatcher =
  typeof import("../../messaging/reply/provider-dispatcher.js").dispatchReplyWithBufferedBlockDispatcher;
type CreateReplyDispatcherWithTyping =
  typeof import("../../messaging/reply/reply-dispatcher.js").createReplyDispatcherWithTyping;
type ResolveEffectiveMessagesConfig =
  typeof import("../../agent/runtime/identity.js").resolveEffectiveMessagesConfig;
type ResolveHumanDelayConfig =
  typeof import("../../agent/runtime/identity.js").resolveHumanDelayConfig;
type ResolveAgentRoute =
  typeof import("../../messaging/routing/resolve-route.js").resolveAgentRoute;
type BuildPairingReply =
  typeof import("../../infra/device/pairing/pairing-messages.js").buildPairingReply;
type ReadChannelAllowFromStore =
  typeof import("../../infra/device/pairing/pairing-store.js").readChannelAllowFromStore;
type UpsertChannelPairingRequest =
  typeof import("../../infra/device/pairing/pairing-store.js").upsertChannelPairingRequest;
type FetchRemoteMedia = typeof import("../../services/media/fetch.js").fetchRemoteMedia;
type SaveMediaBuffer = typeof import("../../services/media/store.js").saveMediaBuffer;
type TextToSpeechTelephony = typeof import("../../services/tts/tts.js").textToSpeechTelephony;
type BuildMentionRegexes = typeof import("../../messaging/reply/mentions.js").buildMentionRegexes;
type MatchesMentionPatterns =
  typeof import("../../messaging/reply/mentions.js").matchesMentionPatterns;
type MatchesMentionWithExplicit =
  typeof import("../../messaging/reply/mentions.js").matchesMentionWithExplicit;
type ShouldAckReaction = typeof import("../../channels/core/ack-reactions.js").shouldAckReaction;
type RemoveAckReactionAfterReply =
  typeof import("../../channels/core/ack-reactions.js").removeAckReactionAfterReply;
type ResolveChannelGroupPolicy =
  typeof import("../../config/group-policy.js").resolveChannelGroupPolicy;
type ResolveChannelGroupRequireMention =
  typeof import("../../config/group-policy.js").resolveChannelGroupRequireMention;
type CreateInboundDebouncer =
  typeof import("../../messaging/inbound-debounce.js").createInboundDebouncer;
type ResolveInboundDebounceMs =
  typeof import("../../messaging/inbound-debounce.js").resolveInboundDebounceMs;
type ResolveCommandAuthorizedFromAuthorizers =
  typeof import("../../channels/core/command-gating.js").resolveCommandAuthorizedFromAuthorizers;
type ResolveTextChunkLimit = typeof import("../../messaging/chunk.js").resolveTextChunkLimit;
type ResolveChunkMode = typeof import("../../messaging/chunk.js").resolveChunkMode;
type ChunkMarkdownText = typeof import("../../messaging/chunk.js").chunkMarkdownText;
type ChunkMarkdownTextWithMode =
  typeof import("../../messaging/chunk.js").chunkMarkdownTextWithMode;
type ChunkText = typeof import("../../messaging/chunk.js").chunkText;
type ChunkTextWithMode = typeof import("../../messaging/chunk.js").chunkTextWithMode;
type ChunkByNewline = typeof import("../../messaging/chunk.js").chunkByNewline;
type ResolveMarkdownTableMode =
  typeof import("../../config/markdown-tables.js").resolveMarkdownTableMode;
type ConvertMarkdownTables = typeof import("../../shared/markdown/tables.js").convertMarkdownTables;
type HasControlCommand = typeof import("../../messaging/command-detection.js").hasControlCommand;
type IsControlCommandMessage =
  typeof import("../../messaging/command-detection.js").isControlCommandMessage;
type ShouldComputeCommandAuthorized =
  typeof import("../../messaging/command-detection.js").shouldComputeCommandAuthorized;
type ShouldHandleTextCommands =
  typeof import("../../messaging/commands-registry.js").shouldHandleTextCommands;
type DispatchReplyFromConfig =
  typeof import("../../messaging/reply/dispatch-from-config.js").dispatchReplyFromConfig;
type FinalizeInboundContext =
  typeof import("../../messaging/reply/inbound-context.js").finalizeInboundContext;
type FormatAgentEnvelope = typeof import("../../messaging/envelope.js").formatAgentEnvelope;
type FormatInboundEnvelope = typeof import("../../messaging/envelope.js").formatInboundEnvelope;
type ResolveEnvelopeFormatOptions =
  typeof import("../../messaging/envelope.js").resolveEnvelopeFormatOptions;
type ResolveStateDir = typeof import("../../config/paths.js").resolveStateDir;
type RecordInboundSession = typeof import("../../channels/core/session.js").recordInboundSession;
type RecordSessionMetaFromInbound =
  typeof import("../../config/sessions.js").recordSessionMetaFromInbound;
type ResolveStorePath = typeof import("../../config/sessions.js").resolveStorePath;
type ReadSessionUpdatedAt = typeof import("../../config/sessions.js").readSessionUpdatedAt;
type UpdateLastRoute = typeof import("../../config/sessions.js").updateLastRoute;
type LoadConfig = typeof import("../../config/config.js").loadConfig;
type WriteConfigFile = typeof import("../../config/config.js").writeConfigFile;
type RecordChannelActivity = typeof import("../../infra/channel-activity.js").recordChannelActivity;
type GetChannelActivity = typeof import("../../infra/channel-activity.js").getChannelActivity;
type EnqueueSystemEvent = typeof import("../../infra/system-events.js").enqueueSystemEvent;
type RunCommandWithTimeout = typeof import("../../infra/process/exec.js").runCommandWithTimeout;
type FormatNativeDependencyHint = typeof import("./native-deps.js").formatNativeDependencyHint;
type LoadWebMedia = typeof import("../../channels/whatsapp/media.js").loadWebMedia;
type DetectMime = typeof import("../../services/media/mime.js").detectMime;
type MediaKindFromMime = typeof import("../../services/media/constants.js").mediaKindFromMime;
type IsVoiceCompatibleAudio = typeof import("../../services/media/audio.js").isVoiceCompatibleAudio;
type GetImageMetadata = typeof import("../../services/media/image-ops.js").getImageMetadata;
type ResizeToJpeg = typeof import("../../services/media/image-ops.js").resizeToJpeg;
type CreateMemoryGetTool = typeof import("../../agent/tools/memory-tool.js").createMemoryGetTool;
type CreateMemorySearchTool =
  typeof import("../../agent/tools/memory-tool.js").createMemorySearchTool;
type RegisterMemoryCli = typeof import("../../cli/memory-cli.js").registerMemoryCli;
type DiscordMessageActions =
  typeof import("../../channels/core/plugins/actions/discord.js").discordMessageActions;
type AuditDiscordChannelPermissions =
  typeof import("../../channels/discord/audit.js").auditDiscordChannelPermissions;
type ListDiscordDirectoryGroupsLive =
  typeof import("../../channels/discord/directory-live.js").listDiscordDirectoryGroupsLive;
type ListDiscordDirectoryPeersLive =
  typeof import("../../channels/discord/directory-live.js").listDiscordDirectoryPeersLive;
type ProbeDiscord = typeof import("../../channels/discord/probe.js").probeDiscord;
type ResolveDiscordChannelAllowlist =
  typeof import("../../channels/discord/resolve-channels.js").resolveDiscordChannelAllowlist;
type ResolveDiscordUserAllowlist =
  typeof import("../../channels/discord/resolve-users.js").resolveDiscordUserAllowlist;
type SendMessageDiscord = typeof import("../../channels/discord/send.js").sendMessageDiscord;
type SendPollDiscord = typeof import("../../channels/discord/send.js").sendPollDiscord;
type MonitorDiscordProvider =
  typeof import("../../channels/discord/monitor.js").monitorDiscordProvider;
type ListSlackDirectoryGroupsLive =
  typeof import("../../channels/slack/directory-live.js").listSlackDirectoryGroupsLive;
type ListSlackDirectoryPeersLive =
  typeof import("../../channels/slack/directory-live.js").listSlackDirectoryPeersLive;
type ProbeSlack = typeof import("../../channels/slack/probe.js").probeSlack;
type ResolveSlackChannelAllowlist =
  typeof import("../../channels/slack/resolve-channels.js").resolveSlackChannelAllowlist;
type ResolveSlackUserAllowlist =
  typeof import("../../channels/slack/resolve-users.js").resolveSlackUserAllowlist;
type SendMessageSlack = typeof import("../../channels/slack/send.js").sendMessageSlack;
type MonitorSlackProvider = typeof import("../../channels/slack/index.js").monitorSlackProvider;
type HandleSlackAction = typeof import("../../agent/tools/slack-actions.js").handleSlackAction;
type AuditTelegramGroupMembership =
  typeof import("../../channels/telegram/audit.js").auditTelegramGroupMembership;
type CollectTelegramUnmentionedGroupIds =
  typeof import("../../channels/telegram/audit.js").collectTelegramUnmentionedGroupIds;
type ProbeTelegram = typeof import("../../channels/telegram/probe.js").probeTelegram;
type ResolveTelegramToken = typeof import("../../channels/telegram/token.js").resolveTelegramToken;
type SendMessageTelegram = typeof import("../../channels/telegram/send.js").sendMessageTelegram;
type MonitorTelegramProvider =
  typeof import("../../channels/telegram/monitor.js").monitorTelegramProvider;
type TelegramMessageActions =
  typeof import("../../channels/core/plugins/actions/telegram.js").telegramMessageActions;
type ProbeSignal = typeof import("../../channels/signal/probe.js").probeSignal;
type SendMessageSignal = typeof import("../../channels/signal/send.js").sendMessageSignal;
type MonitorSignalProvider = typeof import("../../channels/signal/index.js").monitorSignalProvider;
type SignalMessageActions =
  typeof import("../../channels/core/plugins/actions/signal.js").signalMessageActions;
type MonitorIMessageProvider =
  typeof import("../../channels/imessage/monitor.js").monitorIMessageProvider;
type ProbeIMessage = typeof import("../../channels/imessage/probe.js").probeIMessage;
type SendMessageIMessage = typeof import("../../channels/imessage/send.js").sendMessageIMessage;
type GetActiveWebListener =
  typeof import("../../channels/whatsapp/active-listener.js").getActiveWebListener;
type GetWebAuthAgeMs = typeof import("../../channels/whatsapp/auth-store.js").getWebAuthAgeMs;
type LogoutWeb = typeof import("../../channels/whatsapp/auth-store.js").logoutWeb;
type LogWebSelfId = typeof import("../../channels/whatsapp/auth-store.js").logWebSelfId;
type ReadWebSelfId = typeof import("../../channels/whatsapp/auth-store.js").readWebSelfId;
type WebAuthExists = typeof import("../../channels/whatsapp/auth-store.js").webAuthExists;
type SendMessageWhatsApp = typeof import("../../channels/whatsapp/outbound.js").sendMessageWhatsApp;
type SendPollWhatsApp = typeof import("../../channels/whatsapp/outbound.js").sendPollWhatsApp;
type LoginWeb = typeof import("../../channels/whatsapp/login.js").loginWeb;
type StartWebLoginWithQr = typeof import("../../channels/whatsapp/login-qr.js").startWebLoginWithQr;
type WaitForWebLogin = typeof import("../../channels/whatsapp/login-qr.js").waitForWebLogin;
type MonitorWebChannel = typeof import("../../channels/core/web/index.js").monitorWebChannel;
type HandleWhatsAppAction =
  typeof import("../../agent/tools/whatsapp-actions.js").handleWhatsAppAction;
type CreateWhatsAppLoginTool =
  typeof import("../../channels/core/plugins/agent-tools/whatsapp-login.js").createWhatsAppLoginTool;

// LINE channel types
type ListLineAccountIds = typeof import("../../channels/line/accounts.js").listLineAccountIds;
type ResolveDefaultLineAccountId =
  typeof import("../../channels/line/accounts.js").resolveDefaultLineAccountId;
type ResolveLineAccount = typeof import("../../channels/line/accounts.js").resolveLineAccount;
type NormalizeLineAccountId = typeof import("../../channels/line/accounts.js").normalizeAccountId;
type ProbeLineBot = typeof import("../../channels/line/probe.js").probeLineBot;
type SendMessageLine = typeof import("../../channels/line/send.js").sendMessageLine;
type PushMessageLine = typeof import("../../channels/line/send.js").pushMessageLine;
type PushMessagesLine = typeof import("../../channels/line/send.js").pushMessagesLine;
type PushFlexMessage = typeof import("../../channels/line/send.js").pushFlexMessage;
type PushTemplateMessage = typeof import("../../channels/line/send.js").pushTemplateMessage;
type PushLocationMessage = typeof import("../../channels/line/send.js").pushLocationMessage;
type PushTextMessageWithQuickReplies =
  typeof import("../../channels/line/send.js").pushTextMessageWithQuickReplies;
type CreateQuickReplyItems = typeof import("../../channels/line/send.js").createQuickReplyItems;
type BuildTemplateMessageFromPayload =
  typeof import("../../channels/line/template-messages.js").buildTemplateMessageFromPayload;
type MonitorLineProvider = typeof import("../../channels/line/monitor.js").monitorLineProvider;

export type RuntimeLogger = {
  debug?: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export type PluginRuntime = {
  version: string;
  config: {
    loadConfig: LoadConfig;
    writeConfigFile: WriteConfigFile;
  };
  system: {
    enqueueSystemEvent: EnqueueSystemEvent;
    runCommandWithTimeout: RunCommandWithTimeout;
    formatNativeDependencyHint: FormatNativeDependencyHint;
  };
  media: {
    loadWebMedia: LoadWebMedia;
    detectMime: DetectMime;
    mediaKindFromMime: MediaKindFromMime;
    isVoiceCompatibleAudio: IsVoiceCompatibleAudio;
    getImageMetadata: GetImageMetadata;
    resizeToJpeg: ResizeToJpeg;
  };
  tts: {
    textToSpeechTelephony: TextToSpeechTelephony;
  };
  tools: {
    createMemoryGetTool: CreateMemoryGetTool;
    createMemorySearchTool: CreateMemorySearchTool;
    registerMemoryCli: RegisterMemoryCli;
  };
  channel: {
    text: {
      chunkByNewline: ChunkByNewline;
      chunkMarkdownText: ChunkMarkdownText;
      chunkMarkdownTextWithMode: ChunkMarkdownTextWithMode;
      chunkText: ChunkText;
      chunkTextWithMode: ChunkTextWithMode;
      resolveChunkMode: ResolveChunkMode;
      resolveTextChunkLimit: ResolveTextChunkLimit;
      hasControlCommand: HasControlCommand;
      resolveMarkdownTableMode: ResolveMarkdownTableMode;
      convertMarkdownTables: ConvertMarkdownTables;
    };
    reply: {
      dispatchReplyWithBufferedBlockDispatcher: DispatchReplyWithBufferedBlockDispatcher;
      createReplyDispatcherWithTyping: CreateReplyDispatcherWithTyping;
      resolveEffectiveMessagesConfig: ResolveEffectiveMessagesConfig;
      resolveHumanDelayConfig: ResolveHumanDelayConfig;
      dispatchReplyFromConfig: DispatchReplyFromConfig;
      finalizeInboundContext: FinalizeInboundContext;
      formatAgentEnvelope: FormatAgentEnvelope;
      formatInboundEnvelope: FormatInboundEnvelope;
      resolveEnvelopeFormatOptions: ResolveEnvelopeFormatOptions;
    };
    routing: {
      resolveAgentRoute: ResolveAgentRoute;
    };
    pairing: {
      buildPairingReply: BuildPairingReply;
      readAllowFromStore: ReadChannelAllowFromStore;
      upsertPairingRequest: UpsertChannelPairingRequest;
    };
    media: {
      fetchRemoteMedia: FetchRemoteMedia;
      saveMediaBuffer: SaveMediaBuffer;
    };
    activity: {
      record: RecordChannelActivity;
      get: GetChannelActivity;
    };
    session: {
      resolveStorePath: ResolveStorePath;
      readSessionUpdatedAt: ReadSessionUpdatedAt;
      recordSessionMetaFromInbound: RecordSessionMetaFromInbound;
      recordInboundSession: RecordInboundSession;
      updateLastRoute: UpdateLastRoute;
    };
    mentions: {
      buildMentionRegexes: BuildMentionRegexes;
      matchesMentionPatterns: MatchesMentionPatterns;
      matchesMentionWithExplicit: MatchesMentionWithExplicit;
    };
    reactions: {
      shouldAckReaction: ShouldAckReaction;
      removeAckReactionAfterReply: RemoveAckReactionAfterReply;
    };
    groups: {
      resolveGroupPolicy: ResolveChannelGroupPolicy;
      resolveRequireMention: ResolveChannelGroupRequireMention;
    };
    debounce: {
      createInboundDebouncer: CreateInboundDebouncer;
      resolveInboundDebounceMs: ResolveInboundDebounceMs;
    };
    commands: {
      resolveCommandAuthorizedFromAuthorizers: ResolveCommandAuthorizedFromAuthorizers;
      isControlCommandMessage: IsControlCommandMessage;
      shouldComputeCommandAuthorized: ShouldComputeCommandAuthorized;
      shouldHandleTextCommands: ShouldHandleTextCommands;
    };
    discord: {
      messageActions: DiscordMessageActions;
      auditChannelPermissions: AuditDiscordChannelPermissions;
      listDirectoryGroupsLive: ListDiscordDirectoryGroupsLive;
      listDirectoryPeersLive: ListDiscordDirectoryPeersLive;
      probeDiscord: ProbeDiscord;
      resolveChannelAllowlist: ResolveDiscordChannelAllowlist;
      resolveUserAllowlist: ResolveDiscordUserAllowlist;
      sendMessageDiscord: SendMessageDiscord;
      sendPollDiscord: SendPollDiscord;
      monitorDiscordProvider: MonitorDiscordProvider;
    };
    slack: {
      listDirectoryGroupsLive: ListSlackDirectoryGroupsLive;
      listDirectoryPeersLive: ListSlackDirectoryPeersLive;
      probeSlack: ProbeSlack;
      resolveChannelAllowlist: ResolveSlackChannelAllowlist;
      resolveUserAllowlist: ResolveSlackUserAllowlist;
      sendMessageSlack: SendMessageSlack;
      monitorSlackProvider: MonitorSlackProvider;
      handleSlackAction: HandleSlackAction;
    };
    telegram: {
      auditGroupMembership: AuditTelegramGroupMembership;
      collectUnmentionedGroupIds: CollectTelegramUnmentionedGroupIds;
      probeTelegram: ProbeTelegram;
      resolveTelegramToken: ResolveTelegramToken;
      sendMessageTelegram: SendMessageTelegram;
      monitorTelegramProvider: MonitorTelegramProvider;
      messageActions: TelegramMessageActions;
    };
    signal: {
      probeSignal: ProbeSignal;
      sendMessageSignal: SendMessageSignal;
      monitorSignalProvider: MonitorSignalProvider;
      messageActions: SignalMessageActions;
    };
    imessage: {
      monitorIMessageProvider: MonitorIMessageProvider;
      probeIMessage: ProbeIMessage;
      sendMessageIMessage: SendMessageIMessage;
    };
    whatsapp: {
      getActiveWebListener: GetActiveWebListener;
      getWebAuthAgeMs: GetWebAuthAgeMs;
      logoutWeb: LogoutWeb;
      logWebSelfId: LogWebSelfId;
      readWebSelfId: ReadWebSelfId;
      webAuthExists: WebAuthExists;
      sendMessageWhatsApp: SendMessageWhatsApp;
      sendPollWhatsApp: SendPollWhatsApp;
      loginWeb: LoginWeb;
      startWebLoginWithQr: StartWebLoginWithQr;
      waitForWebLogin: WaitForWebLogin;
      monitorWebChannel: MonitorWebChannel;
      handleWhatsAppAction: HandleWhatsAppAction;
      createLoginTool: CreateWhatsAppLoginTool;
    };
    line: {
      listLineAccountIds: ListLineAccountIds;
      resolveDefaultLineAccountId: ResolveDefaultLineAccountId;
      resolveLineAccount: ResolveLineAccount;
      normalizeAccountId: NormalizeLineAccountId;
      probeLineBot: ProbeLineBot;
      sendMessageLine: SendMessageLine;
      pushMessageLine: PushMessageLine;
      pushMessagesLine: PushMessagesLine;
      pushFlexMessage: PushFlexMessage;
      pushTemplateMessage: PushTemplateMessage;
      pushLocationMessage: PushLocationMessage;
      pushTextMessageWithQuickReplies: PushTextMessageWithQuickReplies;
      createQuickReplyItems: CreateQuickReplyItems;
      buildTemplateMessageFromPayload: BuildTemplateMessageFromPayload;
      monitorLineProvider: MonitorLineProvider;
    };
  };
  logging: {
    shouldLogVerbose: ShouldLogVerbose;
    getChildLogger: (
      bindings?: Record<string, unknown>,
      opts?: { level?: LogLevel },
    ) => RuntimeLogger;
  };
  state: {
    resolveStateDir: ResolveStateDir;
  };
};
