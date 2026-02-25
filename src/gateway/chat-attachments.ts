import { detectMime } from "../media/mime.js";
import { extractDocumentText } from "./document-parser.js";

export type ChatAttachment = {
  type?: string;
  mimeType?: string;
  fileName?: string;
  content?: unknown;
};

export type ChatImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};

/** 文件附件的解码文本内容 */
export type FileTextContent = {
  fileName: string;
  content: string;
  mimeType: string;
};

export type ParsedMessageWithAttachments = {
  message: string;
  images: ChatImageContent[];
  /** 非图片附件的文本内容（已从 base64 解码） */
  fileTexts: FileTextContent[];
};

type AttachmentLog = {
  warn: (message: string) => void;
};

function normalizeMime(mime?: string): string | undefined {
  if (!mime) {
    return undefined;
  }
  const cleaned = mime.split(";")[0]?.trim().toLowerCase();
  return cleaned || undefined;
}

async function sniffMimeFromBase64(base64: string): Promise<string | undefined> {
  const trimmed = base64.trim();
  if (!trimmed) {
    return undefined;
  }

  const take = Math.min(256, trimmed.length);
  const sliceLen = take - (take % 4);
  if (sliceLen < 8) {
    return undefined;
  }

  try {
    const head = Buffer.from(trimmed.slice(0, sliceLen), "base64");
    return await detectMime({ buffer: head });
  } catch {
    return undefined;
  }
}

function isImageMime(mime?: string): boolean {
  return typeof mime === "string" && mime.startsWith("image/");
}

/** 可解码为 UTF-8 文本的 MIME 类型集合（不含 text/html，因为 HTML 含脚本可导致 XSS） */
const TEXT_DECODABLE_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/xml",
  "application/json",
  "application/xml",
]);

/** 需要专用解析器提取文本的文档 MIME 类型 */
const DOCUMENT_PARSEABLE_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc
]);

/**
 * 判断 MIME 类型是否可解码为文本内容。
 * 包括所有 text/* 类型和部分 application/* 类型（如 JSON、XML）。
 */
function isTextDecodableMime(mime?: string): boolean {
  if (!mime) return false;
  if (mime.startsWith("text/")) return true;
  return TEXT_DECODABLE_MIMES.has(mime);
}

/**
 * 判断 MIME 类型是否为可解析的文档格式（PDF、DOCX、DOC）。
 */
function isDocumentMime(mime?: string): boolean {
  if (!mime) return false;
  return DOCUMENT_PARSEABLE_MIMES.has(mime);
}

/** 解码后文本内容最大字符数（约 100KB，避免撑爆 LLM context window） */
const MAX_TEXT_CONTENT_CHARS = 100_000;

/**
 * 转义 XML 属性值中的特殊字符，防止 fileName/mimeType 注入。
 */
function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 将 fileTexts 格式化为 <attachment> XML 块，用于注入 LLM 消息。
 * fileName 和 mimeType 经过 XML 转义，防止注入。
 */
export function formatFileTextsAsAttachmentBlocks(fileTexts: FileTextContent[]): string {
  return fileTexts
    .map(
      (f) =>
        `<attachment name="${escapeXmlAttr(f.fileName)}" type="${escapeXmlAttr(f.mimeType)}">\n${f.content}\n</attachment>`,
    )
    .join("\n\n");
}

/**
 * 每个分片的最大字符数（约 12K 字符，为 LLM context 留充足空间）。
 * 选择 12K 是因为：一般 LLM 的有效 context 约 8K-128K tokens，
 * 12K 字符约等于 3K-4K tokens，留出空间给系统提示词、历史对话和回复。
 */
const CHUNK_MAX_CHARS = 12_000;

/** 分片结果 */
export interface ChunkedAttachmentResult {
  /** 第一片（合并到当前消息发送） */
  firstChunk: string;
  /** 后续分片（需要入队自动续发） */
  remainingChunks: string[];
  /** 总分片数 */
  totalChunks: number;
  /** 原始文件名 */
  fileName: string;
}

/**
 * 将附件文本内容分片。
 *
 * 如果 fileTexts 格式化后的总长度超过 CHUNK_MAX_CHARS，
 * 按段落/行边界智能切分为多个分片。
 * 每个分片都带有 `[文档分片 N/M]` 前缀标记。
 *
 * @returns 如果不需要分片，返回 null；需要分片时返回分片结果
 */
export function chunkAttachmentText(
  fileTexts: FileTextContent[],
  userMessage: string,
  maxChars: number = CHUNK_MAX_CHARS,
): ChunkedAttachmentResult | null {
  const fullText = formatFileTextsAsAttachmentBlocks(fileTexts);
  const totalLen = userMessage.length + fullText.length;

  // 不需要分片
  if (totalLen <= maxChars) {
    return null;
  }

  // 获取主文件名（用于分片标记）
  const fileName = fileTexts[0]?.fileName ?? "document";

  // 按行切分文本
  const lines = fullText.split("\n");
  const chunks: string[] = [];
  let currentChunk = "";

  for (const line of lines) {
    // 如果加上这行会超出限制，先保存当前 chunk
    if (currentChunk.length + line.length + 1 > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = "";
    }

    // 如果单行超过限制，强制按字符切分
    if (line.length > maxChars) {
      let remaining = line;
      while (remaining.length > 0) {
        const space = maxChars - currentChunk.length - 1;
        if (space <= 0) {
          chunks.push(currentChunk);
          currentChunk = "";
          continue;
        }
        currentChunk += (currentChunk ? "\n" : "") + remaining.slice(0, space);
        remaining = remaining.slice(space);
        if (currentChunk.length >= maxChars) {
          chunks.push(currentChunk);
          currentChunk = "";
        }
      }
    } else {
      currentChunk += (currentChunk ? "\n" : "") + line;
    }
  }

  // 保存最后一个 chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  if (chunks.length <= 1) {
    return null;
  }

  const totalChunks = chunks.length;

  // 给每个分片加上标记
  const labeledChunks = chunks.map(
    (chunk, i) => `[文档分片 ${i + 1}/${totalChunks}: ${fileName}]\n\n${chunk}`,
  );

  return {
    firstChunk: labeledChunks[0]!,
    remainingChunks: labeledChunks.slice(1),
    totalChunks,
    fileName,
  };
}

/**
 * 解析附件，提取图片为结构化内容块，文本类文件解码为 UTF-8 文本。
 *
 * - 图片附件 → ChatImageContent（传递给 LLM vision API）
 * - 文本类附件（txt/md/csv/json/code 等）→ FileTextContent（解码 base64 为 UTF-8）
 * - 不支持的二进制附件（如 zip/exe）→ 跳过并记录警告
 */
export async function parseMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: { maxBytes?: number; log?: AttachmentLog },
): Promise<ParsedMessageWithAttachments> {
  const maxBytes = opts?.maxBytes ?? 5_000_000; // 5 MB
  const log = opts?.log;
  if (!attachments || attachments.length === 0) {
    return { message, images: [], fileTexts: [] };
  }

  const images: ChatImageContent[] = [];
  const fileTexts: FileTextContent[] = [];

  for (const [idx, att] of attachments.entries()) {
    if (!att) {
      continue;
    }
    const mime = att.mimeType ?? "";
    const content = att.content;
    const label = att.fileName || att.type || `attachment-${idx + 1}`;

    if (typeof content !== "string") {
      throw new Error(`attachment ${label}: content must be base64 string`);
    }

    let b64 = content.trim();
    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,...")
    const dataUrlMatch = /^data:[^;]+;base64,(.*)$/.exec(b64);
    if (dataUrlMatch) {
      b64 = dataUrlMatch[1];
    }
    // Basic base64 sanity: length multiple of 4 and charset check.
    if (b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64)) {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    let sizeBytes = 0;
    try {
      sizeBytes = Buffer.from(b64, "base64").byteLength;
    } catch {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    if (sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new Error(`attachment ${label}: exceeds size limit (${sizeBytes} > ${maxBytes} bytes)`);
    }

    const providedMime = normalizeMime(mime);
    const sniffedMime = normalizeMime(await sniffMimeFromBase64(b64));
    const effectiveMime = sniffedMime ?? providedMime ?? mime;

    // 优先尝试作为图片处理
    if (isImageMime(sniffedMime) || (!sniffedMime && isImageMime(providedMime))) {
      if (sniffedMime && providedMime && sniffedMime !== providedMime) {
        log?.warn(
          `attachment ${label}: mime mismatch (${providedMime} -> ${sniffedMime}), using sniffed`,
        );
      }
      images.push({
        type: "image",
        data: b64,
        mimeType: effectiveMime,
      });
      continue;
    }

    // 尝试作为文本文件处理
    if (isTextDecodableMime(providedMime)) {
      try {
        let decoded = Buffer.from(b64, "base64").toString("utf-8");
        if (decoded.length > MAX_TEXT_CONTENT_CHARS) {
          log?.warn(
            `attachment ${label}: text content too large (${decoded.length} chars), truncating to ${MAX_TEXT_CONTENT_CHARS}`,
          );
          decoded =
            decoded.slice(0, MAX_TEXT_CONTENT_CHARS) +
            `\n\n[... truncated at ${MAX_TEXT_CONTENT_CHARS} characters]`;
        }
        fileTexts.push({
          fileName: label,
          content: decoded,
          mimeType: providedMime ?? mime,
        });
        continue;
      } catch {
        log?.warn(`attachment ${label}: failed to decode as UTF-8 text, dropping`);
        continue;
      }
    }

    // 文档类型（PDF、DOCX、DOC）：使用专用解析器提取文本
    if (isDocumentMime(effectiveMime) || isDocumentMime(providedMime)) {
      const docMime = isDocumentMime(effectiveMime) ? effectiveMime : providedMime!;
      try {
        const result = await extractDocumentText(b64, label, docMime);
        console.log(
          `[chat-attachments] 文档解析完成: ${label}, ok=${result.ok}, textLen=${result.text.length}`,
        );
        fileTexts.push({
          fileName: label,
          content: result.text,
          mimeType: docMime,
        });
      } catch (err) {
        log?.warn(`attachment ${label}: document parsing failed: ${String(err)}`);
        fileTexts.push({
          fileName: label,
          content: `[Document: ${label} - 文本提取失败: ${String(err)}]`,
          mimeType: docMime,
        });
      }
      continue;
    }

    // 不支持的二进制类型
    log?.warn(`attachment ${label}: unsupported file type (${effectiveMime}), dropping`);
  }

  return { message, images, fileTexts };
}

/**
 * @deprecated Use parseMessageWithAttachments instead.
 * This function converts images to markdown data URLs which Claude API cannot process as images.
 */
export function buildMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: { maxBytes?: number },
): string {
  const maxBytes = opts?.maxBytes ?? 2_000_000; // 2 MB
  if (!attachments || attachments.length === 0) {
    return message;
  }

  const blocks: string[] = [];

  for (const [idx, att] of attachments.entries()) {
    if (!att) {
      continue;
    }
    const mime = att.mimeType ?? "";
    const content = att.content;
    const label = att.fileName || att.type || `attachment-${idx + 1}`;

    if (typeof content !== "string") {
      throw new Error(`attachment ${label}: content must be base64 string`);
    }
    if (!mime.startsWith("image/")) {
      throw new Error(`attachment ${label}: only image/* supported`);
    }

    let sizeBytes = 0;
    const b64 = content.trim();
    // Basic base64 sanity: length multiple of 4 and charset check.
    if (b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64)) {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    try {
      sizeBytes = Buffer.from(b64, "base64").byteLength;
    } catch {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    if (sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new Error(`attachment ${label}: exceeds size limit (${sizeBytes} > ${maxBytes} bytes)`);
    }

    const safeLabel = label.replace(/\s+/g, "_");
    const dataUrl = `![${safeLabel}](data:${mime};base64,${content})`;
    blocks.push(dataUrl);
  }

  if (blocks.length === 0) {
    return message;
  }
  const separator = message.trim().length > 0 ? "\n\n" : "";
  return `${message}${separator}${blocks.join("\n\n")}`;
}
