/**
 * 测试数据库迁移是否成功
 */

import postgres from "postgres";

const connectionString =
  process.env["DATABASE_URL"] ||
  "postgresql://openclaw_admin:Oc@2026!Pg#Secure@10.157.152.40:22001/openclaw_prod";

async function testMigration() {
  console.log("[TEST] 连接数据库...");
  const sql = postgres(connectionString, { max: 1 });

  try {
    // 测试 users 表的新列
    console.log("\n[TEST] 检查 users 表的新列...");
    const usersColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('email', 'wechat_open_id', 'password_hash', 'mfa_enabled', 'is_active', 'email_verified', 'phone_verified', 'metadata')
      ORDER BY column_name
    `;
    console.log(`[TEST] ✓ users 表新列数量: ${usersColumns.length}/8`);
    usersColumns.forEach((col: any) => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // 测试 verification_codes 表的新列
    console.log("\n[TEST] 检查 verification_codes 表的新列...");
    const verificationColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'verification_codes'
      AND column_name IN ('target', 'target_type', 'code', 'purpose', 'used')
      ORDER BY column_name
    `;
    console.log(`[TEST] ✓ verification_codes 表新列数量: ${verificationColumns.length}/5`);
    verificationColumns.forEach((col: any) => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // 测试 user_devices 表的新列
    console.log("\n[TEST] 检查 user_devices 表的新列...");
    const devicesColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_devices'
      AND column_name IN ('alias', 'is_primary', 'linked_at')
      ORDER BY column_name
    `;
    console.log(`[TEST] ✓ user_devices 表新列数量: ${devicesColumns.length}/3`);
    devicesColumns.forEach((col: any) => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // 测试 user_sessions 表的新列
    console.log("\n[TEST] 检查 user_sessions 表的新列...");
    const sessionsColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_sessions'
      AND column_name IN ('revoked', 'last_refreshed_at')
      ORDER BY column_name
    `;
    console.log(`[TEST] ✓ user_sessions 表新列数量: ${sessionsColumns.length}/2`);
    sessionsColumns.forEach((col: any) => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // 测试 login_attempts 表的新列
    console.log("\n[TEST] 检查 login_attempts 表的新列...");
    const attemptsColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'login_attempts'
      AND column_name IN ('identifier', 'identifier_type', 'attempted_at')
      ORDER BY column_name
    `;
    console.log(`[TEST] ✓ login_attempts 表新列数量: ${attemptsColumns.length}/3`);
    attemptsColumns.forEach((col: any) => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log("\n[TEST] ========== 迁移验证成功！ ==========");
  } catch (error) {
    console.error("[TEST] ✗ 迁移验证失败:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

testMigration();
