/**
 * 检查管理员密码哈希
 */

import postgres from "postgres";

const connectionString =
  process.env["DATABASE_URL"] ||
  "postgresql://openclaw_admin:Oc@2026!Pg#Secure@10.157.152.40:22001/openclaw_prod";

async function checkPasswordHash() {
  console.log("[TEST] 连接数据库...");
  const sql = postgres(connectionString, { max: 1 });

  try {
    const [admin] = await sql`
      SELECT username, password_hash
      FROM admins
      WHERE username = 'admin'
    `;

    console.log("\n[TEST] 管理员信息:");
    console.log(`  - 用户名: ${admin.username}`);
    console.log(`  - 密码哈希: ${admin.password_hash}`);
    console.log(`  - 哈希长度: ${admin.password_hash.length}`);
    console.log(`  - 哈希前缀: ${admin.password_hash.substring(0, 20)}`);
  } catch (error) {
    console.error("[TEST] ✗ 查询失败:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkPasswordHash();
