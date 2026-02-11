/**
 * web-admin 连接测试 - 快速验证 WebSocket 握手
 */
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const CONFIG = {
  baseUrl: 'http://localhost:5173',
  edgePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  screenshotDir: 'D:\\AI-workspace\\openclaw\\test-browser\\screenshots',
};

async function main() {
  console.log('🚀 启动 Edge 浏览器测试 web-admin...');

  const browser = await chromium.launch({
    executablePath: CONFIG.edgePath,
    headless: false,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'zh-CN',
  });

  const consoleLogs = [];
  const page = await context.newPage();
  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  // 访问 web-admin 登录页
  await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  if (!existsSync(CONFIG.screenshotDir)) {
    mkdirSync(CONFIG.screenshotDir, { recursive: true });
  }
  await page.screenshot({ path: join(CONFIG.screenshotDir, 'web-admin-login.png'), fullPage: true });

  // 尝试登录
  const usernameInput = page.locator('input[name="username"], input[autocomplete="username"], input[type="text"]');
  const passwordInput = page.locator('input[name="password"], input[type="password"]');
  await usernameInput.first().fill('admin');
  await passwordInput.first().fill('Admin@123456');
  await page.screenshot({ path: join(CONFIG.screenshotDir, 'web-admin-form-filled.png') });

  const loginButton = page.locator('button[type="submit"], button:has-text("登录")');
  await loginButton.first().click();

  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(CONFIG.screenshotDir, 'web-admin-after-login.png') });

  const currentUrl = page.url();
  console.log(`\n当前 URL: ${currentUrl}`);
  console.log(`登录后是否跳转: ${!currentUrl.includes('/login')}`);

  // 打印所有 gateway 相关日志
  console.log('\n📋 Gateway 相关日志:');
  for (const log of consoleLogs) {
    if (log.text.includes('[gateway]') || log.text.includes('登录')) {
      const icon = log.type === 'error' ? '❌' : log.type === 'warning' ? '⚠️' : '📝';
      console.log(`  ${icon} [${log.type}] ${log.text}`);
    }
  }

  await browser.close();
}

main().catch(err => {
  console.error('💥 失败:', err.message);
  process.exit(1);
});
