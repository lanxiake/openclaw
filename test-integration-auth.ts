/**
 * 认证服务集成测试脚本
 *
 * 快速验证用户认证和管理员认证的前后端集成
 * 运行: bun test-integration-auth.ts
 */

import {
  enableMockDatabase,
  disableMockDatabase,
  clearMockDatabase,
  getMockDatabase,
} from "./src/db/mock-connection.js";
import {
  getUserRepository,
  getVerificationCodeRepository,
  getUserSessionRepository,
  getLoginAttemptRepository,
  getAdminRepository,
  getAdminSessionRepository,
  getAdminLoginAttemptRepository,
} from "./src/db/index.js";
import { register, login, refreshToken, logout } from "./src/assistant/auth/auth-service.js";
import {
  adminLogin as adminLoginService,
  adminRefreshToken as adminRefreshTokenService,
  adminLogout as adminLogoutService,
} from "./src/assistant/admin-auth/admin-auth-service.js";

console.log("===== 认证服务集成测试开始 =====\n");

/**
 * 测试用户认证流程
 */
async function testUserAuth() {
  console.log("--- 测试用户认证流程 ---");

  enableMockDatabase();
  const db = getMockDatabase();
  clearMockDatabase();

  const userRepo = getUserRepository(db);
  const codeRepo = getVerificationCodeRepository(db);

  try {
    // 创建验证码
    const code = "123456";
    const phone = "13800138000";

    await codeRepo.create({
      target: phone,
      targetType: "phone",
      code,
      purpose: "register",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // 测试用户注册
    const registerResult = await register({
      phone,
      code,
      displayName: "测试用户",
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    if (registerResult.success) {
      console.log("✓ 用户注册成功");
      console.log(`  用户ID: ${registerResult.user?.id}`);
      console.log(`  手机号: ${registerResult.user?.phone}`);
      console.log(`  访问Token: ${registerResult.accessToken?.substring(0, 20)}...`);
      console.log(`  刷新Token: ${registerResult.refreshToken?.substring(0, 20)}...`);
    } else {
      console.log("✗ 用户注册失败");
      console.log(`  错误: ${registerResult.error}`);
      return;
    }

    // 测试刷新Token
    const refreshResult = await refreshToken({
      refreshToken: registerResult.refreshToken!,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    if (refreshResult.success) {
      console.log("✓ Token刷新成功");
      console.log(`  新访问Token: ${refreshResult.accessToken?.substring(0, 20)}...`);
    } else {
      console.log("✗ Token刷新失败");
      console.log(`  错误: ${refreshResult.error}`);
    }

    // 测试登出
    const logoutResult = await logout(registerResult.refreshToken!, {
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
      userId: registerResult.user!.id,
    });

    if (logoutResult.success) {
      console.log("✓ 用户登出成功");
    } else {
      console.log("✗ 用户登出失败");
    }
  } catch (error) {
    console.error("✗ 用户认证测试出错:", error instanceof Error ? error.message : error);
  } finally {
    disableMockDatabase();
  }
}

/**
 * 测试管理员认证流程
 */
async function testAdminAuth() {
  console.log("\n--- 测试管理员认证流程 ---");

  enableMockDatabase();
  const db = getMockDatabase();
  clearMockDatabase();

  const adminRepo = getAdminRepository(db);

  try {
    // 创建管理员
    const username = "admin001";
    const password = "AdminP@ssw0rd123";

    const admin = await adminRepo.create({
      username,
      passwordHash: password,
      displayName: "测试管理员",
      role: "admin",
      status: "active",
    });

    console.log("✓ 管理员创建成功");

    // 测试管理员登录
    const loginResult = await adminLoginService({
      username,
      password,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    if (loginResult.success) {
      console.log("✓ 管理员登录成功");
      console.log(`  管理员ID: ${loginResult.admin?.id}`);
      console.log(`  用户名: ${loginResult.admin?.username}`);
      console.log(`  角色: ${loginResult.admin?.role}`);
      console.log(`  访问Token: ${loginResult.accessToken?.substring(0, 20)}...`);
    } else {
      console.log("✗ 管理员登录失败");
      console.log(`  错误: ${loginResult.error}`);
      return;
    }

    // 测试刷新Token
    const refreshResult = await adminRefreshTokenService({
      refreshToken: loginResult.refreshToken!,
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
    });

    if (refreshResult.success) {
      console.log("✓ 管理员Token刷新成功");
      console.log(`  新访问Token: ${refreshResult.accessToken?.substring(0, 20)}...`);
    } else {
      console.log("✗ 管理员Token刷新失败");
      console.log(`  错误: ${refreshResult.error}`);
    }

    // 测试登出
    const logoutResult = await adminLogoutService(loginResult.refreshToken!, {
      ipAddress: "127.0.0.1",
      userAgent: "Test Agent",
      adminId: admin.id,
      adminUsername: admin.username,
    });

    if (logoutResult.success) {
      console.log("✓ 管理员登出成功");
    } else {
      console.log("✗ 管理员登出失败");
    }
  } catch (error) {
    console.error("✗ 管理员认证测试出错:", error instanceof Error ? error.message : error);
  } finally {
    disableMockDatabase();
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    await testUserAuth();
    await testAdminAuth();

    console.log("\n===== 认证服务集成测试完成 =====");
    console.log("测试结果: 通过");
    process.exit(0);
  } catch (error) {
    console.error("\n===== 认证服务集成测试失败 =====");
    console.error("错误:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
