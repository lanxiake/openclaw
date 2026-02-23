/**
 * version-checker 单元测试
 *
 * 测试语义版本比较、更新检测和批量检查功能
 */

import { describe, it, expect } from "vitest";
import { compareVersions, isUpdateAvailable, checkUpdates } from "./version-checker";

describe("version-checker", () => {
  describe("compareVersions", () => {
    it("VER-001: 正确比较 major 版本", () => {
      expect(compareVersions("2.0.0", "1.0.0")).toBeGreaterThan(0);
      expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
    });

    it("VER-002: 正确比较 minor 版本", () => {
      expect(compareVersions("1.2.0", "1.1.0")).toBeGreaterThan(0);
      expect(compareVersions("1.0.0", "1.1.0")).toBeLessThan(0);
    });

    it("VER-003: 正确比较 patch 版本", () => {
      expect(compareVersions("1.0.2", "1.0.1")).toBeGreaterThan(0);
      expect(compareVersions("1.0.0", "1.0.1")).toBeLessThan(0);
      expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    });

    it("VER-004: 处理非标准版本格式", () => {
      // 缺少 patch
      expect(compareVersions("1.0", "1.0.0")).toBe(0);
      // 只有 major
      expect(compareVersions("2", "1.0.0")).toBeGreaterThan(0);
      // 带 v 前缀
      expect(compareVersions("v1.2.0", "v1.1.0")).toBeGreaterThan(0);
      // 空字符串
      expect(compareVersions("", "")).toBe(0);
    });
  });

  describe("isUpdateAvailable", () => {
    it("VER-005: 正确判断需要更新", () => {
      expect(isUpdateAvailable("1.0.0", "1.0.1")).toBe(true);
      expect(isUpdateAvailable("1.0.0", "1.1.0")).toBe(true);
      expect(isUpdateAvailable("1.0.0", "2.0.0")).toBe(true);
    });

    it("VER-006: 相同版本返回 false", () => {
      expect(isUpdateAvailable("1.0.0", "1.0.0")).toBe(false);
      expect(isUpdateAvailable("2.3.4", "2.3.4")).toBe(false);
      // 已安装版本更高也返回 false
      expect(isUpdateAvailable("2.0.0", "1.0.0")).toBe(false);
    });
  });

  describe("checkUpdates", () => {
    it("VER-007: 批量检查返回正确结果", () => {
      const installed = [
        { skillId: "skill-a", version: "1.0.0" },
        { skillId: "skill-b", version: "2.0.0" },
        { skillId: "skill-c", version: "1.5.0" },
      ];
      const registry = new Map([
        ["skill-a", { latestVersion: "1.1.0" }],
        ["skill-b", { latestVersion: "2.0.0" }],
        ["skill-c", { latestVersion: "2.0.0" }],
      ]);

      const results = checkUpdates(installed, registry);

      expect(results.length).toBe(3);

      const resultA = results.find((r) => r.skillId === "skill-a")!;
      expect(resultA.hasUpdate).toBe(true);
      expect(resultA.latestVersion).toBe("1.1.0");

      const resultB = results.find((r) => r.skillId === "skill-b")!;
      expect(resultB.hasUpdate).toBe(false);

      const resultC = results.find((r) => r.skillId === "skill-c")!;
      expect(resultC.hasUpdate).toBe(true);
    });

    it("VER-008: 跳过不在 registry 中的技能", () => {
      const installed = [
        { skillId: "known", version: "1.0.0" },
        { skillId: "unknown", version: "1.0.0" },
      ];
      const registry = new Map([["known", { latestVersion: "2.0.0" }]]);

      const results = checkUpdates(installed, registry);

      // 只返回在 registry 中找到的技能
      expect(results.length).toBe(1);
      expect(results[0].skillId).toBe("known");
      expect(results[0].hasUpdate).toBe(true);
    });
  });
});
