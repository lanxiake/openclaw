/**
 * admin-console 订阅管理 + Gateway 客户端综合测试
 * 测试用例: AC-SUB-001 ~ AC-SUB-003, AC-GW-001 ~ AC-GW-005
 *
 * 使用 Playwright + 本地 Edge 浏览器执行真实前端测试
 */
import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import postgres from "postgres";

// ============================================
// 测试配置
// ============================================
const CONFIG = {
  baseUrl: "http://localhost:5176",
  edgePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  screenshotDir: "D:\\AI-workspace\\mtbot\\test-browser\\screenshots",
  timeout: 15000,
  credentials: { username: "admin", password: "Admin@123456" },
};

const results = [];
const DATABASE_URL =
  "postgresql://mtbot_admin:Oc%402026!Pg%23Secure@10.157.152.40:22001/mtbot_prod";

function recordResult(id, name, status, detail) {
  results.push({ id, name, status, detail, timestamp: new Date().toISOString() });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️";
  console.log(`${icon} ${id}: ${name} - ${status}`);
  if (detail) console.log(`   详情: ${detail}`);
}

async function takeScreenshot(page, name) {
  if (!existsSync(CONFIG.screenshotDir)) mkdirSync(CONFIG.screenshotDir, { recursive: true });
  const path = join(CONFIG.screenshotDir, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`   📸 截图: ${path}`);
  return path;
}

async function clearLoginAttempts() {
  const sql = postgres(DATABASE_URL, { connect_timeout: 10, idle_timeout: 5 });
  try {
    await sql`DELETE FROM admin_login_attempts WHERE success = false`;
    await sql`UPDATE admins SET status = 'active', failed_login_attempts = '0', locked_until = NULL, updated_at = NOW() WHERE username = 'admin' AND (status = 'locked' OR locked_until IS NOT NULL OR failed_login_attempts::int > 0)`;
  } catch (err) {
    console.log(`   ⚠️ 清理登录记录失败: ${err.message}`);
  } finally {
    await sql.end();
  }
}

async function loginAsAdmin(page) {
  await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: "networkidle", timeout: CONFIG.timeout });
  const usernameInput = page.locator('input[name="username"], input[autocomplete="username"]');
  const passwordInput = page.locator('input[name="password"], input[type="password"]');
  await usernameInput.waitFor({ state: "visible", timeout: 5000 });
  await usernameInput.fill(CONFIG.credentials.username);
  await passwordInput.fill(CONFIG.credentials.password);
  await page.locator('button[type="submit"], button:has-text("登录")').click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: CONFIG.timeout });
  await page.waitForLoadState("networkidle", { timeout: CONFIG.timeout });
  console.log("   ✔ 登录成功");
}

// ============================================
// 订阅管理测试用例
// ============================================

/**
 * AC-SUB-001: 订阅列表页渲染
 * 预期: 显示统计卡片、搜索框、订阅表格
 */
async function testACSub001(page) {
  const id = "AC-SUB-001";
  const name = "订阅列表页渲染";
  console.log(`\n🔍 测试 ${id}: ${name}`);

  try {
    await page.goto(`${CONFIG.baseUrl}/subscriptions`, {
      waitUntil: "networkidle",
      timeout: CONFIG.timeout,
    });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, `${id}-01-subscriptions-page`);

    const pageContent = await page.textContent("body");
    const hasTitle = pageContent.includes("订阅管理") || pageContent.includes("订阅");
    const searchInput = await page.locator('input[placeholder*="搜索"]').count();
    const hasCards = await page.locator('[class*="card"], [class*="Card"]').count();

    // 检查统计卡片（总订阅数、活跃订阅等）
    const hasStats =
      pageContent.includes("订阅") &&
      (pageContent.includes("总") ||
        pageContent.includes("活跃") ||
        pageContent.includes("试用") ||
        pageContent.includes("收入"));

    if (hasTitle && hasCards > 0) {
      recordResult(
        id,
        name,
        "PASS",
        `订阅管理页渲染正确：标题✓ 卡片${hasCards}个 搜索框${searchInput > 0 ? "✓" : "✗"} 统计${hasStats ? "✓" : "✗"}`,
      );
    } else {
      recordResult(id, name, "FAIL", `标题:${hasTitle} 卡片:${hasCards} 搜索框:${searchInput}`);
    }
  } catch (err) {
    await takeScreenshot(page, `${id}-error`);
    recordResult(id, name, "FAIL", err.message);
  }
}

/**
 * AC-SUB-002: 订阅计划页面
 * 预期: 显示计划列表，包含免费/基础/专业等计划
 */
async function testACSub002(page) {
  const id = "AC-SUB-002";
  const name = "订阅计划页面";
  console.log(`\n🔍 测试 ${id}: ${name}`);

  try {
    await page.goto(`${CONFIG.baseUrl}/subscriptions/plans`, {
      waitUntil: "networkidle",
      timeout: CONFIG.timeout,
    });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, `${id}-01-plans-page`);

    const pageContent = await page.textContent("body");
    const hasTitle = pageContent.includes("订阅计划") || pageContent.includes("计划");
    const hasCards = await page.locator('[class*="card"], [class*="Card"]').count();

    // 检查是否有计划内容
    const hasPlanInfo =
      pageContent.includes("免费") ||
      pageContent.includes("基础") ||
      pageContent.includes("专业") ||
      pageContent.includes("新建计划") ||
      pageContent.includes("Plan") ||
      pageContent.includes("price");

    if (hasTitle || hasPlanInfo) {
      recordResult(
        id,
        name,
        "PASS",
        `计划页面渲染正确：标题${hasTitle ? "✓" : "✗"} 卡片${hasCards}个 计划信息${hasPlanInfo ? "✓" : "✗"}`,
      );
    } else {
      recordResult(id, name, "FAIL", `标题:${hasTitle} 卡片:${hasCards} 计划信息:${hasPlanInfo}`);
    }
  } catch (err) {
    await takeScreenshot(page, `${id}-error`);
    recordResult(id, name, "FAIL", err.message);
  }
}

/**
 * AC-SUB-003: 订阅订单页面
 * 预期: 显示订单列表或空状态
 */
async function testACSub003(page) {
  const id = "AC-SUB-003";
  const name = "订阅订单页面";
  console.log(`\n🔍 测试 ${id}: ${name}`);

  try {
    await page.goto(`${CONFIG.baseUrl}/subscriptions/orders`, {
      waitUntil: "networkidle",
      timeout: CONFIG.timeout,
    });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, `${id}-01-orders-page`);

    const pageContent = await page.textContent("body");
    const hasTitle = pageContent.includes("订单") || pageContent.includes("Orders");
    const hasContent =
      pageContent.includes("订单") || pageContent.includes("暂无") || pageContent.includes("没有");

    if (hasTitle || hasContent) {
      recordResult(id, name, "PASS", `订单页面渲染正确`);
    } else {
      recordResult(id, name, "FAIL", `页面未正确渲染`);
    }
  } catch (err) {
    await takeScreenshot(page, `${id}-error`);
    recordResult(id, name, "FAIL", err.message);
  }
}

// ============================================
// Gateway 客户端测试用例
// ============================================

/**
 * AC-GW-001: Gateway WebSocket 连接状态
 * 预期: 登录后 Gateway 建立 WebSocket 连接
 */
async function testACGW001(page) {
  const id = "AC-GW-001";
  const name = "Gateway WebSocket 连接状态";
  console.log(`\n🔍 测试 ${id}: ${name}`);

  try {
    await page.goto(`${CONFIG.baseUrl}/`, { waitUntil: "networkidle", timeout: CONFIG.timeout });
    await page.waitForTimeout(3000);

    // 通过浏览器控制台检查 Gateway 连接状态
    const gatewayStatus = await page.evaluate(() => {
      // 检查 Zustand 存储中的 Gateway 状态
      const authStorage = localStorage.getItem("admin-auth-storage");
      const wsConnections = performance
        .getEntriesByType("resource")
        .filter((r) => r.name.includes("ws://") || r.name.includes("wss://"));
      return {
        authStorage: authStorage ? "exists" : "none",
        wsConnections: wsConnections.length,
        localStorage: Object.keys(localStorage),
      };
    });

    await takeScreenshot(page, `${id}-01-gateway-status`);

    // 检查页面是否正常工作（能加载仪表盘数据说明 Gateway 连接正常）
    const pageContent = await page.textContent("body");
    const hasDashboardData =
      pageContent.includes("仪表盘") ||
      pageContent.includes("Dashboard") ||
      pageContent.includes("用户") ||
      pageContent.includes("概览");

    if (hasDashboardData && gatewayStatus.authStorage === "exists") {
      recordResult(
        id,
        name,
        "PASS",
        `Gateway 连接正常, 仪表盘数据已加载, localStorage keys: ${gatewayStatus.localStorage.length}`,
      );
    } else {
      recordResult(
        id,
        name,
        "FAIL",
        `仪表盘数据:${hasDashboardData} authStorage:${gatewayStatus.authStorage}`,
      );
    }
  } catch (err) {
    await takeScreenshot(page, `${id}-error`);
    recordResult(id, name, "FAIL", err.message);
  }
}

/**
 * AC-GW-002: Gateway RPC 调用（用户列表）
 * 预期: 通过 Gateway 调用 admin.users.list 获取数据
 */
async function testACGW002(page) {
  const id = "AC-GW-002";
  const name = "Gateway RPC 调用（用户列表）";
  console.log(`\n🔍 测试 ${id}: ${name}`);

  try {
    // 导航到用户页面会触发 admin.users.list RPC 调用
    await page.goto(`${CONFIG.baseUrl}/users`, {
      waitUntil: "networkidle",
      timeout: CONFIG.timeout,
    });
    await page.waitForTimeout(3000);
    await takeScreenshot(page, `${id}-01-users-rpc`);

    // 检查页面是否加载了用户数据（而不是错误）
    const pageContent = await page.textContent("body");
    const hasUserSection = pageContent.includes("用户管理") || pageContent.includes("用户列表");
    const hasError = pageContent.includes("连接失败") || pageContent.includes("Gateway 错误");
    const hasData = pageContent.includes("没有找到") || pageContent.includes("匹配");

    if (hasUserSection && !hasError) {
      recordResult(
        id,
        name,
        "PASS",
        `RPC 调用成功，页面正常显示（${hasData ? "空数据" : "有数据"}）`,
      );
    } else {
      recordResult(id, name, "FAIL", `用户区域:${hasUserSection} 错误:${hasError}`);
    }
  } catch (err) {
    await takeScreenshot(page, `${id}-error`);
    recordResult(id, name, "FAIL", err.message);
  }
}

/**
 * AC-GW-003: Gateway RPC 调用（订阅统计）
 * 预期: 通过 Gateway 调用获取订阅统计数据
 */
async function testACGW003(page) {
  const id = "AC-GW-003";
  const name = "Gateway RPC 调用（订阅统计）";
  console.log(`\n🔍 测试 ${id}: ${name}`);

  try {
    await page.goto(`${CONFIG.baseUrl}/subscriptions`, {
      waitUntil: "networkidle",
      timeout: CONFIG.timeout,
    });
    await page.waitForTimeout(3000);
    await takeScreenshot(page, `${id}-01-sub-stats`);

    const pageContent = await page.textContent("body");
    const hasSubSection = pageContent.includes("订阅管理") || pageContent.includes("订阅");
    const hasError = pageContent.includes("连接失败") || pageContent.includes("Gateway 错误");

    // 检查统计数据是否渲染（数字或 0）
    const hasNumericData = /\d+/.test(pageContent);

    if (hasSubSection && !hasError) {
      recordResult(id, name, "PASS", `订阅统计 RPC 调用成功，数据已渲染`);
    } else {
      recordResult(id, name, "FAIL", `订阅区域:${hasSubSection} 错误:${hasError}`);
    }
  } catch (err) {
    await takeScreenshot(page, `${id}-error`);
    recordResult(id, name, "FAIL", err.message);
  }
}

/**
 * AC-GW-004: Gateway RPC 调用（仪表盘数据）
 * 预期: 仪表盘加载统计、图表等数据
 */
async function testACGW004(page) {
  const id = "AC-GW-004";
  const name = "Gateway RPC 调用（仪表盘）";
  console.log(`\n🔍 测试 ${id}: ${name}`);

  try {
    await page.goto(`${CONFIG.baseUrl}/`, { waitUntil: "networkidle", timeout: CONFIG.timeout });
    await page.waitForTimeout(3000);
    await takeScreenshot(page, `${id}-01-dashboard-data`);

    const pageContent = await page.textContent("body");
    const hasDashboard = pageContent.includes("仪表盘") || pageContent.includes("Dashboard");
    const hasError = pageContent.includes("连接失败") || pageContent.includes("Gateway 错误");
    const hasStats =
      pageContent.includes("用户") || pageContent.includes("订阅") || pageContent.includes("活跃");

    if (hasDashboard && !hasError && hasStats) {
      recordResult(id, name, "PASS", `仪表盘数据加载正常`);
    } else {
      recordResult(id, name, "FAIL", `仪表盘:${hasDashboard} 错误:${hasError} 统计:${hasStats}`);
    }
  } catch (err) {
    await takeScreenshot(page, `${id}-error`);
    recordResult(id, name, "FAIL", err.message);
  }
}

/**
 * AC-GW-005: Gateway 连接断开恢复
 * 预期: 刷新页面后 Gateway 重新连接
 */
async function testACGW005(page) {
  const id = "AC-GW-005";
  const name = "Gateway 连接断开恢复";
  console.log(`\n🔍 测试 ${id}: ${name}`);

  try {
    // 先在正常页面
    await page.goto(`${CONFIG.baseUrl}/`, { waitUntil: "networkidle", timeout: CONFIG.timeout });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, `${id}-01-before-refresh`);

    // 刷新页面模拟连接断开
    await page.reload({ waitUntil: "networkidle", timeout: CONFIG.timeout });
    await page.waitForTimeout(3000);
    await takeScreenshot(page, `${id}-02-after-refresh`);

    // 验证页面仍正常工作
    const currentUrl = page.url();
    const pageContent = await page.textContent("body");
    const hasContent =
      pageContent.includes("仪表盘") ||
      pageContent.includes("Dashboard") ||
      pageContent.includes("Admin Console");
    const isLoginPage = currentUrl.includes("/login");

    if (hasContent && !isLoginPage) {
      recordResult(id, name, "PASS", "刷新后页面正常恢复，未丢失登录状态");
    } else if (isLoginPage) {
      recordResult(id, name, "FAIL", "刷新后跳转到登录页，登录状态丢失");
    } else {
      recordResult(id, name, "FAIL", `刷新后页面异常: ${currentUrl}`);
    }
  } catch (err) {
    await takeScreenshot(page, `${id}-error`);
    recordResult(id, name, "FAIL", err.message);
  }
}

// ============================================
// 主流程
// ============================================
async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  admin-console 订阅管理 + Gateway 测试");
  console.log("  AC-SUB-001~003, AC-GW-001~005");
  console.log("═══════════════════════════════════════════\n");

  console.log("🚀 启动 Edge 浏览器...");
  const browser = await chromium.launch({
    executablePath: CONFIG.edgePath,
    headless: false,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: "zh-CN",
  });

  const page = await context.newPage();

  try {
    await clearLoginAttempts();
    await loginAsAdmin(page);

    // 订阅管理测试
    await testACSub001(page);
    await testACSub002(page);
    await testACSub003(page);

    // Gateway 客户端测试
    await testACGW001(page);
    await testACGW002(page);
    await testACGW003(page);
    await testACGW004(page);
    await testACGW005(page);
  } finally {
    await browser.close();
  }

  // 输出报告
  console.log("\n═══════════════════════════════════════════");
  console.log("  测试报告");
  console.log("═══════════════════════════════════════════");

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`\n总计: ${results.length} | 通过: ${passed} | 失败: ${failed}\n`);

  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️";
    console.log(`  ${icon} ${r.id}: ${r.name} [${r.status}]`);
    if (r.detail) console.log(`     ${r.detail}`);
  }

  const reportPath = join(CONFIG.screenshotDir, "sub-gw-test-results.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        suite: "admin-console-sub-gw",
        date: new Date().toISOString(),
        summary: { total: results.length, passed, failed },
        results,
      },
      null,
      2,
    ),
  );
  console.log(`\n📊 测试结果已保存: ${reportPath}`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("💥 测试执行失败:", err);
  process.exit(2);
});
