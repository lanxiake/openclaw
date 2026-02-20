/**
 * Profile Memory Repository 测试
 *
 * 测试用户画像记忆系统的 4 个 Repository：
 * - UserProfileRepository: 用户画像核心数据
 * - UserFactRepository: 用户事实管理
 * - UserPreferencesV2Repository: 用户偏好设置
 * - BehaviorPatternRepository: 行为模式管理
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import {
  UserProfileRepository,
  UserFactRepository,
  UserPreferencesV2Repository,
  BehaviorPatternRepository,
  getUserProfileRepository,
  getUserFactRepository,
  getUserPreferencesV2Repository,
  getBehaviorPatternRepository,
} from "./profile-memory.js";

// ==================== UserProfileRepository 测试 ====================

describe("UserProfileRepository", () => {
  let profileRepo: UserProfileRepository;
  const testUserId = "user-profile-test-001";

  beforeEach(() => {
    console.log("[TEST] ========== UserProfileRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    profileRepo = getUserProfileRepository(db, testUserId);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== UserProfileRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("getOrCreate", () => {
    it("PROFILE-001: 应该创建新画像并返回", async () => {
      console.log("[TEST] ========== PROFILE-001 ==========");
      console.log("[TEST] 测试创建新画像");

      const profile = await profileRepo.getOrCreate();

      console.log("[TEST] 画像ID:", profile.id);
      console.log("[TEST] 画像 userId:", profile.userId);

      expect(profile.id).toBeTruthy();
      expect(profile.userId).toBe(testUserId);
      expect(profile.createdAt).toBeInstanceOf(Date);

      console.log("[TEST] ✓ 画像创建成功");
    });

    it("PROFILE-002: 重复调用应该返回已存在的画像", async () => {
      console.log("[TEST] ========== PROFILE-002 ==========");
      console.log("[TEST] 测试重复调用 getOrCreate");

      const profile1 = await profileRepo.getOrCreate();
      const profile2 = await profileRepo.getOrCreate();

      console.log("[TEST] 第一次画像ID:", profile1.id);
      console.log("[TEST] 第二次画像ID:", profile2.id);

      expect(profile1.id).toBe(profile2.id);

      console.log("[TEST] ✓ 重复调用返回相同画像");
    });
  });

  describe("get", () => {
    it("PROFILE-003: 不存在时应该返回 null", async () => {
      console.log("[TEST] ========== PROFILE-003 ==========");

      const profile = await profileRepo.get();

      expect(profile).toBeNull();

      console.log("[TEST] ✓ 不存在的画像正确返回 null");
    });

    it("PROFILE-004: 存在时应该返回画像", async () => {
      console.log("[TEST] ========== PROFILE-004 ==========");

      await profileRepo.getOrCreate();
      const profile = await profileRepo.get();

      expect(profile).toBeTruthy();
      expect(profile?.userId).toBe(testUserId);

      console.log("[TEST] ✓ 成功获取已存在的画像");
    });
  });

  describe("update", () => {
    it("PROFILE-005: 应该更新画像字段", async () => {
      console.log("[TEST] ========== PROFILE-005 ==========");
      console.log("[TEST] 测试更新画像");

      await profileRepo.getOrCreate();
      const updated = await profileRepo.update({
        displayName: "测试用户",
        nickname: "小测",
        language: "zh-CN",
        timezone: "Asia/Shanghai",
      });

      console.log("[TEST] 更新后 displayName:", updated?.displayName);
      console.log("[TEST] 更新后 nickname:", updated?.nickname);

      expect(updated?.displayName).toBe("测试用户");
      expect(updated?.nickname).toBe("小测");
      expect(updated?.language).toBe("zh-CN");
      expect(updated?.timezone).toBe("Asia/Shanghai");

      console.log("[TEST] ✓ 画像更新成功");
    });
  });

  describe("delete", () => {
    it("PROFILE-006: 应该删除画像", async () => {
      console.log("[TEST] ========== PROFILE-006 ==========");
      console.log("[TEST] 测试删除画像");

      await profileRepo.getOrCreate();
      await profileRepo.delete();
      const profile = await profileRepo.get();

      expect(profile).toBeNull();

      console.log("[TEST] ✓ 画像删除成功");
    });
  });

  describe("tenant isolation", () => {
    it("PROFILE-007: 不同用户的画像应该隔离", async () => {
      console.log("[TEST] ========== PROFILE-007 ==========");
      console.log("[TEST] 测试多租户隔离");

      // 用户 A 创建画像
      await profileRepo.getOrCreate();

      // 切换到用户 B
      const db = getMockDatabase();
      const userBRepo = getUserProfileRepository(db, "user-B-different");

      // 用户 B 获取画像应该为空
      const userBProfile = await userBRepo.get();

      console.log("[TEST] 用户B获取画像结果:", userBProfile);

      expect(userBProfile).toBeNull();

      console.log("[TEST] ✓ 多租户隔离正常");
    });
  });
});
