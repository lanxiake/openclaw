/**
 * 测试密码哈希和验证
 */

import { hashPassword, verifyPassword } from "../src/db/utils/password.js";

async function testPasswordHashAndVerify() {
  console.log("[TEST] ========== 密码哈希和验证测试 ==========\n");

  try {
    const password = "Admin@123456";

    // 1. 测试哈希密码
    console.log("[TEST] 1. 哈希密码...");
    console.log(`[TEST]   - 原始密码: ${password}`);

    const hash1 = await hashPassword(password);
    console.log(`[TEST]   - 哈希1: ${hash1.substring(0, 50)}...`);

    const hash2 = await hashPassword(password);
    console.log(`[TEST]   - 哈希2: ${hash2.substring(0, 50)}...`);

    console.log(`[TEST]   - 两次哈希不同: ${hash1 !== hash2} (正常，因为使用随机盐)\n`);

    // 2. 测试验证密码
    console.log("[TEST] 2. 验证密码...");

    const isValid1 = await verifyPassword(password, hash1);
    console.log(`[TEST]   - 验证哈希1: ${isValid1 ? "✓ 成功" : "✗ 失败"}`);

    const isValid2 = await verifyPassword(password, hash2);
    console.log(`[TEST]   - 验证哈希2: ${isValid2 ? "✓ 成功" : "✗ 失败"}\n`);

    // 3. 测试错误密码
    console.log("[TEST] 3. 测试错误密码...");
    const wrongPassword = "WrongPassword123";

    const isWrong1 = await verifyPassword(wrongPassword, hash1);
    console.log(`[TEST]   - 错误密码验证: ${isWrong1 ? "✗ 错误通过" : "✓ 正确拒绝"}\n`);

    // 4. 测试数据库中的哈希
    console.log("[TEST] 4. 测试数据库中的哈希...");
    const dbHash = "$scrypt$16384$8$1$009ca1e68dc73ccd94ece84b0aaeca5d$b6ebe706772c09b2066fbfe3d2468d06d5180b1594f82c8c05ce12f65ffdae5a8c196ecefc0685cd0103ba7e62d46e80216014512b03222bb6a7a2839f738a15";

    console.log(`[TEST]   - 数据库哈希: ${dbHash.substring(0, 50)}...`);

    const isDbValid = await verifyPassword(password, dbHash);
    console.log(`[TEST]   - 验证数据库哈希: ${isDbValid ? "✓ 成功" : "✗ 失败"}\n`);

    if (!isValid1 || !isValid2 || isWrong1 || !isDbValid) {
      console.error("[TEST] ✗ 测试失败");
      process.exit(1);
    }

    console.log("[TEST] ========== 所有测试通过！ ==========\n");

  } catch (error) {
    console.error("[TEST] ✗ 测试失败:", error);
    process.exit(1);
  }
}

testPasswordHashAndVerify();
