/**
 * Feishu/Lark channel plugin type definitions
 */

import type { z } from "zod";
import type { FeishuConfigSchema } from "./config-schema.js";

export type FeishuConfig = z.infer<typeof FeishuConfigSchema>;

export type FeishuAccountConfig = Omit<
  FeishuConfig,
  "accounts" | "defaultAccount"
>;

/**
 * Resolved Feishu account with credentials
 */
export type ResolvedFeishuAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  config: FeishuAccountConfig;
  appId?: string;
  appSecret?: string;
  verificationToken?: string;
  encryptKey?: string;
  credentialSource: "config" | "env" | "none";
};

/**
 * Feishu API response wrapper
 */
export type FeishuApiResponse<T = unknown> = {
  code: number;
  msg: string;
  data?: T;
};

/**
 * Feishu webhook payload types
 */
export type FeishuWebhookPayload =
  | FeishuUrlVerificationPayload
  | FeishuEventPayload;

export type FeishuUrlVerificationPayload = {
  challenge: string;
  token: string;
  type: "url_verification";
};

export type FeishuEventPayload = {
  schema: string;
  header: {
    event_id: string;
    event_type: string;
    create_time: string;
    token: string;
    app_id: string;
    tenant_key: string;
  };
  event: FeishuMessageEvent | Record<string, unknown>;
};

/**
 * Feishu message event
 */
export type FeishuMessageEvent = {
  sender: {
    sender_id: {
      union_id?: string;
      user_id?: string;
      open_id?: string;
    };
    sender_type: string;
    tenant_key: string;
  };
  message: {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    create_time: string;
    chat_id: string;
    chat_type: "p2p" | "group";
    message_type: "text" | "post" | "image" | "file" | "audio" | "media";
    content: string;
  };
};

/**
 * Feishu message content types
 */
export type FeishuTextContent = {
  text: string;
};

export type FeishuImageContent = {
  image_key: string;
};

export type FeishuFileContent = {
  file_key: string;
};

/**
 * Feishu send message request
 */
export type FeishuSendMessageRequest = {
  receive_id: string;
  msg_type: "text" | "image" | "file" | "post";
  content: string;
};

/**
 * Feishu send message response
 */
export type FeishuSendMessageResponse = {
  message_id: string;
  root_id?: string;
  parent_id?: string;
  msg_type: string;
  create_time: string;
  update_time: string;
  deleted: boolean;
  updated: boolean;
  chat_id: string;
  sender: {
    id: string;
    id_type: string;
    sender_type: string;
    tenant_key: string;
  };
  body: {
    content: string;
  };
};

/**
 * Feishu upload image response
 */
export type FeishuUploadImageResponse = {
  image_key: string;
};

/**
 * Feishu upload file response
 */
export type FeishuUploadFileResponse = {
  file_key: string;
};

/**
 * Feishu tenant access token response
 */
export type FeishuTenantAccessTokenResponse = {
  tenant_access_token: string;
  expire: number;
};

/**
 * Feishu send options
 */
export type FeishuSendOptions = {
  accountId?: string;
  appId?: string;
  appSecret?: string;
  apiBase?: string;
  receiveIdType?: "open_id" | "user_id" | "union_id" | "email" | "chat_id";
};

/**
 * Feishu send result
 */
export type FeishuSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Feishu API error
 */
export class FeishuApiError extends Error {
  constructor(
    message: string,
    public code: number
  ) {
    super(message);
    this.name = "FeishuApiError";
  }
}
