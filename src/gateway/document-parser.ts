/**
 * 文档文本提取模块
 *
 * 支持从 PDF、DOCX、DOC 等二进制文档格式中提取纯文本内容。
 * 提取的文本用于注入 LLM 消息，使 AI 能够阅读文档内容。
 *
 * 支持的格式：
 * - PDF：使用 pdf-parse 库解析
 * - DOCX：使用 mammoth 库解析
 * - DOC：基于二进制文本提取（有限支持）
 */

/** 文档解析结果 */
export interface DocumentParseResult {
  /** 提取的纯文本内容 */
  text: string;
  /** 文档页数（仅 PDF 可用） */
  pages?: number;
  /** 解析是否成功（false 时 text 为错误提示） */
  ok: boolean;
}

/** 解码后文本内容最大字符数（约 100KB，与 chat-attachments 保持一致） */
const MAX_TEXT_CHARS = 100_000;

/**
 * 从 PDF 文件的 base64 数据中提取文本
 *
 * 使用 pdf-parse 库进行结构化文本提取，能正确处理多页文档。
 * 对于扫描版 PDF（纯图片），返回提示信息。
 *
 * @param base64Data - PDF 文件的 base64 编码数据
 * @param fileName - 文件名，用于错误提示
 * @returns 解析结果
 */
export async function extractTextFromPdf(
  base64Data: string,
  fileName: string,
): Promise<DocumentParseResult> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const buffer = Buffer.from(base64Data, "base64");
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      const text = result.text?.trim() ?? "";
      const pages = result.total ?? 0;

      if (!text) {
        console.log(
          `[document-parser] PDF "${fileName}" 解析成功但无文本内容（可能是扫描版 PDF），pages=${pages}`,
        );
        return {
          text: `[PDF file: ${fileName} - 此 PDF 不包含可提取的文本（可能是扫描版图片 PDF）]`,
          pages,
          ok: false,
        };
      }

      const truncated = truncateText(text, fileName);
      console.log(
        `[document-parser] PDF "${fileName}" 解析成功: pages=${pages}, chars=${text.length}, truncated=${truncated.length !== text.length}`,
      );

      return {
        text: truncated,
        pages,
        ok: true,
      };
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    console.error(`[document-parser] PDF "${fileName}" 解析失败:`, err);
    return {
      text: `[PDF file: ${fileName} - 文本提取失败: ${String(err)}]`,
      ok: false,
    };
  }
}

/**
 * 从 DOCX 文件的 base64 数据中提取文本
 *
 * 使用 mammoth 库将 DOCX 转换为纯文本。mammoth 擅长提取结构化内容，
 * 包括段落、列表、表格等。
 *
 * @param base64Data - DOCX 文件的 base64 编码数据
 * @param fileName - 文件名，用于错误提示
 * @returns 解析结果
 */
export async function extractTextFromDocx(
  base64Data: string,
  fileName: string,
): Promise<DocumentParseResult> {
  try {
    const mammoth = await import("mammoth");
    const extractRawText = mammoth.extractRawText ?? mammoth.default?.extractRawText;
    if (!extractRawText) {
      throw new Error("mammoth.extractRawText not found");
    }
    const buffer = Buffer.from(base64Data, "base64");
    const result = await extractRawText({ buffer });

    const text = result.value?.trim() ?? "";

    if (!text) {
      console.log(`[document-parser] DOCX "${fileName}" 解析成功但无文本内容`);
      return {
        text: `[DOCX file: ${fileName} - 此文档不包含可提取的文本内容]`,
        ok: false,
      };
    }

    const truncated = truncateText(text, fileName);
    console.log(
      `[document-parser] DOCX "${fileName}" 解析成功: chars=${text.length}, truncated=${truncated.length !== text.length}`,
    );

    return {
      text: truncated,
      ok: true,
    };
  } catch (err) {
    console.error(`[document-parser] DOCX "${fileName}" 解析失败:`, err);
    return {
      text: `[DOCX file: ${fileName} - 文本提取失败: ${String(err)}]`,
      ok: false,
    };
  }
}

/**
 * 从 DOC（旧版 Word）文件的 base64 数据中提取文本
 *
 * DOC 是 Microsoft 的二进制格式（OLE2），没有轻量级的 Node.js 解析库。
 * 使用启发式方法从二进制数据中提取可见文本：
 * 1. 搜索 Unicode (UTF-16LE) 文本段落
 * 2. 搜索 ASCII 文本段落
 * 3. 过滤控制字符和二进制噪声
 *
 * 注意：此方法为最佳努力（best-effort），无法保证完整提取所有内容。
 *
 * @param base64Data - DOC 文件的 base64 编码数据
 * @param fileName - 文件名，用于错误提示
 * @returns 解析结果
 */
export async function extractTextFromDoc(
  base64Data: string,
  fileName: string,
): Promise<DocumentParseResult> {
  try {
    const buffer = Buffer.from(base64Data, "base64");

    // 验证 DOC 文件魔数（OLE2 Compound Document: D0 CF 11 E0 A1 B1 1A E1）
    const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(OLE2_MAGIC)) {
      console.log(`[document-parser] DOC "${fileName}" 不是有效的 OLE2 格式`);
      return {
        text: `[DOC file: ${fileName} - 不是有效的 Word 文档格式]`,
        ok: false,
      };
    }

    // 从二进制数据中提取文本
    const text = extractTextFromBinaryDoc(buffer);

    if (!text) {
      console.log(`[document-parser] DOC "${fileName}" 无法提取文本内容`);
      return {
        text: `[DOC file: ${fileName} - 无法提取文本内容，建议转换为 DOCX 格式后重试]`,
        ok: false,
      };
    }

    const truncated = truncateText(text, fileName);
    console.log(
      `[document-parser] DOC "${fileName}" 解析成功: chars=${text.length}, truncated=${truncated.length !== text.length}`,
    );

    return {
      text: truncated,
      ok: true,
    };
  } catch (err) {
    console.error(`[document-parser] DOC "${fileName}" 解析失败:`, err);
    return {
      text: `[DOC file: ${fileName} - 文本提取失败: ${String(err)}]`,
      ok: false,
    };
  }
}

/**
 * 根据 MIME 类型自动选择合适的解析器提取文档文本
 *
 * @param base64Data - 文件的 base64 编码数据
 * @param fileName - 文件名
 * @param mimeType - MIME 类型
 * @returns 解析结果
 */
export async function extractDocumentText(
  base64Data: string,
  fileName: string,
  mimeType: string,
): Promise<DocumentParseResult> {
  console.log(
    `[document-parser] 开始解析文档: fileName="${fileName}", mimeType="${mimeType}", dataLen=${base64Data.length}`,
  );

  switch (mimeType) {
    case "application/pdf":
      return extractTextFromPdf(base64Data, fileName);

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractTextFromDocx(base64Data, fileName);

    case "application/msword":
      return extractTextFromDoc(base64Data, fileName);

    default:
      console.log(`[document-parser] 不支持的文档类型: ${mimeType}`);
      return {
        text: `[Document: ${fileName} - 不支持的文档格式 (${mimeType})]`,
        ok: false,
      };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * 从 OLE2 二进制 DOC 文件中启发式提取文本
 *
 * 策略：
 * 1. 尝试 UTF-16LE 解码（Word 文档内部通常使用 UTF-16LE 存储文本）
 * 2. 提取连续的可打印字符段落
 * 3. 过滤过短的片段和二进制噪声
 */
function extractTextFromBinaryDoc(buffer: Buffer): string {
  const chunks: string[] = [];

  // 策略 1: 搜索 UTF-16LE 编码的文本段落
  // Word DOC 在 "WordDocument" stream 中使用 UTF-16LE
  const utf16Chunks = extractUtf16LeChunks(buffer);
  if (utf16Chunks.length > 0) {
    chunks.push(...utf16Chunks);
  }

  // 策略 2: 搜索 ASCII/Latin-1 文本段落（作为回退）
  if (chunks.length === 0) {
    const asciiChunks = extractAsciiChunks(buffer);
    chunks.push(...asciiChunks);
  }

  if (chunks.length === 0) {
    return "";
  }

  // 合并文本段落，去除重复和噪声
  // 过滤过短片段：OLE2 文件头等结构数据可能偶尔产生 4-9 个 "字符" 的噪声
  const text = chunks
    .filter((chunk) => chunk.length >= 10) // 过滤短片段和结构噪声
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // 压缩多余空行
    .trim();

  return text;
}

/**
 * 从缓冲区中提取 UTF-16LE 编码的文本段落
 */
function extractUtf16LeChunks(buffer: Buffer): string[] {
  const chunks: string[] = [];
  let start = -1;

  for (let i = 0; i < buffer.length - 1; i += 2) {
    const code = buffer[i]! | (buffer[i + 1]! << 8);
    const isPrintable =
      (code >= 0x20 && code < 0x7f) || // ASCII 可打印
      (code >= 0xa0 && code <= 0xffff) || // 扩展字符（含中文等 CJK）
      code === 0x09 || // Tab
      code === 0x0a || // LF
      code === 0x0d; // CR

    if (isPrintable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1 && i - start >= 8) {
        // 至少 4 个 UTF-16LE 字符
        const text = buffer.subarray(start, i).toString("utf16le").trim();
        if (text.length >= 4) {
          chunks.push(text);
        }
      }
      start = -1;
    }
  }

  // 处理末尾的文本段
  if (start !== -1 && buffer.length - start >= 8) {
    const text = buffer.subarray(start, buffer.length).toString("utf16le").trim();
    if (text.length >= 4) {
      chunks.push(text);
    }
  }

  return chunks;
}

/**
 * 从缓冲区中提取 ASCII 文本段落
 */
function extractAsciiChunks(buffer: Buffer): string[] {
  const chunks: string[] = [];
  let start = -1;

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i]!;
    const isPrintable =
      (byte >= 0x20 && byte < 0x7f) || // ASCII 可打印
      byte === 0x09 || // Tab
      byte === 0x0a || // LF
      byte === 0x0d; // CR

    if (isPrintable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1 && i - start >= 8) {
        const text = buffer.subarray(start, i).toString("ascii").trim();
        if (text.length >= 4) {
          chunks.push(text);
        }
      }
      start = -1;
    }
  }

  // 处理末尾的文本段
  if (start !== -1 && buffer.length - start >= 8) {
    const text = buffer.subarray(start, buffer.length).toString("ascii").trim();
    if (text.length >= 4) {
      chunks.push(text);
    }
  }

  return chunks;
}

/**
 * 截断过长的文本内容
 */
function truncateText(text: string, fileName: string): string {
  if (text.length <= MAX_TEXT_CHARS) {
    return text;
  }
  console.log(
    `[document-parser] "${fileName}" 文本过长 (${text.length} chars), 截断至 ${MAX_TEXT_CHARS}`,
  );
  return text.slice(0, MAX_TEXT_CHARS) + `\n\n[... truncated at ${MAX_TEXT_CHARS} characters]`;
}
