/**
 * Feishu API client
 */

import type {
  FeishuApiResponse,
  FeishuSendMessageRequest,
  FeishuSendMessageResponse,
  FeishuUploadImageResponse,
  FeishuUploadFileResponse,
} from "./types.js";
import { FeishuApiError } from "./types.js";
import { getFeishuAccessToken } from "./auth.js";

/**
 * Call Feishu API with automatic token management
 */
export async function callFeishuApi<T = unknown>(
  endpoint: string,
  token: string,
  options?: {
    method?: string;
    body?: unknown;
    apiBase?: string;
    headers?: Record<string, string>;
  }
): Promise<FeishuApiResponse<T>> {
  const apiBase = options?.apiBase || "https://open.feishu.cn";
  const url = `${apiBase}/open-apis/${endpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...options?.headers,
  };

  const response = await fetch(url, {
    method: options?.method || "POST",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `Feishu API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as FeishuApiResponse<T>;

  if (data.code !== 0) {
    throw new FeishuApiError(data.msg || "Feishu API error", data.code);
  }

  return data;
}

/**
 * Send text message
 */
export async function sendFeishuTextMessage(params: {
  appId: string;
  appSecret: string;
  receiveId: string;
  text: string;
  receiveIdType?: "open_id" | "user_id" | "union_id" | "email" | "chat_id";
  apiBase?: string;
}): Promise<FeishuSendMessageResponse> {
  const {
    appId,
    appSecret,
    receiveId,
    text,
    receiveIdType = "open_id",
    apiBase,
  } = params;

  const token = await getFeishuAccessToken(appId, appSecret, apiBase);

  const requestBody: FeishuSendMessageRequest = {
    receive_id: receiveId,
    msg_type: "text",
    content: JSON.stringify({ text }),
  };

  const response = await callFeishuApi<FeishuSendMessageResponse>(
    `im/v1/messages?receive_id_type=${receiveIdType}`,
    token,
    {
      method: "POST",
      body: requestBody,
      apiBase,
    }
  );

  if (!response.data) {
    throw new Error("No data in Feishu API response");
  }

  return response.data;
}

/**
 * Upload image and get image_key
 */
export async function uploadFeishuImage(params: {
  appId: string;
  appSecret: string;
  imageBuffer: Buffer;
  apiBase?: string;
}): Promise<string> {
  const { appId, appSecret, imageBuffer, apiBase } = params;

  const token = await getFeishuAccessToken(appId, appSecret, apiBase);
  const url = `${apiBase || "https://open.feishu.cn"}/open-apis/im/v1/images`;

  const formData = new FormData();
  formData.append("image_type", "message");
  formData.append("image", new Blob([imageBuffer]), "image.png");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to upload image: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as FeishuApiResponse<
    FeishuUploadImageResponse
  >;

  if (data.code !== 0) {
    throw new FeishuApiError(data.msg || "Failed to upload image", data.code);
  }

  if (!data.data?.image_key) {
    throw new Error("No image_key in response");
  }

  return data.data.image_key;
}

/**
 * Send image message
 */
export async function sendFeishuImageMessage(params: {
  appId: string;
  appSecret: string;
  receiveId: string;
  imageKey: string;
  receiveIdType?: "open_id" | "user_id" | "union_id" | "email" | "chat_id";
  apiBase?: string;
}): Promise<FeishuSendMessageResponse> {
  const {
    appId,
    appSecret,
    receiveId,
    imageKey,
    receiveIdType = "open_id",
    apiBase,
  } = params;

  const token = await getFeishuAccessToken(appId, appSecret, apiBase);

  const requestBody: FeishuSendMessageRequest = {
    receive_id: receiveId,
    msg_type: "image",
    content: JSON.stringify({ image_key: imageKey }),
  };

  const response = await callFeishuApi<FeishuSendMessageResponse>(
    `im/v1/messages?receive_id_type=${receiveIdType}`,
    token,
    {
      method: "POST",
      body: requestBody,
      apiBase,
    }
  );

  if (!response.data) {
    throw new Error("No data in Feishu API response");
  }

  return response.data;
}

/**
 * Upload file and get file_key
 */
export async function uploadFeishuFile(params: {
  appId: string;
  appSecret: string;
  fileBuffer: Buffer;
  fileName: string;
  fileType: string;
  apiBase?: string;
}): Promise<string> {
  const { appId, appSecret, fileBuffer, fileName, fileType, apiBase } = params;

  const token = await getFeishuAccessToken(appId, appSecret, apiBase);
  const url = `${apiBase || "https://open.feishu.cn"}/open-apis/im/v1/files`;

  const formData = new FormData();
  formData.append("file_type", "stream");
  formData.append("file_name", fileName);
  formData.append("file", new Blob([fileBuffer], { type: fileType }), fileName);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to upload file: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as FeishuApiResponse<
    FeishuUploadFileResponse
  >;

  if (data.code !== 0) {
    throw new FeishuApiError(data.msg || "Failed to upload file", data.code);
  }

  if (!data.data?.file_key) {
    throw new Error("No file_key in response");
  }

  return data.data.file_key;
}

/**
 * Send file message
 */
export async function sendFeishuFileMessage(params: {
  appId: string;
  appSecret: string;
  receiveId: string;
  fileKey: string;
  receiveIdType?: "open_id" | "user_id" | "union_id" | "email" | "chat_id";
  apiBase?: string;
}): Promise<FeishuSendMessageResponse> {
  const {
    appId,
    appSecret,
    receiveId,
    fileKey,
    receiveIdType = "open_id",
    apiBase,
  } = params;

  const token = await getFeishuAccessToken(appId, appSecret, apiBase);

  const requestBody: FeishuSendMessageRequest = {
    receive_id: receiveId,
    msg_type: "file",
    content: JSON.stringify({ file_key: fileKey }),
  };

  const response = await callFeishuApi<FeishuSendMessageResponse>(
    `im/v1/messages?receive_id_type=${receiveIdType}`,
    token,
    {
      method: "POST",
      body: requestBody,
      apiBase,
    }
  );

  if (!response.data) {
    throw new Error("No data in Feishu API response");
  }

  return response.data;
}

/**
 * Reply to a message
 */
export async function replyFeishuMessage(params: {
  appId: string;
  appSecret: string;
  messageId: string;
  text: string;
  apiBase?: string;
}): Promise<FeishuSendMessageResponse> {
  const { appId, appSecret, messageId, text, apiBase } = params;

  const token = await getFeishuAccessToken(appId, appSecret, apiBase);

  const requestBody = {
    msg_type: "text",
    content: JSON.stringify({ text }),
  };

  const response = await callFeishuApi<FeishuSendMessageResponse>(
    `im/v1/messages/${messageId}/reply`,
    token,
    {
      method: "POST",
      body: requestBody,
      apiBase,
    }
  );

  if (!response.data) {
    throw new Error("No data in Feishu API response");
  }

  return response.data;
}

/**
 * Probe Feishu connection by testing token retrieval
 */
export async function probeFeishu(params: {
  appId: string;
  appSecret: string;
  apiBase?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await getFeishuAccessToken(params.appId, params.appSecret, params.apiBase);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
