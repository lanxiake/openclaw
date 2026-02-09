/**
 * 前后端联调自动化测试脚本
 *
 * 使用 Playwright 进行浏览器自动化测试
 */

import { chromium, Browser, Page } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

// 测试配置
const CONFIG = {
  frontendUrl: 'http://localhost:5173',
  gatewayUrl: 'http://localhost:18789',
  screenshotDir: './docs/screenshots',
  testResults: './docs/test-results.json',

  // 测试凭据
  userCredentials: {
    email: 'test@example.com',
    password: 'TestP@ssw0rd123',
  },
  adminCredentials: {
    username: 'testadmin',
    password: 'AdminP@ssw0rd123',
  },
};

// 测试结果
interface TestResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  screenshot?: string;
}

const testResults: TestResult[] = [];

/**
 * 保存截图
 */
async function saveScreenshot(page: Page, name: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  const filepath = path.join(CONFIG.screenshotDir, filename);

  await fs.mkdir(CONFIG.screenshotDir, { recursive: true });
  await page.screenshot({ path: filepath, fullPage: true });

  return filename;
}

/**
 * 记录测试结果
 */
function recordTest(result: TestResult) {
  testResults.push(result);
  const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
  console.log(`${icon} ${result.id}: ${result.name} (${result.duration}ms)`);
  if (result.error) {
    console.log(`   错误: ${result.error}`);
  }
}

/**
 * 执行单个测试用例
 */
async function runTest(
  id: string,
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  try {
    await testFn();
    recordTest({
      id,
      name,
      status: 'pass',
      duration: Date.now() - startTime,
    });
  } catch (error) {
    recordTest({
      id,
      name,
      status: 'fail',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 主测试流程
 */
async function main() {
  console.log('🚀 开始前后端联调自动化测试...\n');

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // 启动浏览器
    console.log('📊 步骤 1: 启动浏览器');
    browser = await chromium.launch({
      headless: false, // 显示浏览器窗口
      slowMo: 500, // 减慢操作速度，便于观察
    });
    page = await browser.newPage();
    console.log('✅ 浏览器启动成功\n');

    // ==================== 环境检查 ====================
    console.log('📋 阶段 1: 环境检查\n');

    await runTest('ENV-001', '检查 Gateway 服务健康状态', async () => {
      const response = await page!.goto(`${CONFIG.gatewayUrl}/health`);
      if (!response || !response.ok()) {
        throw new Error(`Gateway 服务不可用: ${response?.status()}`);
      }
    });

    await runTest('ENV-002', '检查前端应用可访问', async () => {
      const response = await page!.goto(CONFIG.frontendUrl);
      if (!response || !response.ok()) {
        throw new Error(`前端应用不可用: ${response?.status()}`);
      }
      await page!.waitForLoadState('networkidle');
    });

    console.log('');

    // ==================== 管理员登录测试 ====================
    console.log('📋 阶段 2: 管理员登录测试\n');

    await runTest('TC-ADMIN-001', '管理员登录 - 成功场景', async () => {
      // 访问登录页面
      await page!.goto(CONFIG.frontendUrl);
      await page!.waitForLoadState('networkidle');

      // 查找并填写用户名
      const usernameInput = page!.locator('input[placeholder="用户名"]');
      await usernameInput.waitFor({ state: 'visible' });
      await usernameInput.fill(CONFIG.adminCredentials.username);

      // 填写密码
      const passwordInput = page!.locator('input[placeholder="密码"]');
      await passwordInput.fill(CONFIG.adminCredentials.password);

      // 截图：登录前
      await saveScreenshot(page!, 'admin-login-before');

      // 点击登录按钮
      const loginButton = page!.locator('button:has-text("登录")');
      await loginButton.click();

      // 等待登录完成（跳转到仪表板）
      await page!.waitForURL(/dashboard/, { timeout: 10000 });

      // 截图：登录后
      await saveScreenshot(page!, 'admin-login-success');

      // 验证登录成功
      const url = page!.url();
      if (!url.includes('dashboard')) {
        throw new Error('登录后未跳转到仪表板');
      }
    });

    await runTest('TC-ADMIN-002', '管理员登录 - 错误密码', async () => {
      // 先登出
      await page!.goto(CONFIG.frontendUrl);
      await page!.waitForLoadState('networkidle');

      // 填写用户名
      const usernameInput = page!.locator('input[placeholder="用户名"]');
      await usernameInput.waitFor({ state: 'visible' });
      await usernameInput.fill(CONFIG.adminCredentials.username);

      // 填写错误密码
      const passwordInput = page!.locator('input[placeholder="密码"]');
      await passwordInput.fill('WrongPassword123');

      // 点击登录
      const loginButton = page!.locator('button:has-text("登录")');
      await loginButton.click();

      // 等待错误提示
      await page!.waitForTimeout(2000);

      // 截图：错误提示
      await saveScreenshot(page!, 'admin-login-error');

      // 验证仍在登录页面
      const url = page!.url();
      if (url.includes('dashboard')) {
        throw new Error('使用错误密码不应该登录成功');
      }

      // 验证有错误提示
      const errorToast = page!.locator('[role="alert"]');
      const hasError = await errorToast.count() > 0;
      if (!hasError) {
        throw new Error('未显示错误提示');
      }
    });

    console.log('');

    // ==================== Token 和会话测试 ====================
    console.log('📋 阶段 3: Token 和会话测试\n');

    await runTest('TC-ADMIN-003', '验证 Token 存储', async () => {
      // 先成功登录
      await page!.goto(CONFIG.frontendUrl);
      await page!.waitForLoadState('networkidle');

      const usernameInput = page!.locator('input[placeholder="用户名"]');
      await usernameInput.waitFor({ state: 'visible' });
      await usernameInput.fill(CONFIG.adminCredentials.username);

      const passwordInput = page!.locator('input[placeholder="密码"]');
      await passwordInput.fill(CONFIG.adminCredentials.password);

      const loginButton = page!.locator('button:has-text("登录")');
      await loginButton.click();

      await page!.waitForURL(/dashboard/, { timeout: 10000 });

      // 检查 localStorage 中的 Token
      const hasToken = await page!.evaluate(() => {
        const authData = localStorage.getItem('auth-storage');
        if (!authData) return false;

        try {
          const data = JSON.parse(authData);
          return !!(data.state?.accessToken && data.state?.refreshToken);
        } catch {
          return false;
        }
      });

      if (!hasToken) {
        throw new Error('Token 未正确存储到 localStorage');
      }
    });

    await runTest('TC-ADMIN-004', '管理员登出功能', async () => {
      // 查找登出按钮（可能在用户菜单中）
      const logoutButton = page!.locator('button:has-text("登出"), button:has-text("退出")').first();

      if (await logoutButton.count() > 0) {
        await logoutButton.click();
        await page!.waitForTimeout(2000);

        // 截图：登出后
        await saveScreenshot(page!, 'admin-logout');

        // 验证跳转到登录页
        const url = page!.url();
        if (url.includes('dashboard')) {
          throw new Error('登出后未跳转到登录页');
        }

        // 验证 Token 已清除
        const hasToken = await page!.evaluate(() => {
          const authData = localStorage.getItem('auth-storage');
          if (!authData) return false;

          try {
            const data = JSON.parse(authData);
            return !!(data.state?.accessToken);
          } catch {
            return false;
          }
        });

        if (hasToken) {
          throw new Error('登出后 Token 未清除');
        }
      } else {
        throw new Error('未找到登出按钮');
      }
    });

    console.log('');

    // ==================== 生成测试报告 ====================
    console.log('📊 生成测试报告...\n');

    const summary = {
      total: testResults.length,
      passed: testResults.filter(r => r.status === 'pass').length,
      failed: testResults.filter(r => r.status === 'fail').length,
      skipped: testResults.filter(r => r.status === 'skip').length,
      duration: testResults.reduce((sum, r) => sum + r.duration, 0),
      timestamp: new Date().toISOString(),
      results: testResults,
    };

    // 保存测试结果
    await fs.writeFile(
      CONFIG.testResults,
      JSON.stringify(summary, null, 2),
      'utf-8'
    );

    // 打印测试总结
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('测试总结:');
    console.log(`  总计: ${summary.total} 个测试用例`);
    console.log(`  ✅ 通过: ${summary.passed}`);
    console.log(`  ❌ 失败: ${summary.failed}`);
    console.log(`  ⏭️  跳过: ${summary.skipped}`);
    console.log(`  ⏱️  总耗时: ${summary.duration}ms`);
    console.log(`  📊 通过率: ${((summary.passed / summary.total) * 100).toFixed(1)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`📄 详细报告已保存到: ${CONFIG.testResults}`);
    console.log(`📸 截图已保存到: ${CONFIG.screenshotDir}`);
    console.log('');

    if (summary.failed > 0) {
      console.log('❌ 测试失败！请查看详细报告。');
      process.exit(1);
    } else {
      console.log('✅ 所有测试通过！');
    }

  } catch (error) {
    console.error('💥 测试执行出错:', error);
    if (page) {
      await saveScreenshot(page, 'error');
    }
    throw error;
  } finally {
    // 关闭浏览器
    if (browser) {
      await browser.close();
    }
  }
}

// 运行测试
main()
  .then(() => {
    console.log('🎉 测试脚本执行完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 测试脚本执行失败:', error);
    process.exit(1);
  });
