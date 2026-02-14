/**
 * 创建测试管理员账号
 *
 * 用于快速创建测试管理员账号
 */

import { getDatabase } from "../src/db/connection.js";
import { admins } from "../src/db/schema/index.js";
import { hashPassword } from "../src/db/utils/password.js";
import { generateId } from "../src/db/utils/id.js";
import { eq } from "drizzle-orm";

async function createTestAdmin() {
  const db = getDatabase();

  const testAdmin = {
    username: "admin",
    email: "admin@test.com",
    password: "Admin@123456",
    displayName: "测试管理员",
    role: "super_admin" as const,
  };

  console.log(`[create-admin] 检查管理员是否存在: ${testAdmin.username}`);

  // 检查是否已存在
  const existing = await db.query.admins.findFirst({
    where: eq(admins.username, testAdmin.username),
  });

  const passwordHash = await hashPassword(testAdmin.password);

  if (existing) {
    console.log(`[create-admin] 管理员已存在: ${testAdmin.username}`);
    console.log(`[create-admin] 更新密码...`);
    await db
      .update(admins)
      .set({
        passwordHash,
        displayName: testAdmin.displayName,
        role: testAdmin.role,
        status: "active",
        mfaEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(admins.username, testAdmin.username));
  } else {
    // 创建新账号
    console.log(`[create-admin] 创建管理员账号: ${testAdmin.username}`);

    await db.insert(admins).values({
      id: generateId(),
      username: testAdmin.username,
      email: testAdmin.email,
      passwordHash,
      displayName: testAdmin.displayName,
      role: testAdmin.role,
      status: "active",
      mfaEnabled: false,
    });
  }

  console.log(`[create-admin] 管理员账号创建成功!`);
  console.log(`[create-admin] 用户名: ${testAdmin.username}`);
  console.log(`[create-admin] 密码: ${testAdmin.password}`);
  console.log(`[create-admin] 角色: ${testAdmin.role}`);

  process.exit(0);
}

createTestAdmin().catch((error) => {
  console.error("[create-admin] 创建失败:", error);
  process.exit(1);
});
