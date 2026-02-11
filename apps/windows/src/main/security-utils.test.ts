/**
 * SecurityUtils 单元测试
 *
 * 测试用例:
 * - WIN-SEC-001: 路径遍历拒绝 (../../etc/passwd → 拒绝)
 * - WIN-SEC-002: 系统目录禁止 (禁止访问 Windows 系统目录)
 * - WIN-SEC-003: 正常路径放行 (用户目录路径 → 允许)
 * - 额外: sanitizeInput / sanitizeFileName / sanitizeCommandArg / validateUrl / validatePid 等
 */

import { describe, expect, it, beforeEach } from "vitest";
import os from "os";
import path from "path";
import {
  SecurityUtils,
  SecurityError,
} from "./security-utils";

describe("SecurityUtils", () => {
  let security: SecurityUtils;

  beforeEach(() => {
    security = new SecurityUtils({
      allowedBasePaths: [os.homedir(), os.tmpdir()],
    });
  });

  // ===========================================================================
  // WIN-SEC-001: 路径遍历拒绝
  // ===========================================================================
  describe("WIN-SEC-001: 路径遍历拒绝", () => {
    it("应拒绝包含 .. 的绝对路径", () => {
      const maliciousPath = path.join(os.homedir(), "..", "..", "etc", "passwd");
      expect(() => security.validatePath(maliciousPath)).toThrow(SecurityError);
    });

    it("应拒绝相对路径的路径遍历攻击", () => {
      expect(() =>
        security.validatePath("../../etc/passwd", os.homedir()),
      ).toThrow(SecurityError);
    });

    it("isPathSafe 对路径遍历返回 false", () => {
      const maliciousPath = path.join(os.homedir(), "..", "..", "etc", "passwd");
      expect(security.isPathSafe(maliciousPath)).toBe(false);
    });

    it("应拒绝空路径", () => {
      expect(() => security.validatePath("")).toThrow(SecurityError);
      expect(() => security.validatePath("" as string)).toThrow(SecurityError);
    });

    it("应拒绝超长路径", () => {
      const longPath = path.join(os.homedir(), "a".repeat(300));
      expect(() => security.validatePath(longPath)).toThrow(SecurityError);
    });

    it("应拒绝无基础路径的相对路径", () => {
      expect(() => security.validatePath("relative/path")).toThrow(SecurityError);
    });
  });

  // ===========================================================================
  // WIN-SEC-002: 系统目录禁止
  // ===========================================================================
  describe("WIN-SEC-002: 系统目录禁止", () => {
    it("应拒绝 Windows 系统目录 C:\\Windows", () => {
      expect(() =>
        security.validatePath("C:\\Windows\\System32\\config"),
      ).toThrow(SecurityError);
    });

    it("应拒绝 C:\\Program Files 目录", () => {
      expect(() =>
        security.validatePath("C:\\Program Files\\app"),
      ).toThrow(SecurityError);
    });

    it("应拒绝 C:\\ProgramData 目录", () => {
      expect(() =>
        security.validatePath("C:\\ProgramData\\secret"),
      ).toThrow(SecurityError);
    });

    it("应拒绝 .ssh 目录", () => {
      const sshPath = path.join(os.homedir(), ".ssh", "id_rsa");
      expect(() => security.validatePath(sshPath)).toThrow(SecurityError);
    });

    it("应拒绝 .aws 凭证目录", () => {
      const awsPath = path.join(os.homedir(), ".aws", "credentials");
      expect(() => security.validatePath(awsPath)).toThrow(SecurityError);
    });

    it("应拒绝包含 credentials 的路径", () => {
      const credPath = path.join(os.homedir(), "credentials", "secret.json");
      expect(() => security.validatePath(credPath)).toThrow(SecurityError);
    });

    it("应拒绝 /etc 系统配置目录", () => {
      expect(() => security.validatePath("/etc/passwd")).toThrow(SecurityError);
    });
  });

  // ===========================================================================
  // WIN-SEC-003: 正常路径放行
  // ===========================================================================
  describe("WIN-SEC-003: 正常路径放行", () => {
    it("应允许用户主目录下的路径", () => {
      const userFile = path.join(os.homedir(), "Documents", "test.txt");
      const result = security.validatePath(userFile);
      expect(result).toBe(path.normalize(userFile));
    });

    it("应允许临时目录下的路径", () => {
      const tmpFile = path.join(os.tmpdir(), "openclaw-test", "data.json");
      const result = security.validatePath(tmpFile);
      expect(result).toBe(path.normalize(tmpFile));
    });

    it("应允许指定基础路径内的相对路径", () => {
      const result = security.validatePath("test.txt", os.tmpdir());
      expect(result).toBe(path.normalize(path.join(os.tmpdir(), "test.txt")));
    });

    it("addAllowedBasePath 应允许新的基础路径", () => {
      const customDir = path.join(os.homedir(), "custom-workspace");
      security.addAllowedBasePath(customDir);
      const filePath = path.join(customDir, "file.txt");
      const result = security.validatePath(filePath);
      expect(result).toBe(path.normalize(filePath));
    });

    it("isPathSafe 对安全路径返回 true", () => {
      const safePath = path.join(os.homedir(), "Documents", "file.txt");
      expect(security.isPathSafe(safePath)).toBe(true);
    });
  });

  // ===========================================================================
  // sanitizeInput
  // ===========================================================================
  describe("sanitizeInput", () => {
    it("应移除 HTML 标签", () => {
      const result = security.sanitizeInput('<script>alert("xss")</script>Hello');
      expect(result).toBe('alert("xss")Hello');
    });

    it("应移除控制字符但保留换行", () => {
      const result = security.sanitizeInput("hello\x00\x01world\nok");
      expect(result).toBe("helloworld\nok");
    });

    it("应截断超长输入", () => {
      const input = "a".repeat(200);
      const result = security.sanitizeInput(input, { maxLength: 100 });
      expect(result.length).toBe(100);
    });

    it("应按 allowedChars 过滤字符", () => {
      const result = security.sanitizeInput("abc123!@#", {
        allowedChars: /[a-z0-9]/,
        stripHtml: false,
        stripControlChars: false,
      });
      expect(result).toBe("abc123");
    });

    it("非字符串输入返回空字符串", () => {
      const result = security.sanitizeInput(123 as unknown as string);
      expect(result).toBe("");
    });
  });

  // ===========================================================================
  // sanitizeFileName
  // ===========================================================================
  describe("sanitizeFileName", () => {
    it("应替换路径分隔符和危险字符", () => {
      const result = security.sanitizeFileName('file/name\\with:bad*chars?"<>|');
      expect(result).not.toMatch(/[/\\:*?"<>|]/);
    });

    it("应替换 .. 防止路径遍历", () => {
      const result = security.sanitizeFileName("../../etc/passwd");
      expect(result).not.toContain("..");
    });

    it("应移除开头的点", () => {
      const result = security.sanitizeFileName(".hidden");
      expect(result).toBe("hidden");
    });

    it("对空/无效输入返回 unnamed", () => {
      expect(security.sanitizeFileName("")).toBe("unnamed");
      expect(security.sanitizeFileName(null as unknown as string)).toBe("");
    });

    it("应限制文件名长度保留扩展名", () => {
      const longName = "a".repeat(250) + ".txt";
      const result = security.sanitizeFileName(longName);
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result).toMatch(/\.txt$/);
    });
  });

  // ===========================================================================
  // sanitizeCommandArg
  // ===========================================================================
  describe("sanitizeCommandArg", () => {
    it("应移除 shell 元字符", () => {
      const result = security.sanitizeCommandArg("hello; rm -rf /");
      expect(result).not.toContain(";");
    });

    it("应移除管道和反引号", () => {
      const result = security.sanitizeCommandArg("cmd | cat `whoami`");
      expect(result).not.toContain("|");
      expect(result).not.toContain("`");
    });

    it("应移除换行符", () => {
      const result = security.sanitizeCommandArg("hello\nworld");
      expect(result).toBe("hello world");
    });

    it("非字符串输入返回空字符串", () => {
      const result = security.sanitizeCommandArg(undefined as unknown as string);
      expect(result).toBe("");
    });
  });

  // ===========================================================================
  // isCommandAllowed
  // ===========================================================================
  describe("isCommandAllowed", () => {
    it("应允许白名单中的命令", () => {
      expect(security.isCommandAllowed("powershell")).toBe(true);
      expect(security.isCommandAllowed("cmd")).toBe(true);
      expect(security.isCommandAllowed("tasklist")).toBe(true);
      expect(security.isCommandAllowed("systeminfo")).toBe(true);
    });

    it("应拒绝不在白名单中的命令", () => {
      expect(security.isCommandAllowed("rm")).toBe(false);
      expect(security.isCommandAllowed("del")).toBe(false);
      expect(security.isCommandAllowed("curl")).toBe(false);
    });

    it("应忽略命令大小写", () => {
      expect(security.isCommandAllowed("PowerShell")).toBe(true);
      expect(security.isCommandAllowed("CMD")).toBe(true);
    });
  });

  // ===========================================================================
  // validatePid
  // ===========================================================================
  describe("validatePid", () => {
    it("应接受有效的 PID", () => {
      expect(security.validatePid(1234)).toBe(1234);
    });

    it("应拒绝非整数 PID", () => {
      expect(() => security.validatePid(1.5)).toThrow(SecurityError);
    });

    it("应拒绝负数 PID", () => {
      expect(() => security.validatePid(-1)).toThrow(SecurityError);
    });

    it("应拒绝零 PID", () => {
      expect(() => security.validatePid(0)).toThrow(SecurityError);
    });

    it("应拒绝超大 PID", () => {
      expect(() => security.validatePid(99999999)).toThrow(SecurityError);
    });

    it("应拒绝非数字类型", () => {
      expect(() => security.validatePid("123")).toThrow(SecurityError);
      expect(() => security.validatePid(null)).toThrow(SecurityError);
    });
  });

  // ===========================================================================
  // validateUrl
  // ===========================================================================
  describe("validateUrl", () => {
    it("应接受有效的 HTTP/HTTPS URL", () => {
      expect(security.validateUrl("https://example.com")).toBe("https://example.com/");
      expect(security.validateUrl("http://example.com")).toBe("http://example.com/");
    });

    it("应接受 WebSocket URL", () => {
      expect(security.validateUrl("ws://localhost:18789")).toBe("ws://localhost:18789/");
      expect(security.validateUrl("wss://example.com")).toBe("wss://example.com/");
    });

    it("应拒绝空 URL", () => {
      expect(() => security.validateUrl("")).toThrow(SecurityError);
      expect(() => security.validateUrl("  ")).toThrow(SecurityError);
    });

    it("应拒绝无效格式的 URL", () => {
      expect(() => security.validateUrl("not-a-url")).toThrow(SecurityError);
    });

    it("应拒绝不允许的协议", () => {
      expect(() => security.validateUrl("file:///etc/passwd")).toThrow(SecurityError);
      expect(() => security.validateUrl("ftp://example.com")).toThrow(SecurityError);
    });
  });

  // ===========================================================================
  // escapeRegExp / createSafeRegExp
  // ===========================================================================
  describe("escapeRegExp / createSafeRegExp", () => {
    it("应转义正则特殊字符", () => {
      const escaped = security.escapeRegExp("hello.world*[test]");
      expect(escaped).toBe("hello\\.world\\*\\[test\\]");
    });

    it("createSafeRegExp 应创建安全的正则表达式", () => {
      const re = security.createSafeRegExp("test.file");
      expect(re.test("test.file")).toBe(true);
      expect(re.test("testXfile")).toBe(false);
    });

    it("createSafeRegExp 应拒绝过长的模式", () => {
      const longPattern = "a".repeat(200);
      expect(() => security.createSafeRegExp(longPattern)).toThrow(SecurityError);
    });
  });

  // ===========================================================================
  // validateNumber / validateString
  // ===========================================================================
  describe("validateNumber", () => {
    it("应接受有效数字", () => {
      expect(security.validateNumber(42)).toBe(42);
    });

    it("应根据 min/max 验证范围", () => {
      expect(() => security.validateNumber(5, { min: 10 })).toThrow(SecurityError);
      expect(() => security.validateNumber(15, { max: 10 })).toThrow(SecurityError);
    });

    it("应验证整数", () => {
      expect(security.validateNumber(42, { integer: true })).toBe(42);
      expect(() => security.validateNumber(3.14, { integer: true })).toThrow(SecurityError);
    });

    it("应拒绝 NaN", () => {
      expect(() => security.validateNumber(NaN)).toThrow(SecurityError);
    });

    it("应拒绝非数字类型", () => {
      expect(() => security.validateNumber("42")).toThrow(SecurityError);
    });
  });

  describe("validateString", () => {
    it("应接受有效字符串", () => {
      expect(security.validateString("hello")).toBe("hello");
    });

    it("应检查最小长度", () => {
      expect(() => security.validateString("hi", { minLength: 5 })).toThrow(SecurityError);
    });

    it("应检查最大长度", () => {
      expect(() => security.validateString("hello world", { maxLength: 5 })).toThrow(SecurityError);
    });

    it("应验证模式", () => {
      expect(security.validateString("abc123", { pattern: /^[a-z0-9]+$/ })).toBe("abc123");
      expect(() => security.validateString("abc 123", { pattern: /^[a-z0-9]+$/ })).toThrow(SecurityError);
    });

    it("应拒绝非字符串类型", () => {
      expect(() => security.validateString(123)).toThrow(SecurityError);
    });
  });
});
