/**
 * WeChat channel type definitions.
 */

export type WeChatChatType = "friend" | "group";

export type WeChatMessageType =
  | "text"
  | "image"
  | "video"
  | "file"
  | "voice"
  | "location"
  | "card"
  | "system";

/**
 * Inbound message from wxauto-bridge.
 */
export interface WeChatMessage {
  /** Sender identifier (wxid or group member). */
  from: string;
  /** Recipient identifier (self wxid or group id). */
  to: string;
  /** Message text content. */
  text: string;
  /** Message type. */
  type: WeChatMessageType;
  /** Chat type: friend (DM) or group. */
  chatType: WeChatChatType;
  /** Unix timestamp in milliseconds. */
  timestamp: number;
  /** Optional sender display name. */
  senderName?: string;
  /** Optional group name (for group messages). */
  groupName?: string;
  /** Optional media URL for attachments. */
  mediaUrl?: string;
  /** Optional message ID. */
  msgId?: string;
  /** Whether the message @'d the current account (for group messages). */
  isAtMe?: boolean;
}

export type DmPolicy = "pairing" | "allowlist" | "open" | "disabled";
export type GroupPolicy = "open" | "disabled" | "allowlist";

/**
 * Group-specific configuration.
 */
export interface WeChatGroupConfig {
  /** If false, disable the bot in this group. */
  enabled?: boolean;
  /** Require mentioning the bot to trigger replies. */
  requireMention?: boolean;
  /** Optional allowlist for group senders. */
  allowFrom?: Array<string | number>;
  /** Optional tool policy overrides for this group. */
  tools?: { allow?: string[]; deny?: string[] };
}

/**
 * WeChat account-specific configuration.
 */
export interface WeChatAccountConfig {
  /** Optional display name for this account. */
  name?: string;
  /** If false, do not start WeChat. Default: true. */
  enabled?: boolean;
  /** wxauto-bridge WebSocket URL. */
  bridgeUrl?: string;
  /** Authentication token for bridge connections. */
  authToken?: string;
  /** Direct message access policy (default: pairing). */
  dmPolicy?: DmPolicy;
  /** Allowlist for DM senders (wxid or nicknames). */
  allowFrom?: Array<string | number>;
  /** Group message policy (default: allowlist). */
  groupPolicy?: GroupPolicy;
  /** Allowlist for group senders. */
  groupAllowFrom?: Array<string | number>;
  /** Chat names to listen for messages. */
  listenChats?: string[];
  /** Group-specific configuration keyed by group name or id. */
  groups?: Record<string, WeChatGroupConfig>;
  /** Outbound text chunk size (chars). Default: 2000. */
  textChunkLimit?: number;
}

/**
 * WeChat channel configuration (top-level).
 */
export interface WeChatConfig extends WeChatAccountConfig {
  /** Multi-account configuration. */
  accounts?: Record<string, WeChatAccountConfig>;
}

/**
 * Resolved WeChat account with computed fields.
 */
export interface ResolvedWeChatAccount {
  /** Account identifier. */
  accountId: string;
  /** Display name. */
  name: string;
  /** Whether the account is enabled. */
  enabled: boolean;
  /** wxauto-bridge WebSocket URL. */
  bridgeUrl: string;
  /** Source of bridge URL (config, env, none). */
  bridgeUrlSource: "config" | "env" | "none";
  /** Authentication token for bridge connections. */
  authToken: string;
  /** Full configuration. */
  config: WeChatConfig;
}

/**
 * Account runtime state for status tracking.
 */
export interface WeChatAccountRuntime {
  accountId: string;
  running: boolean;
  lastStartAt: string | null;
  lastStopAt: string | null;
  lastError: string | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  wxid?: string;
  nickname?: string;
}
