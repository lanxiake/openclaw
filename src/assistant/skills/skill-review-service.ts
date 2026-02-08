/**
 * 技能审核服务
 *
 * 提供技能审核、发布/下架等功能
 */

import { eq } from "drizzle-orm";
import { getDatabase } from "../../db/index.js";
import { skillStoreItems, type SkillStoreItem, type SkillStatus } from "../../db/schema/index.js";

// 日志标签
const LOG_TAG = "[SkillReviewService]";

/**
 * 审核结果
 */
export interface ReviewResult {
  success: boolean;
  skill?: SkillStoreItem;
  error?: string;
}

/**
 * 审批技能
 */
export async function approveSkill(
  skillId: string,
  adminId: string,
  note?: string,
): Promise<ReviewResult> {
  console.log(`${LOG_TAG} approveSkill`, skillId, adminId);

  const db = await getDatabase();

  // 检查技能是否存在且状态为 pending
  const skill = await db
    .select()
    .from(skillStoreItems)
    .where(eq(skillStoreItems.id, skillId))
    .limit(1);

  if (!skill[0]) {
    return { success: false, error: "技能不存在" };
  }

  if (skill[0].status !== "pending") {
    return { success: false, error: "技能状态不是待审核" };
  }

  const now = new Date();

  const [updated] = await db
    .update(skillStoreItems)
    .set({
      status: "published",
      reviewNote: note,
      reviewedBy: adminId,
      reviewedAt: now,
      publishedAt: now,
      updatedAt: now,
    })
    .where(eq(skillStoreItems.id, skillId))
    .returning();

  return { success: true, skill: updated };
}

/**
 * 拒绝技能
 */
export async function rejectSkill(
  skillId: string,
  adminId: string,
  reason: string,
): Promise<ReviewResult> {
  console.log(`${LOG_TAG} rejectSkill`, skillId, adminId, reason);

  const db = await getDatabase();

  // 检查技能是否存在且状态为 pending
  const skill = await db
    .select()
    .from(skillStoreItems)
    .where(eq(skillStoreItems.id, skillId))
    .limit(1);

  if (!skill[0]) {
    return { success: false, error: "技能不存在" };
  }

  if (skill[0].status !== "pending") {
    return { success: false, error: "技能状态不是待审核" };
  }

  const now = new Date();

  const [updated] = await db
    .update(skillStoreItems)
    .set({
      status: "rejected",
      reviewNote: reason,
      reviewedBy: adminId,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(skillStoreItems.id, skillId))
    .returning();

  return { success: true, skill: updated };
}

/**
 * 发布技能
 */
export async function publishSkill(skillId: string): Promise<ReviewResult> {
  console.log(`${LOG_TAG} publishSkill`, skillId);

  const db = await getDatabase();

  // 检查技能是否存在
  const skill = await db
    .select()
    .from(skillStoreItems)
    .where(eq(skillStoreItems.id, skillId))
    .limit(1);

  if (!skill[0]) {
    return { success: false, error: "技能不存在" };
  }

  // 只有 unpublished 状态可以发布
  if (skill[0].status !== "unpublished") {
    return { success: false, error: "只能发布已下架的技能" };
  }

  const now = new Date();

  const [updated] = await db
    .update(skillStoreItems)
    .set({
      status: "published",
      publishedAt: now,
      updatedAt: now,
    })
    .where(eq(skillStoreItems.id, skillId))
    .returning();

  return { success: true, skill: updated };
}

/**
 * 下架技能
 */
export async function unpublishSkill(skillId: string): Promise<ReviewResult> {
  console.log(`${LOG_TAG} unpublishSkill`, skillId);

  const db = await getDatabase();

  // 检查技能是否存在
  const skill = await db
    .select()
    .from(skillStoreItems)
    .where(eq(skillStoreItems.id, skillId))
    .limit(1);

  if (!skill[0]) {
    return { success: false, error: "技能不存在" };
  }

  // 只有 published 状态可以下架
  if (skill[0].status !== "published") {
    return { success: false, error: "只能下架已发布的技能" };
  }

  const now = new Date();

  const [updated] = await db
    .update(skillStoreItems)
    .set({
      status: "unpublished",
      updatedAt: now,
    })
    .where(eq(skillStoreItems.id, skillId))
    .returning();

  return { success: true, skill: updated };
}

/**
 * 批量更新技能状态
 */
export async function batchUpdateStatus(
  skillIds: string[],
  status: SkillStatus,
  adminId?: string,
  note?: string,
): Promise<{ success: number; failed: number }> {
  console.log(`${LOG_TAG} batchUpdateStatus`, skillIds.length, status);

  let success = 0;
  let failed = 0;

  for (const skillId of skillIds) {
    try {
      let result: ReviewResult;

      switch (status) {
        case "published":
          // 如果是发布，需要检查原状态
          result = await publishSkill(skillId);
          if (!result.success) {
            // 尝试作为审批处理
            result = await approveSkill(skillId, adminId!, note);
          }
          break;
        case "unpublished":
          result = await unpublishSkill(skillId);
          break;
        case "rejected":
          result = await rejectSkill(skillId, adminId!, note || "批量拒绝");
          break;
        default:
          result = { success: false, error: "不支持的状态" };
      }

      if (result.success) {
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`${LOG_TAG} batchUpdateStatus error for ${skillId}:`, error);
      failed++;
    }
  }

  return { success, failed };
}
