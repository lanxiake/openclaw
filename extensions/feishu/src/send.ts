/**
 * Feishu message sending module
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { FeishuSendOptions, FeishuSendResult } from "./types.js";
import { resolveFeishuAccount } from "./accounts.js";
import {
  sendFeishuTextMessage,
  sendFeishuImageMessage,
  sendFeishuFileMessage,
  uploadFeishuImage,
  uploadFeishuFile,
  replyFeishuMessage,
} from "./api.js";

/**
 * Resolve send context from options
 */
function resolveSendContext(options: FeishuSendOptions): {
  appId: string;
  appSecret: string;
  apiBase?: string;
  receiveIdType: "open_id" | "user_id" | "union_id" | "email" | "chat_id";
} {
  if (options.cfg) {
    const account = resolveFeishuAccount({
      cfg: options.cfg,
      accountId: options.accountId,
    });

    const appId = options.appId || account.appId || "";
    const appSecret = options.appSecret || account.appSecret || "";
    const apiBase = options.apiBase || account.config.apiBase;

    return {
      appId,
      appSecret,
      apiBase,
      receiveIdType: options.receiveIdType || "open_id",
    };
  }

  // Fallback to environment variables
  const appId =
    options.appId || process.env.FEISHU_APP_ID || "";
  const appSecret =
    options.appSecret || process.env.FEISHU_APP_SECRET || "";
  const apiBase = options.apiBase;

  return {
    appId,
    appSecret,
    apiBase,
    receiveIdType: options.receiveIdType || "open_id",
  };
}

/**
 * Send text message to Feishu
 */
export async function sendFeishuMessage(
  receiveId: string,
  text: string,
  options: FeishuSendOptions = {}
): Promise<FeishuSendResult> {
  const { appId, appSecret, apiBase, receiveIdType } =
    resolveSendContext(options);

  if (!appId || !appSecret) {
    return {
      ok: false,
      error: "Feishu credentials not configured (appId and appSecret required)",
    };
  }

  if (!receiveId?.trim()) {
    return { ok: false, error: "No receive_id provided" };
  }

  if (!text?.trim()) {
    return { ok: false, error: "No text provided" };
  }

  try {
    const response = await sendFeishuTextMessage({
      appId,
      appSecret,
      receiveId: receiveId.trim(),
      text: text.trim(),
      receiveIdType,
      apiBase,
    });

    return {
      ok: true,
      messageId: response.message_id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send image message to Feishu
 */
export async function sendFeishuImage(
  receiveId: string,
  imageBuffer: Buffer,
  options: FeishuSendOptions = {}
): Promise<FeishuSendResult> {
  const { appId, appSecret, apiBase, receiveIdType } =
    resolveSendContext(options);

  if (!appId || !appSecret) {
    return {
      ok: false,
      error: "Feishu credentials not configured (appId and appSecret required)",
    };
  }

  if (!receiveId?.trim()) {
    return { ok: false, error: "No receive_id provided" };
  }

  if (!imageBuffer || imageBuffer.length === 0) {
    return { ok: false, error: "No image data provided" };
  }

  try {
    // Step 1: Upload image to get image_key
    const imageKey = await uploadFeishuImage({
      appId,
      appSecret,
      imageBuffer,
      apiBase,
    });

    // Step 2: Send image message
    const response = await sendFeishuImageMessage({
      appId,
      appSecret,
      receiveId: receiveId.trim(),
      imageKey,
      receiveIdType,
      apiBase,
    });

    return {
      ok: true,
      messageId: response.message_id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send file message to Feishu
 */
export async function sendFeishuFile(
  receiveId: string,
  fileBuffer: Buffer,
  fileName: string,
  fileType: string,
  options: FeishuSendOptions = {}
): Promise<FeishuSendResult> {
  const { appId, appSecret, apiBase, receiveIdType } =
    resolveSendContext(options);

  if (!appId || !appSecret) {
    return {
      ok: false,
      error: "Feishu credentials not configured (appId and appSecret required)",
    };
  }

  if (!receiveId?.trim()) {
    return { ok: false, error: "No receive_id provided" };
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    return { ok: false, error: "No file data provided" };
  }

  if (!fileName?.trim()) {
    return { ok: false, error: "No file name provided" };
  }

  try {
    // Step 1: Upload file to get file_key
    const fileKey = await uploadFeishuFile({
      appId,
      appSecret,
      fileBuffer,
      fileName: fileName.trim(),
      fileType: fileType || "application/octet-stream",
      apiBase,
    });

    // Step 2: Send file message
    const response = await sendFeishuFileMessage({
      appId,
      appSecret,
      receiveId: receiveId.trim(),
      fileKey,
      receiveIdType,
      apiBase,
    });

    return {
      ok: true,
      messageId: response.message_id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Reply to a Feishu message
 */
export async function replyFeishuMessageById(
  messageId: string,
  text: string,
  options: FeishuSendOptions = {}
): Promise<FeishuSendResult> {
  const { appId, appSecret, apiBase } = resolveSendContext(options);

  if (!appId || !appSecret) {
    return {
      ok: false,
      error: "Feishu credentials not configured (appId and appSecret required)",
    };
  }

  if (!messageId?.trim()) {
    return { ok: false, error: "No message_id provided" };
  }

  if (!text?.trim()) {
    return { ok: false, error: "No text provided" };
  }

  try {
    const response = await replyFeishuMessage({
      appId,
      appSecret,
      messageId: messageId.trim(),
      text: text.trim(),
      apiBase,
    });

    return {
      ok: true,
      messageId: response.message_id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Chunk text message if it exceeds the limit
 * Feishu doesn't have a strict documented limit, but we use 4000 characters as a safe limit
 */
export function chunkFeishuMessage(text: string, maxLength = 4000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = "";

  const lines = text.split("\n");

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 <= maxLength) {
      currentChunk += (currentChunk ? "\n" : "") + line;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      if (line.length <= maxLength) {
        currentChunk = line;
      } else {
        // Split long line into smaller chunks
        let remaining = line;
        while (remaining.length > 0) {
          chunks.push(remaining.slice(0, maxLength));
          remaining = remaining.slice(maxLength);
        }
        currentChunk = "";
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
