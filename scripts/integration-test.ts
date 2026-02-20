/**
 * 前后端联调测试脚本
 *
 * 用于验证数据库连接、创建测试数据、测试认证流程
 */

import { config } from "dotenv";
import { getDatabase } from "../src/db/connection.js";
import { getUserRepository, getAdminRepository } from "../src/db/index.js";
import { register, login } from "../src/assistant/auth/index.js";
import { adminLogin } from "../src/assistant/admin-auth/index.js";
import { sql } from "drizzle-orm";
import { hashPassword } from "../src/db/utils/password.js";

// 加载环境变量
config();

async function main() {
  console.log("🚀 开始前后端联调测试...\n");

  try {
    // 1. 测试数据库连接
    console.log("📊 步骤 1: 测试数据库连接");
    const db = getDatabase();
    const result = await db.execute(sql`SELECT NOW() as current_time`);
    console.log("✅ 数据库连接成功！");
    console.log("");

    // 2. 创建测试用户
    console.log("👤 步骤 2: 创建测试用户");
    const userRepo = getUserRepository();

    // 检查测试用户是否已存在
    let testUser = await userRepo.findByIdentifier("test@example.com");
    if (!testUser) {
      const passwordHash = await hashPassword("TestP@ssw0rd123");
      testUser = await userRepo.create({
        email: "test@example.com",
        passwordHash,
        displayName: "测试用户",
        emailVerified: true,
        isActive: true,
      });
      console.log("✅ 测试用户创建成功:", {
        id: testUser.id,
        email: testUser.email,
        displayName: testUser.displayName,
      });
    } else {
      console.log("ℹ️  测试用户已存在:", {
        id: testUser.id,
        email: testUser.email,
      });
    }
    console.log("");

    // 3. 测试用户登录
    console.log("🔐 步骤 3: 测试用户登录");
    const loginResult = await login({
      identifier: "test@example.com",
      password: "TestP@ssw0rd123",
      ipAddress: "127.0.0.1",
      userAgent: "Integration Test",
    });

    if (loginResult.success) {
      console.log("✅ 用户登录成功！");
      console.log("   Access Token:", loginResult.accessToken?.substring(0, 20) + "...");
      console.log("   Refresh Token:", loginResult.refreshToken?.substring(0, 20) + "...");
      console.log("   Expires In:", loginResult.expiresIn, "seconds");
    } else {
      console.log("❌ 用户登录失败:", loginResult.error);
    }
    console.log("");

    // 4. 创建测试管理员
    console.log("👨‍💼 步骤 4: 创建测试管理员");
    const adminRepo = getAdminRepository();

    // 检查测试管理员是否已存在
    let testAdmin = await adminRepo.findByUsername("testadmin");
    if (!testAdmin) {
      const passwordHash = await hashPassword("AdminP@ssw0rd123");
      testAdmin = await adminRepo.create({
        username: "testadmin",
        passwordHash,
        displayName: "测试管理员",
        email: "admin@example.com",
        role: "admin",
        status: "active",
      });
      console.log("✅ 测试管理员创建成功:", {
        id: testAdmin.id,
        username: testAdmin.username,
        displayName: testAdmin.displayName,
        role: testAdmin.role,
      });
    } else {
      console.log("ℹ️  测试管理员已存在:", {
        id: testAdmin.id,
        username: testAdmin.username,
        role: testAdmin.role,
      });
    }
    console.log("");

    // 5. 测试管理员登录
    console.log("🔐 步骤 5: 测试管理员登录");
    const adminLoginResult = await adminLogin({
      username: "testadmin",
      password: "AdminP@ssw0rd123",
      ipAddress: "127.0.0.1",
      userAgent: "Integration Test",
    });

    if (adminLoginResult.success) {
      console.log("✅ 管理员登录成功！");
      console.log("   Admin:", adminLoginResult.admin?.username);
      console.log("   Role:", adminLoginResult.admin?.role);
      console.log("   Access Token:", adminLoginResult.accessToken?.substring(0, 20) + "...");
      console.log("   Refresh Token:", adminLoginResult.refreshToken?.substring(0, 20) + "...");
    } else {
      console.log("❌ 管理员登录失败:", adminLoginResult.error);
    }
    console.log("");

    // 6. 输出测试凭据
    console.log("📋 测试凭据信息:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("用户账号:");
    console.log("  邮箱: test@example.com");
    console.log("  密码: TestP@ssw0rd123");
    console.log("");
    console.log("管理员账号:");
    console.log("  用户名: testadmin");
    console.log("  密码: AdminP@ssw0rd123");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    console.log("✅ 所有测试步骤完成！");
    console.log("");
    console.log("📝 下一步操作:");
    console.log("1. 启动后端 Gateway 服务: pnpm dev:gateway");
    console.log("2. 启动 Windows 客户端: cd apps/windows && pnpm dev");
    console.log("");
  } catch (error) {
    console.error("❌ 测试过程中出现错误:", error);
    if (error instanceof Error) {
      console.error("错误详情:", error.message);
      console.error("堆栈信息:", error.stack);
    }
    process.exit(1);
  }
}

// 运行测试
main()
  .then(() => {
    console.log("🎉 测试脚本执行完成！");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 测试脚本执行失败:", error);
    process.exit(1);
  });
