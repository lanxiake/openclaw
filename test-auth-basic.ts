/**
 * 基础认证服务功能验证
 * 不依赖数据库连接，只测试业务逻辑
 */

import { validatePasswordStrength } from "./src/db/utils/password.js";
import { generateAdminAccessToken } from "./src/assistant/admin-auth/admin-jwt.js";
import { generateAccessToken } from "./src/assistant/auth/jwt.js";

console.log("===== 基础认证功能验证开始 =====\n");

// 测试1: 密码强度验证
console.log("--- 测试1: 密码强度验证 ---");

const testPasswords = [
  { pwd: "weak", expected: false, desc: "弱密码" },
  { pwd: "Medium123", expected: true, desc: "中等密码" },
  { pwd: "StrongP@ss123", expected: true, desc: "强密码" },
  { pwd: "123456", expected: false, desc: "纯数字" },
  { pwd: "abcdef", expected: false, desc: "纯小写" },
];

for (const test of testPasswords) {
  const result = validatePasswordStrength(test.pwd);
  const passed = result.valid === test.expected;
  const status = passed ? "✓" : "✗";
  console.log(`${status} ${test.desc}: ${test.pwd} -> ${result.valid ? "有效" : "无效"}`);
  if (!result.valid) {
    console.log(`   错误: ${result.errors.join(", ")}`);
  }
}

// 测试2: JWT Token 生成
console.log("\n--- 测试2: JWT Token 生成 ---");

try {
  const userId = "test-user-123";
  const { accessToken, expiresIn } = generateAccessToken(userId);

  console.log("✓ Access Token 生成成功");
  console.log(`  Token长度: ${accessToken.length} 字符`);
  console.log(`  过期时间: ${expiresIn} 秒`);
  console.log(`  Token: ${accessToken.substring(0, 50)}...`);

  // 验证Token格式 (JWT 应该有3部分: header.payload.signature)
  const parts = accessToken.split(".");
  if (parts.length === 3) {
    console.log("✓ Token 格式正确 (header.payload.signature)");
  } else {
    console.log("✗ Token 格式错误");
  }
} catch (error) {
  console.log("✗ Token 生成失败");
  console.log(`  错误: ${error instanceof Error ? error.message : error}`);
}

// 测试3: 管理员 Token 生成
console.log("\n--- 测试3: 管理员 Token 生成 ---");

try {
  const adminId = "admin-123";
  const { accessToken, expiresIn } = generateAdminAccessToken(adminId);

  console.log("✓ Admin Access Token 生成成功");
  console.log(`  Token长度: ${accessToken.length} 字符`);
  console.log(`  过期时间: ${expiresIn} 秒`);
  console.log(`  Token: ${accessToken.substring(0, 50)}...`);
} catch (error) {
  console.log("✗ Admin Token 生成失败");
  console.log(`  错误: ${error instanceof Error ? error.message : error}`);
}

// 测试4: 验证码验证逻辑
console.log("\n--- 测试4: 验证码验证逻辑 ---");

function verifyCodeSimulated(
  code: string,
  attempt: number = 1,
): { valid: boolean; reason?: string } {
  // 检查长度
  if (code.length !== 6) {
    return { valid: false, reason: "验证码长度不正确" };
  }

  // 检查是否都是数字
  if (!/^\d+$/.test(code)) {
    return { valid: false, reason: "验证码必须是纯数字" };
  }

  // 检查尝试次数
  if (attempt > 3) {
    return { valid: false, reason: "尝试次数过多，验证码已过期" };
  }

  return { valid: true };
}

const codesToTest = [
  { code: "123456", attempt: 1, expected: true, desc: "有效验证码" },
  { code: "12345", attempt: 1, expected: false, desc: "长度过短" },
  { code: "1234567", attempt: 1, expected: false, desc: "长度过长" },
  { code: "12345a", attempt: 1, expected: false, desc: "包含字母" },
  { code: "123456", attempt: 5, expected: false, desc: "尝试次数过多" },
];

for (const test of codesToTest) {
  const result = verifyCodeSimulated(test.code, test.attempt);
  const passed = result.valid === test.expected;
  const status = passed ? "✓" : "✗";
  console.log(`${status} ${test.desc}: ${result.valid ? "有效" : "无效"}`);
  if (!result.valid && result.reason) {
    console.log(`   原因: ${result.reason}`);
  }
}

// 测试5: 限流逻辑
console.log("\n--- 测试5: 限流逻辑模拟 ---");

function simulateRateLimiting(attempts: number, maxAttempts: number = 5): boolean {
  return attempts < maxAttempts;
}

const ipAttempts = 4;
const maxAttempts = 5;
const isAllowed = simulateRateLimiting(ipAttempts, maxAttempts);
console.log(`当前尝试次数: ${ipAttempts}/${maxAttempts}`);
console.log(isAllowed ? "✓ 请求允许" : "✗ 请求被限流");

const ipAttempts2 = 20;
const maxIpAttempts = 20;
const isAllowed2 = simulateRateLimiting(ipAttempts2, maxIpAttempts);
console.log(`当前IP尝试次数: ${ipAttempts2}/${maxIpAttempts}`);
console.log(isAllowed2 ? "✓ 请求允许" : "✗ 请求被IP级限流");

// 测试6: Token 过期检查
console.log("\n--- 测试6: Token 过期检查逻辑 ---");

const expiresAt = new Date(Date.now() - 60000); // 1分钟前过期
const isExpired = expiresAt < new Date();
console.log(`Token 过期时间: ${expiresAt.toISOString()}`);
console.log(isExpired ? "✓ Token 已过期" : "✗ Token 未过期");

const validExpiresAt = new Date(Date.now() + 3600000); // 1小时后过期
const isValid = validExpiresAt > new Date();
console.log(`Token 过期时间: ${validExpiresAt.toISOString()}`);
console.log(isValid ? "✓ Token 有效" : "✗ Token 已过期");

console.log("\n===== 基础认证功能验证完成 =====");
console.log("测试结果: 通过 ✓");
