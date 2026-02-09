# 使用 MCP Playwright 进行前后端联调测试指南

## 概述

本指南说明如何使用 MCP (Model Context Protocol) Playwright 工具进行浏览器自动化测试。

---

## 前置条件

### 1. 确保所有服务已启动

```bash
# 检查前端应用
curl http://localhost:5173

# 检查 Gateway 服务
curl http://localhost:18789/health
```

### 2. 确保测试账号已创建

```bash
bun run scripts/integration-test.ts
```

---

## 使用 MCP Playwright 工具进行测试

### 步骤 1: 导航到登录页面

使用 `mcp__playwright__playwright_navigate` 工具：

```typescript
{
  url: "http://localhost:5173",
  width: 1920,
  height: 1080
}
```

**预期结果**: 浏览器打开并显示登录页面

---

### 步骤 2: 截图保存初始状态

使用 `mcp__playwright__playwright_screenshot` 工具：

```typescript
{
  name: "login-page-initial",
  width: 1920,
  height: 1080,
  savePng: true
}
```

**预期结果**: 截图保存到下载目录

---

### 步骤 3: 填写用户名

使用 `mcp__playwright__playwright_fill` 工具：

```typescript
{
  selector: 'input[placeholder="用户名"]',
  value: "testadmin"
}
```

**预期结果**: 用户名输入框填充完成

---

### 步骤 4: 填写密码

使用 `mcp__playwright__playwright_fill` 工具：

```typescript
{
  selector: 'input[placeholder="密码"]',
  value: "AdminP@ssw0rd123"
}
```

**预期结果**: 密码输入框填充完成

---

### 步骤 5: 截图登录前状态

使用 `mcp__playwright__playwright_screenshot` 工具：

```typescript
{
  name: "login-page-filled",
  width: 1920,
  height: 1080,
  savePng: true
}
```

---

### 步骤 6: 点击登录按钮

使用 `mcp__playwright__playwright_click` 工具：

```typescript
{
  selector: 'button:has-text("登录")'
}
```

**预期结果**: 提交登录请求

---

### 步骤 7: 等待页面跳转

等待 2-3 秒，让页面完成跳转和加载。

---

### 步骤 8: 截图登录后状态

使用 `mcp__playwright__playwright_screenshot` 工具：

```typescript
{
  name: "dashboard-after-login",
  width: 1920,
  height: 1080,
  savePng: true
}
```

**预期结果**: 显示仪表板页面

---

### 步骤 9: 验证 Token 存储

使用 `mcp__playwright__playwright_evaluate` 工具执行 JavaScript：

```typescript
{
  script: `
    const authData = localStorage.getItem('auth-storage');
    if (!authData) {
      return { success: false, error: 'No auth data found' };
    }

    try {
      const data = JSON.parse(authData);
      return {
        success: true,
        hasAccessToken: !!data.state?.accessToken,
        hasRefreshToken: !!data.state?.refreshToken,
        username: data.state?.user?.username
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  `
}
```

**预期结果**: 返回 Token 存储状态

---

## 测试用例清单

### TC-ADMIN-001: 管理员登录成功

**步骤**:
1. ✅ 导航到登录页面
2. ✅ 截图初始状态
3. ✅ 填写用户名: `testadmin`
4. ✅ 填写密码: `AdminP@ssw0rd123`
5. ✅ 截图填写后状态
6. ✅ 点击登录按钮
7. ✅ 等待跳转
8. ✅ 截图登录后状态
9. ✅ 验证 Token 存储

**验证点**:
- [ ] 页面 URL 包含 `/dashboard`
- [ ] localStorage 中存在 `accessToken`
- [ ] localStorage 中存在 `refreshToken`
- [ ] 显示用户信息

---

### TC-ADMIN-002: 错误密码登录

**步骤**:
1. ✅ 导航到登录页面
2. ✅ 填写用户名: `testadmin`
3. ✅ 填写密码: `WrongPassword123`
4. ✅ 点击登录按钮
5. ✅ 等待错误提示
6. ✅ 截图错误状态

**验证点**:
- [ ] 页面仍在登录页面
- [ ] 显示错误提示
- [ ] localStorage 中无 Token

---

### TC-ADMIN-003: 登出功能

**步骤**:
1. ✅ 先成功登录
2. ✅ 查找登出按钮
3. ✅ 点击登出按钮
4. ✅ 等待跳转
5. ✅ 截图登出后状态

**验证点**:
- [ ] 跳转到登录页面
- [ ] localStorage 中 Token 已清除

---

## MCP Playwright 工具参考

### 可用工具

1. **playwright_navigate** - 导航到 URL
   - `url`: 目标 URL
   - `width`: 视口宽度
   - `height`: 视口高度

2. **playwright_screenshot** - 截图
   - `name`: 截图文件名
   - `width`: 宽度
   - `height`: 高度
   - `savePng`: 是否保存为 PNG
   - `selector`: 可选，截取特定元素

3. **playwright_click** - 点击元素
   - `selector`: CSS 选择器

4. **playwright_fill** - 填写输入框
   - `selector`: CSS 选择器
   - `value`: 填写的值

5. **playwright_evaluate** - 执行 JavaScript
   - `script`: JavaScript 代码

6. **playwright_hover** - 悬停元素
   - `selector`: CSS 选择器

7. **playwright_select** - 选择下拉框
   - `selector`: CSS 选择器
   - `value`: 选择的值

---

## 常见选择器

### 登录页面
```css
/* 用户名输入框 */
input[placeholder="用户名"]
input[type="text"]

/* 密码输入框 */
input[placeholder="密码"]
input[type="password"]

/* 登录按钮 */
button:has-text("登录")
button[type="submit"]

/* 错误提示 */
[role="alert"]
.error-message
```

### 仪表板页面
```css
/* 用户菜单 */
button:has-text("testadmin")
[data-testid="user-menu"]

/* 登出按钮 */
button:has-text("登出")
button:has-text("退出")

/* 导航菜单 */
nav a
.sidebar a
```

---

## 测试结果记录

### 测试执行记录表

| 测试用例 | 状态 | 截图 | 备注 |
|---------|------|------|------|
| TC-ADMIN-001 | ☐ | login-page-initial.png<br>login-page-filled.png<br>dashboard-after-login.png |  |
| TC-ADMIN-002 | ☐ | login-error.png |  |
| TC-ADMIN-003 | ☐ | after-logout.png |  |

---

## 故障排查

### 问题 1: 无法连接到前端应用

**症状**: `net::ERR_CONNECTION_REFUSED`

**解决方案**:
```bash
# 检查前端是否启动
curl http://localhost:5173

# 如果未启动，启动前端
cd apps/web-admin && pnpm dev

# 等待启动完成（约 3-5 秒）
```

---

### 问题 2: 找不到元素

**症状**: `Element not found`

**解决方案**:
1. 先截图查看页面实际内容
2. 使用浏览器开发者工具检查元素
3. 调整选择器

---

### 问题 3: 登录失败

**症状**: 点击登录后无响应或报错

**解决方案**:
1. 检查 Gateway 服务是否启动
2. 检查测试账号是否已创建
3. 查看浏览器控制台日志

---

## 自动化测试脚本

如果需要完全自动化，可以使用以下脚本：

```bash
# 运行 E2E 自动化测试
bun run scripts/e2e-test.ts
```

该脚本会自动执行所有测试步骤并生成报告。

---

## 测试报告

测试完成后，结果将保存到：
- **测试结果**: `docs/test-results.json`
- **截图**: `docs/screenshots/`
- **控制台日志**: 通过 MCP Resource `console://logs` 访问

---

## 下一步

完成浏览器测试后：
1. 更新 `docs/integration-test-tracking.md`
2. 记录发现的问题
3. 生成最终测试报告
4. 如有缺陷，创建 Issue 跟踪

---

**最后更新**: 2026-02-09
**工具版本**: MCP Playwright
