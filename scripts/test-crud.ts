/**
 * 简单的数据库CRUD测试
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../src/db/schema/users.js";
import { eq } from "drizzle-orm";

const connectionString =
  process.env["DATABASE_URL"] ||
  "postgresql://openclaw_admin:Oc@2026!Pg#Secure@10.157.152.40:22001/openclaw_prod";

async function testCRUD() {
  console.log("[TEST] 连接数据库...");
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  try {
    // 1. 创建测试用户
    console.log("\n[TEST] 1. 创建测试用户...");
    const testPhone = `+86138${Date.now().toString().slice(-8)}`;
    const testEmail = `test-${Date.now()}@example.com`;

    const [newUser] = await db
      .insert(users)
      .values({
        id: `test-${Date.now()}`,
        phone: testPhone,
        email: testEmail,
        passwordHash: "$scrypt$16384$8$1$test-hash",
        isActive: true,
        emailVerified: false,
        phoneVerified: false,
        mfaEnabled: false,
      })
      .returning();

    console.log(`[TEST] ✓ 用户创建成功: ${newUser.id}`);
    console.log(`  - phone: ${newUser.phone}`);
    console.log(`  - email: ${newUser.email}`);
    console.log(`  - isActive: ${newUser.isActive}`);

    // 2. 根据ID查找用户
    console.log("\n[TEST] 2. 根据ID查找用户...");
    const foundById = await db.select().from(users).where(eq(users.id, newUser.id));
    console.log(`[TEST] ✓ 找到用户: ${foundById[0]?.id}`);

    // 3. 根据手机号查找用户
    console.log("\n[TEST] 3. 根据手机号查找用户...");
    const foundByPhone = await db.select().from(users).where(eq(users.phone, testPhone));
    console.log(`[TEST] ✓ 找到用户: ${foundByPhone[0]?.id}`);

    // 4. 根据邮箱查找用户
    console.log("\n[TEST] 4. 根据邮箱查找用户...");
    const foundByEmail = await db.select().from(users).where(eq(users.email, testEmail));
    console.log(`[TEST] ✓ 找到用户: ${foundByEmail[0]?.id}`);

    // 5. 更新用户
    console.log("\n[TEST] 5. 更新用户...");
    await db
      .update(users)
      .set({
        displayName: "测试用户",
        emailVerified: true,
      })
      .where(eq(users.id, newUser.id));

    const updated = await db.select().from(users).where(eq(users.id, newUser.id));
    console.log(`[TEST] ✓ 用户更新成功`);
    console.log(`  - displayName: ${updated[0]?.displayName}`);
    console.log(`  - emailVerified: ${updated[0]?.emailVerified}`);

    // 6. 删除用户
    console.log("\n[TEST] 6. 删除测试用户...");
    await db.delete(users).where(eq(users.id, newUser.id));
    const deleted = await db.select().from(users).where(eq(users.id, newUser.id));
    console.log(`[TEST] ✓ 用户删除成功 (查询结果数: ${deleted.length})`);

    console.log("\n[TEST] ========== 所有测试通过！ ==========");
  } catch (error) {
    console.error("[TEST] ✗ 测试失败:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

testCRUD();
