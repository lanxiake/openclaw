/**
 * 开发环境 Seed 数据脚本
 *
 * 用于快速创建测试数据，支持开发和测试环境
 *
 * 使用方式:
 *   pnpm db:seed              # 创建默认测试数据
 *   pnpm db:seed --admin-only # 仅创建管理员
 */

import { eq } from "drizzle-orm";

import { getDatabase } from "../src/db/connection.js";
import {
  users,
  plans,
  subscriptions,
  skills,
  admins,
  skillCategories,
} from "../src/db/schema/index.js";
import { hashPassword } from "../src/db/utils/password.js";
import { generateId } from "../src/db/utils/id.js";
import { initializeDefaultConfigs } from "../src/assistant/config/config-service.js";
import { ensureMemorySystemConfigs } from "../src/gateway/config-loader.js";
import { getLogger } from "../src/logging/logger.js";
import { fileURLToPath } from "node:url";

const logger = getLogger();

// 测试数据配置
const SEED_CONFIG = {
  // 测试用户
  testUsers: [
    {
      phone: "13800138000",
      displayName: "测试用户",
      email: "test@openclaw.ai",
      password: "test123456",
    },
    {
      phone: "13900139000",
      displayName: "VIP用户",
      email: "vip@openclaw.ai",
      password: "vip123456",
    },
  ],

  // 套餐定义
  plans: [
    {
      code: "free",
      name: "免费版",
      description: "基础功能，适合个人体验",
      priceMonthly: 0,
      priceYearly: 0,
      tokensPerMonth: 10000,
      storageMb: 100,
      maxDevices: 1,
      features: {
        maxAgents: 1,
        supportLevel: "community",
      },
      isActive: true,
      sortOrder: 1,
    },
    {
      code: "pro",
      name: "专业版",
      description: "高级功能，适合专业用户",
      priceMonthly: 4900, // 49 元/月
      priceYearly: 49900, // 499 元/年
      tokensPerMonth: 100000,
      storageMb: 5000,
      maxDevices: 5,
      features: {
        maxAgents: 10,
        supportLevel: "email",
      },
      isActive: true,
      sortOrder: 2,
    },
    {
      code: "enterprise",
      name: "企业版",
      description: "无限制功能，适合团队和企业",
      priceMonthly: 19900, // 199 元/月
      priceYearly: 199900, // 1999 元/年
      tokensPerMonth: -1, // 无限制
      storageMb: -1,
      maxDevices: -1,
      features: {
        maxAgents: -1,
        supportLevel: "priority",
      },
      isActive: true,
      sortOrder: 3,
    },
  ],

  // 技能分类
  skillCategories: [
    { name: "效率工具", description: "提升工作效率的技能", sortOrder: 1 },
    { name: "自动化", description: "自动化任务处理", sortOrder: 2 },
    { name: "多媒体", description: "图片、视频、音频处理", sortOrder: 3 },
    { name: "开发工具", description: "编程和开发辅助", sortOrder: 4 },
    { name: "通讯", description: "消息和通讯相关", sortOrder: 5 },
  ],

  // 内置技能
  skills: [
    {
      code: "file-organizer",
      name: "文件整理",
      description: "智能整理和分类文件",
      type: "builtin",
      price: 0,
    },
    {
      code: "system-cleaner",
      name: "系统清理",
      description: "清理系统垃圾文件",
      type: "builtin",
      price: 0,
    },
    {
      code: "screenshot-ocr",
      name: "截图识别",
      description: "截图并识别文字内容",
      type: "builtin",
      price: 0,
    },
    {
      code: "quick-translate",
      name: "快速翻译",
      description: "多语言即时翻译",
      type: "builtin",
      price: 0,
    },
  ],

  // 管理员账户
  admins: [
    {
      username: "super_admin",
      email: "admin@openclaw.ai",
      password: "Admin@2026!",
      displayName: "超级管理员",
      role: "super_admin" as const,
    },
    {
      username: "operator",
      email: "operator@openclaw.ai",
      password: "Operator@2026!",
      displayName: "运营人员",
      role: "operator" as const,
    },
  ],
};

/**
 * 创建套餐数据
 */
async function seedPlans(db: ReturnType<typeof getDatabase>) {
  logger.info("[seed] Creating plans...");

  const createdPlans: Record<string, string> = {};

  for (const plan of SEED_CONFIG.plans) {
    // 检查是否已存在
    const existing = await db.query.plans.findFirst({
      where: eq(plans.code, plan.code),
    });

    if (existing) {
      logger.info(`[seed] Plan '${plan.code}' already exists, skipping`);
      createdPlans[plan.code] = existing.id;
      continue;
    }

    const [created] = await db
      .insert(plans)
      .values({
        id: generateId(),
        ...plan,
      })
      .returning();

    createdPlans[plan.code] = created.id;
    logger.info(`[seed] Created plan: ${plan.name}`);
  }

  return createdPlans;
}

/**
 * 创建测试用户
 */
async function seedUsers(db: ReturnType<typeof getDatabase>, planIds: Record<string, string>) {
  logger.info("[seed] Creating test users...");

  const createdUsers: Array<{ id: string; phone: string }> = [];

  for (let i = 0; i < SEED_CONFIG.testUsers.length; i++) {
    const userData = SEED_CONFIG.testUsers[i];

    // 检查是否已存在
    const existing = await db.query.users.findFirst({
      where: eq(users.phone, userData.phone),
    });

    if (existing) {
      logger.info(`[seed] User '${userData.phone}' already exists, skipping`);
      createdUsers.push({ id: existing.id, phone: existing.phone });
      continue;
    }

    // 创建用户
    const passwordHash = await hashPassword(userData.password);
    const [user] = await db
      .insert(users)
      .values({
        id: generateId(),
        phone: userData.phone,
        displayName: userData.displayName,
        email: userData.email,
        passwordHash,
        status: "active",
        emailVerified: true,
        phoneVerified: true,
      })
      .returning();

    createdUsers.push({ id: user.id, phone: user.phone });
    logger.info(`[seed] Created user: ${userData.displayName} (${userData.phone})`);

    // 为第一个用户创建免费订阅，第二个用户创建专业版订阅
    const planCode = i === 0 ? "free" : "pro";
    const planId = planIds[planCode];

    if (planId) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天后

      await db.insert(subscriptions).values({
        id: generateId(),
        userId: user.id,
        planId,
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });

      logger.info(`[seed] Created subscription: ${planCode} for ${userData.phone}`);
    }
  }

  return createdUsers;
}

/**
 * 创建技能分类
 */
async function seedSkillCategories(db: ReturnType<typeof getDatabase>) {
  logger.info("[seed] Creating skill categories...");

  const createdCategories: Record<string, string> = {};

  for (const category of SEED_CONFIG.skillCategories) {
    const existing = await db.query.skillCategories.findFirst({
      where: eq(skillCategories.name, category.name),
    });

    if (existing) {
      logger.info(`[seed] Category '${category.name}' already exists, skipping`);
      createdCategories[category.name] = existing.id;
      continue;
    }

    const [created] = await db
      .insert(skillCategories)
      .values({
        id: generateId(),
        ...category,
        icon: `icon-${category.name}`,
      })
      .returning();

    createdCategories[category.name] = created.id;
    logger.info(`[seed] Created category: ${category.name}`);
  }

  return createdCategories;
}

/**
 * 创建内置技能
 */
async function seedSkills(db: ReturnType<typeof getDatabase>) {
  logger.info("[seed] Creating builtin skills...");

  for (const skill of SEED_CONFIG.skills) {
    const existing = await db.query.skills.findFirst({
      where: eq(skills.code, skill.code),
    });

    if (existing) {
      logger.info(`[seed] Skill '${skill.code}' already exists, skipping`);
      continue;
    }

    await db.insert(skills).values({
      id: generateId(),
      ...skill,
    });

    logger.info(`[seed] Created skill: ${skill.name}`);
  }
}

/**
 * 创建管理员账户
 */
async function seedAdmins(db: ReturnType<typeof getDatabase>) {
  logger.info("[seed] Creating admin accounts...");

  for (const adminData of SEED_CONFIG.admins) {
    const existing = await db.query.admins.findFirst({
      where: eq(admins.username, adminData.username),
    });

    if (existing) {
      logger.info(`[seed] Admin '${adminData.username}' already exists, skipping`);
      continue;
    }

    const passwordHash = await hashPassword(adminData.password);

    await db.insert(admins).values({
      id: generateId(),
      username: adminData.username,
      email: adminData.email,
      passwordHash,
      displayName: adminData.displayName,
      role: adminData.role,
      status: "active",
      permissions: {},
    });

    logger.info(`[seed] Created admin: ${adminData.displayName} (${adminData.role})`);
  }
}

/**
 * 初始化系统配置
 *
 * 调用 initializeDefaultConfigs 和 ensureMemorySystemConfigs
 * 确保 system_configs 表中存在所有必要的默认配置项。
 */
async function seedSystemConfigs(db: ReturnType<typeof getDatabase>) {
  logger.info("[seed] Initializing system configs...");

  // 初始化通用系统配置（站点名称、安全、Gateway、AI、存储、通知、订阅等）
  await initializeDefaultConfigs();
  logger.info("[seed] Default system configs initialized");

  // 初始化记忆系统配置（memory_embedding、memory_llm）
  await ensureMemorySystemConfigs(db);
  logger.info("[seed] Memory system configs initialized");
}

/**
 * 执行完整的 seed 流程
 *
 * 供外部脚本（如 db-reset.ts）调用，按依赖顺序创建所有测试数据。
 *
 * @param db - Drizzle 数据库实例
 * @param options - seed 选项
 * @param options.adminOnly - 仅创建管理员账户
 */
export async function runSeed(
  db: ReturnType<typeof getDatabase>,
  options: { adminOnly?: boolean } = {},
): Promise<void> {
  logger.info("[seed] Starting database seed...");
  logger.info(`[seed] Options: adminOnly=${options.adminOnly ?? false}`);

  if (options.adminOnly) {
    await seedAdmins(db);
  } else {
    // 按依赖顺序创建数据
    const planIds = await seedPlans(db);
    await seedUsers(db, planIds);
    await seedSkillCategories(db);
    await seedSkills(db);
    await seedAdmins(db);
    await seedSystemConfigs(db);
  }

  logger.info("[seed] Database seed completed successfully!");
  logger.info("");
  logger.info("[seed] Test accounts:");
  logger.info("  User 1: 13800138000 / test123456 (Free plan)");
  logger.info("  User 2: 13900139000 / vip123456 (Pro plan)");
  logger.info("  Admin:  super_admin / Admin@2026!");
  logger.info("  Operator: operator / Operator@2026!");
}

/**
 * 主函数 — 独立运行入口
 */
async function main() {
  const args = process.argv.slice(2);
  const adminOnly = args.includes("--admin-only");

  try {
    const db = getDatabase();
    await runSeed(db, { adminOnly });
  } catch (error) {
    logger.error("[seed] Seed failed:", error);
    process.exit(1);
  } finally {
    const { closeConnection } = await import("../src/db/connection.js");
    await closeConnection();
  }
}

// 仅在直接运行时执行 main（被 import 时不执行）
const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
