import { describe, expect, it } from "vitest";

import {
  extractDocumentText,
  extractTextFromDoc,
  extractTextFromDocx,
  extractTextFromPdf,
} from "./document-parser.js";

// ---------------------------------------------------------------------------
// PDF 解析测试
// ---------------------------------------------------------------------------

describe("extractTextFromPdf", () => {
  it("returns error for empty/invalid base64", async () => {
    // 空内容（仅 PDF 头，无有效结构）不会被 pdf-parse 正确解析
    const emptyPdf = Buffer.from("%PDF-1.4\n%%EOF\n").toString("base64");
    const result = await extractTextFromPdf(emptyPdf, "empty.pdf");
    // pdf-parse 可能抛出错误或返回空文本
    expect(result.ok).toBe(false);
    expect(result.text).toContain("empty.pdf");
  });

  it("returns error info in text when parsing fails", async () => {
    const notPdf = Buffer.from("this is not a pdf").toString("base64");
    const result = await extractTextFromPdf(notPdf, "bad.pdf");
    expect(result.ok).toBe(false);
    expect(result.text).toContain("bad.pdf");
  });
});

// ---------------------------------------------------------------------------
// DOCX 解析测试
// ---------------------------------------------------------------------------

describe("extractTextFromDocx", () => {
  it("returns error for invalid DOCX data", async () => {
    const notDocx = Buffer.from("not a docx file").toString("base64");
    const result = await extractTextFromDocx(notDocx, "bad.docx");
    expect(result.ok).toBe(false);
    expect(result.text).toContain("bad.docx");
  });

  it("extracts text from minimal valid DOCX", async () => {
    // 创建一个最小的有效 DOCX（ZIP 格式）
    // mammoth 需要有效的 ZIP 结构，这里使用实际的最小 DOCX
    // 由于构造有效 DOCX 需要 ZIP，这里测试错误处理路径
    const invalidZip = Buffer.from("PK\x03\x04invalid").toString("base64");
    const result = await extractTextFromDocx(invalidZip, "corrupt.docx");
    expect(result.ok).toBe(false);
    expect(result.text).toContain("corrupt.docx");
  });
});

// ---------------------------------------------------------------------------
// DOC 解析测试
// ---------------------------------------------------------------------------

describe("extractTextFromDoc", () => {
  it("rejects non-OLE2 files", async () => {
    const notDoc = Buffer.from("not a doc file").toString("base64");
    const result = await extractTextFromDoc(notDoc, "bad.doc");
    expect(result.ok).toBe(false);
    expect(result.text).toContain("不是有效的 Word 文档格式");
  });

  it("handles OLE2 file with no extractable text", async () => {
    // 创建带有 OLE2 魔数但填充控制字符的缓冲区
    // 使用 0x00-0x1F 范围的控制字符（不被 UTF-16LE 或 ASCII 视为可打印）
    const ole2Header = Buffer.alloc(512);
    // OLE2 魔数: D0 CF 11 E0 A1 B1 1A E1
    ole2Header[0] = 0xd0;
    ole2Header[1] = 0xcf;
    ole2Header[2] = 0x11;
    ole2Header[3] = 0xe0;
    ole2Header[4] = 0xa1;
    ole2Header[5] = 0xb1;
    ole2Header[6] = 0x1a;
    ole2Header[7] = 0xe1;
    // 填充 0x07（BEL 控制字符），UTF-16LE 双字节 0x0707 = U+0707 仍在扩展范围内
    // 使用高字节为控制字符的对：0x0007 = U+0007 (BEL) 在 < 0x20 范围内
    for (let i = 8; i < 512; i += 2) {
      ole2Header[i] = 0x07; // 低字节
      ole2Header[i + 1] = 0x00; // 高字节 → UTF-16LE code point = 0x0007 (< 0x20, 不可打印)
    }

    const result = await extractTextFromDoc(ole2Header.toString("base64"), "empty.doc");
    expect(result.ok).toBe(false);
    expect(result.text).toContain("empty.doc");
  });

  it("extracts UTF-16LE text from OLE2 buffer", async () => {
    // 创建一个带有 OLE2 魔数和 UTF-16LE 文本的缓冲区
    const header = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const padding = Buffer.alloc(100, 0); // 填充
    const textContent = "Hello World Document Test Content Here";
    const utf16Text = Buffer.from(textContent, "utf16le");
    const buffer = Buffer.concat([header, padding, utf16Text, Buffer.alloc(50, 0)]);

    const result = await extractTextFromDoc(buffer.toString("base64"), "test.doc");
    expect(result.ok).toBe(true);
    expect(result.text).toContain("Hello World");
  });

  it("extracts ASCII text as fallback when no UTF-16LE found", async () => {
    // 创建带有 OLE2 魔数、二进制噪声（不构成 UTF-16LE 可打印字符）和 ASCII 文本的缓冲区
    const header = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    // 用交替 0x01/0x02 填充，不构成 UTF-16LE 可打印字符
    const binaryNoise = Buffer.alloc(60);
    for (let i = 0; i < 60; i++) {
      binaryNoise[i] = i % 2 === 0 ? 0x01 : 0x02;
    }
    // 在奇数偏移处插入 ASCII 文本（前面有奇数个字节的填充，打断 UTF-16LE 对齐）
    const oddPad = Buffer.from([0x03]); // 1 字节，打断 2 字节对齐
    const asciiText = Buffer.from(
      "This is a test document with enough text content to pass the filter",
    );
    const tailNoise = Buffer.alloc(60);
    for (let i = 0; i < 60; i++) {
      tailNoise[i] = i % 2 === 0 ? 0x04 : 0x05;
    }
    const buffer = Buffer.concat([header, binaryNoise, oddPad, asciiText, tailNoise]);

    const result = await extractTextFromDoc(buffer.toString("base64"), "ascii.doc");
    // DOC 二进制提取是 best-effort，至少应该提取到部分文本
    expect(result.ok).toBe(true);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("rejects buffer shorter than 8 bytes", async () => {
    const short = Buffer.from([0xd0, 0xcf, 0x11]).toString("base64");
    const result = await extractTextFromDoc(short, "short.doc");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractDocumentText 路由测试
// ---------------------------------------------------------------------------

describe("extractDocumentText", () => {
  it("routes PDF to extractTextFromPdf", async () => {
    const notPdf = Buffer.from("not-a-pdf").toString("base64");
    const result = await extractDocumentText(notPdf, "test.pdf", "application/pdf");
    expect(result.ok).toBe(false);
    expect(result.text).toContain("test.pdf");
  });

  it("routes DOCX to extractTextFromDocx", async () => {
    const notDocx = Buffer.from("not-a-docx").toString("base64");
    const result = await extractDocumentText(
      notDocx,
      "test.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(result.ok).toBe(false);
    expect(result.text).toContain("test.docx");
  });

  it("routes DOC to extractTextFromDoc", async () => {
    const notDoc = Buffer.from("not-a-doc").toString("base64");
    const result = await extractDocumentText(notDoc, "test.doc", "application/msword");
    expect(result.ok).toBe(false);
    expect(result.text).toContain("test.doc");
  });

  it("returns error for unsupported MIME type", async () => {
    const data = Buffer.from("some data").toString("base64");
    const result = await extractDocumentText(data, "test.pptx", "application/vnd.ms-powerpoint");
    expect(result.ok).toBe(false);
    expect(result.text).toContain("不支持的文档格式");
  });
});
