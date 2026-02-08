/**
 * 简化的管理员登录测试
 *
 * 直接测试数据库层面的认证，跳过审计日志
 */

import { getDatabase } from "../src/db/connection.js";
import { getAdminRepository } from "../src/db/repositories/admins.js";
import { verifyPassword } from "../src/db/utils/password.js";
import { generateAdminAccessToken } from "../src/assistant/admin-auth/admin-jwt.js";

async function testSimpleLogin() {
  console.log("[TEST] ========== 简化管理员登录测试 ==========\n");

  try {
    const db = getDatabase();
    const adminRepo = getAdminRepository(db);

    // 1. 测试查找管理员
    console.log("[TEST] 1. 查找管理员...");
    const username = "admin";
    const password = "Admin@123456";

    const admin = await adminRepo.findByUsername(username);

    if (!admin) {
      console.error("[TEST] ✗ 管理员不存在");
      process.exit(1);
    }

    console.log("[TEST] ✓ 管理员找到");
    console.log(`[TEST]   - ID: ${admin.id}`);
    console.log(`[TEST]   - 用户名: ${admin.username}`);
    console.log(`[TEST]   - 显示名称: ${admin.displayName}`);
    console.log(`[TEST]   - 角色: ${admin.role}`);
    console.log(`[TEST]   - 状态: ${admin.status}\n`);

    // 2. 测试密码验证
    console.log("[TEST] 2. 验证密码...");
    const isValid = await verifyPassword(password, admin.passwordHash);

    if (!isValid) {
      console.error("[TEST] ✗ 密码验证失败");
      process.exit(1);
    }

    console.log("[TEST] ✓ 密码验证成功\n");

    // 3. 测试生成 Token
    console.log("[TEST] 3. 生成访问令牌...");
    const tokenPair = await generateAdminAccessToken({
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
    });

    console.log("[TEST] ✓ 令牌生成成功");
    console.log(`[TEST]   - Access Token: ${tokenPair.accessToken.substring(0, 50)}...`);
    if (tokenPair.refreshToken) {
      console.log(`[TEST]   - Refresh Token: ${tokenPair.refreshToken.substring(0, 50)}...`);
    }
    console.log(`[TEST]   - 过期时间: ${tokenPair.expiresIn}秒\n`);

    // 4. 测试错误密码
    console.log("[TEST] 4. 测试错误密码...");
    const wrongPassword = "WrongPassword123";
    const isWrongValid = await verifyPassword(wrongPassword, admin.passwordHash);

    if (isWrongValid) {
      console.error("[TEST] ✗ 错误：错误密码应该验证失败");
      process.exit(1);
    }

    console.log("[TEST] ✓ 错误密码正确拒绝\n");

    // 5. 测试不存在的用户
    console.log("[TEST] 5. 测试不存在的用户...");
    const nonExistent = await adminRepo.findByUsername("nonexistent");

    if (nonExistent) {
      console.error("[TEST] ✗ 错误：不存在的用户不应该被找到");
      process.exit(1);
    }

    console.log("[TEST] ✓ 不存在的用户正确返回 null\n");

    console.log("[TEST] ========== 所有测试通过！ ==========\n");
    console.log("[TEST] 测试结果总结:");
    console.log("[TEST]   ✓ 管理员账号查询成功");
    console.log("[TEST]   ✓ 密码验证功能正常");
    console.log("[TEST]   ✓ JWT Token 生成成功");
    console.log("[TEST]   ✓ 错误密码正确拒绝");
    console.log("[TEST]   ✓ 不存在用户正确处理");
    console.log("\n[TEST] 数据库迁移后的核心认证功能验证完成！\n");

  } catch (error) {
    console.error("[TEST] ✗ 测试失败:", error);
    process.exit(1);
  }
}

testSimpleLogin();
