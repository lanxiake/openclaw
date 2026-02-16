/**
 * 技能上传和审核端到端集成测试
 *
 * 测试完整流程：
 * 1. 用户创建技能
 * 2. 用户上传文件
 * 3. 管理员审核技能
 * 4. 技能发布
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDatabase } from "../../db/connection.js";
import { users, admins, skillStoreItems, skillStoreCategories } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import {
  createSkill,
  getSkill,
  getSkillList,
  deleteSkill,
} from "../../assistant/skills/skill-service.js";
import {
  approveSkill,
  rejectSkill,
  publishSkill,
} from "../../assistant/skills/skill-review-service.js";
import { uploadSkillFile, deleteAllSkillFiles } from "../../assistant/skills/skill-storage-service.js";

describe("技能上传和审核流程", () => {
  let testUserId: string;
  let testAdminId: string;
  let testCategoryId: string;
  let testSkillId: string;

  beforeAll(async () => {
    const db = getDatabase();

    // 创建测试用户
    const [user] = await db
      .insert(users)
      .values({
        id: `test-user-${Date.now()}`,
        displayName: "测试用户",
        email: `test-${Date.now()}@example.com`,
        passwordHash: "test-hash",
        subscriptionLevel: "free",
      })
      .returning();
    testUserId = user.id;

    // 创建测试管理员
    const [admin] = await db
      .insert(admins)
      .values({
        id: `test-admin-${Date.now()}`,
        username: `admin-${Date.now()}`,
        displayName: "测试管理员",
        email: `admin-${Date.now()}@example.com`,
        passwordHash: "test-hash",
        role: "admin",
        permissions: ["skills:manage"],
      })
      .returning();
    testAdminId = admin.id;

    // 创建测试分类
    const [category] = await db
      .insert(skillStoreCategories)
      .values({
        id: `test-category-${Date.now()}`,
        name: "测试分类",
        icon: "🧪",
        description: "用于测试的分类",
        displayOrder: 999,
      })
      .returning();
    testCategoryId = category.id;
  });

  afterAll(async () => {
    const db = getDatabase();

    // 清理测试数据
    if (testSkillId) {
      await deleteAllSkillFiles(testSkillId);
      await db.delete(skillStoreItems).where(eq(skillStoreItems.id, testSkillId));
    }
    if (testCategoryId) {
      await db.delete(skillStoreCategories).where(eq(skillStoreCategories.id, testCategoryId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testAdminId) {
      await db.delete(admins).where(eq(admins.id, testAdminId));
    }
  });

  it("完整流程：创建 → 上传 → 审核 → 发布", async () => {
    // 步骤 1: 用户创建技能
    console.log("[E2E Test] 步骤 1: 创建技能");
    const skill = await createSkill({
      name: "测试技能",
      description: "这是一个测试技能",
      readme: "# 测试技能\n\n这是详细说明",
      version: "1.0.0",
      authorId: testUserId,
      authorName: "测试用户",
      categoryId: testCategoryId,
      tags: ["测试", "E2E"],
      subscriptionLevel: "free",
    });

    testSkillId = skill.id;
    expect(skill.status).toBe("pending");
    expect(skill.name).toBe("测试技能");
    console.log(`[E2E Test] 技能创建成功，ID: ${testSkillId}`);

    // 步骤 2: 用户上传文件
    console.log("[E2E Test] 步骤 2: 上传文件");
    const testFileContent = Buffer.from("test file content");
    const testFileBase64 = testFileContent.toString("base64");

    const uploadResult = await uploadSkillFile({
      skillId: testSkillId,
      fileType: "package",
      fileName: "test-skill.zip",
      fileContent: testFileBase64,
      contentType: "application/zip",
    });

    expect(uploadResult.success).toBe(true);
    expect(uploadResult.url).toBeDefined();
    console.log(`[E2E Test] 文件上传成功，URL: ${uploadResult.url}`);

    // 步骤 3: 管理员审核通过
    console.log("[E2E Test] 步骤 3: 管理员审核");
    await approveSkill(testSkillId, testAdminId);

    const approvedSkill = await getSkill(testSkillId);
    expect(approvedSkill?.status).toBe("unpublished");
    expect(approvedSkill?.reviewedBy).toBe(testAdminId);
    expect(approvedSkill?.reviewedAt).toBeDefined();
    console.log("[E2E Test] 技能审核通过");

    // 步骤 4: 发布技能
    console.log("[E2E Test] 步骤 4: 发布技能");
    await publishSkill(testSkillId, testAdminId);

    const publishedSkill = await getSkill(testSkillId);
    expect(publishedSkill?.status).toBe("published");
    expect(publishedSkill?.publishedAt).toBeDefined();
    console.log("[E2E Test] 技能发布成功");

    // 步骤 5: 验证技能列表
    console.log("[E2E Test] 步骤 5: 验证技能列表");
    const skillList = await getSkillList({
      status: "published",
      page: 1,
      pageSize: 10,
    });

    const foundSkill = skillList.skills.find((s) => s.id === testSkillId);
    expect(foundSkill).toBeDefined();
    expect(foundSkill?.status).toBe("published");
    console.log("[E2E Test] 技能在列表中可见");
  });

  it("审核拒绝流程", async () => {
    console.log("[E2E Test] 测试审核拒绝流程");
    const db = getDatabase();

    // 创建技能
    const skill = await createSkill({
      name: "待拒绝技能",
      description: "这个技能将被拒绝",
      readme: "# 待拒绝技能",
      version: "1.0.0",
      authorId: testUserId,
      authorName: "测试用户",
      categoryId: testCategoryId,
      tags: ["测试"],
      subscriptionLevel: "free",
    });

    const rejectSkillId = skill.id;

    // 管理员拒绝
    await rejectSkill(rejectSkillId, testAdminId, "内容不符合规范");

    const rejectedSkill = await getSkill(rejectSkillId);
    expect(rejectedSkill?.status).toBe("rejected");
    expect(rejectedSkill?.reviewedBy).toBe(testAdminId);
    expect(rejectedSkill?.reviewNote).toBe("内容不符合规范");
    console.log("[E2E Test] 技能拒绝成功");

    // 清理
    await db.delete(skillStoreItems).where(eq(skillStoreItems.id, rejectSkillId));
  });
});

