/**
 * 技能打包器测试
 *
 * 测试将技能代码 + manifest 打包为 base64 编码的 tar.gz
 * 包含 SHA-256 校验、大小限制、参数验证等场景
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_PACKAGE_SIZE_BYTES,
  packSkill,
  verifyPackage,
  type PackageInput,
} from "./skill-packager.js";

describe("skill-packager", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-pack-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  /**
   * 创建一个最小的 TypeScript 技能输入
   */
  function createTsInput(overrides?: Partial<PackageInput>): PackageInput {
    return {
      manifest: {
        id: "test-skill-ts",
        name: "Test Skill",
        description: "A test TypeScript skill",
        version: "1.0.0",
        author: "test",
        entry: "index.ts",
        runtime: "typescript",
        permissions: {
          fileSystem: { read: ["/tmp/**"] },
        },
      },
      files: {
        "index.ts": `
const params = JSON.parse(process.env.SKILL_PARAMS || '{}');
console.log('__SKILL_RESULT__:' + JSON.stringify({ success: true, data: params }));
`,
      },
      ...overrides,
    };
  }

  describe("packSkill", () => {
    it("PACK-001: 打包 TypeScript 单文件技能", async () => {
      const input = createTsInput();
      const output = await packSkill(input, tempDir);

      expect(output.packageBase64).toBeTruthy();
      expect(output.packageHash).toMatch(/^[a-f0-9]{64}$/);
      expect(output.packageSize).toBeGreaterThan(0);
      expect(output.manifest.id).toBe("test-skill-ts");
      expect(output.manifest.runtime).toBe("typescript");
    });

    it("PACK-002: 打包 Python 单文件技能", async () => {
      const input: PackageInput = {
        manifest: {
          id: "test-skill-py",
          name: "Test Python Skill",
          version: "1.0.0",
          entry: "main.py",
          runtime: "python",
        },
        files: {
          "main.py": `
import os, json
params = json.loads(os.environ.get('SKILL_PARAMS', '{}'))
print('__SKILL_RESULT__:' + json.dumps({'success': True, 'data': params}))
`,
        },
      };

      const output = await packSkill(input, tempDir);

      expect(output.packageBase64).toBeTruthy();
      expect(output.packageHash).toMatch(/^[a-f0-9]{64}$/);
      expect(output.manifest.id).toBe("test-skill-py");
      expect(output.manifest.runtime).toBe("python");
    });

    it("PACK-003: 打包多文件技能（含 package.json）", async () => {
      const input: PackageInput = {
        manifest: {
          id: "multi-file-skill",
          name: "Multi File Skill",
          version: "2.0.0",
          entry: "index.ts",
          runtime: "typescript",
        },
        files: {
          "index.ts": `import { helper } from './utils'; helper();`,
          "utils.ts": `export function helper() { return 42; }`,
          "package.json": `{"name": "multi-file-skill", "version": "2.0.0"}`,
        },
      };

      const output = await packSkill(input, tempDir);

      expect(output.packageBase64).toBeTruthy();
      expect(output.packageSize).toBeGreaterThan(0);
      expect(output.manifest.id).toBe("multi-file-skill");
      expect(output.manifest.version).toBe("2.0.0");
      // 多文件包成功打包即可（gzip 压缩使大小比较不可靠）
    });

    it("PACK-004: SHA-256 哈希正确且可复现", async () => {
      const input = createTsInput();
      const output = await packSkill(input, tempDir);

      // 手动计算 hash 验证
      const buffer = Buffer.from(output.packageBase64, "base64");
      const expectedHash = crypto.createHash("sha256").update(buffer).digest("hex");

      expect(output.packageHash).toBe(expectedHash);
    });

    it("PACK-007: 缺少 manifest 必填字段时报错", async () => {
      const input: PackageInput = {
        manifest: {
          id: "",
          name: "No ID Skill",
          version: "1.0.0",
          entry: "index.ts",
          runtime: "typescript",
        },
        files: { "index.ts": "console.log('hello')" },
      };

      await expect(packSkill(input, tempDir)).rejects.toThrow();
    });

    it("PACK-008: 超过大小限制时报错", async () => {
      // 创建一个超大文件
      const largeContent = "x".repeat(MAX_PACKAGE_SIZE_BYTES + 1);
      const input: PackageInput = {
        manifest: {
          id: "huge-skill",
          name: "Huge Skill",
          version: "1.0.0",
          entry: "index.ts",
          runtime: "typescript",
        },
        files: { "index.ts": largeContent },
      };

      await expect(packSkill(input, tempDir)).rejects.toThrow(/大小超过限制|size.*limit/i);
    });
  });

  describe("verifyPackage", () => {
    it("PACK-005: verifyPackage 正确验证有效包", async () => {
      const input = createTsInput();
      const output = await packSkill(input, tempDir);

      const isValid = verifyPackage(output.packageBase64, output.packageHash);
      expect(isValid).toBe(true);
    });

    it("PACK-006: verifyPackage 哈希不匹配返回 false", async () => {
      const input = createTsInput();
      const output = await packSkill(input, tempDir);

      const wrongHash = "0".repeat(64);
      const isValid = verifyPackage(output.packageBase64, wrongHash);
      expect(isValid).toBe(false);
    });
  });
});
