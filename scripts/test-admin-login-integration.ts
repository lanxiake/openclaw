/**
 * 管理员登录集成测试
 *
 * 直接测试管理员认证服务，不依赖 Gateway
 */

import { config } from "dotenv";
import { adminLogin } from "../src/assistant/admin-auth/index.js";

// 加载环境变量
config();

async function testAdminLogin() {
  console.log("[TEST] ========== 管理员登录集成测试 ==========\n");

  try {
    // 1. 测试登录
    console.log("[TEST] 1. 测试管理员登录...");
    const username = "admin";
    const password = "Admin@123456";
    console.log(`[TEST]   - 用户名: ${username}`);
    console.log(`[TEST]   - 密码: ${password}`);

    const loginResult = await adminLogin({ username, password });

    if (!loginResult.success) {
      console.error("[TEST] ✗ 登录失败:", loginResult.error);
      console.error("[TEST]   错误代码:", loginResult.errorCode);
      process.exit(1);
    }

    console.log("[TEST] ✓ 登录成功!");
    console.log(`[TEST]   - 管理员ID: ${loginResult.admin?.id}`);
    console.log(`[TEST]   - 用户名: ${loginResult.admin?.username}`);
    console.log(`[TEST]   - 显示名称: ${loginResult.admin?.displayName}`);
    console.log(`[TEST]   - 角色: ${loginResult.admin?.role}`);
    console.log(`[TEST]   - 权限数量: ${loginResult.admin?.permissions.length}`);
    console.log(`[TEST]   - Access Token: ${loginResult.accessToken?.substring(0, 50)}...`);
    console.log(`[TEST]   - Refresh Token: ${loginResult.refreshToken?.substring(0, 50)}...`);
    console.log(`[TEST]   - 过期时间: ${loginResult.expiresIn}秒\n`);

    // 2. 测试错误密码
    console.log("[TEST] 2. 测试错误密码...");
    const wrongPasswordResult = await adminLogin({ username, password: "WrongPassword123" });

    if (wrongPasswordResult.success) {
      console.error("[TEST] ✗ 错误：错误密码应该登录失败");
      process.exit(1);
    }

    console.log("[TEST] ✓ 错误密码正确拒绝");
    console.log(`[TEST]   - 错误信息: ${wrongPasswordResult.error}`);
    console.log(`[TEST]   - 错误代码: ${wrongPasswordResult.errorCode}\n`);

    // 3. 测试不存在的用户
    console.log("[TEST] 3. 测试不存在的用户...");
    const nonExistentResult = await adminLogin({ username: "nonexistent", password });

    if (nonExistentResult.success) {
      console.error("[TEST] ✗ 错误：不存在的用户应该登录失败");
      process.exit(1);
    }

    console.log("[TEST] ✓ 不存在的用户正确拒绝");
    console.log(`[TEST]   - 错误信息: ${nonExistentResult.error}`);
    console.log(`[TEST]   - 错误代码: ${nonExistentResult.errorCode}\n`);

    console.log("[TEST] ========== 所有测试通过！ ==========\n");
  } catch (error) {
    console.error("[TEST] ✗ 测试失败:", error);
    process.exit(1);
  }
}

testAdminLogin();
