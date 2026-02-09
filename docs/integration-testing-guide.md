# 前后端联调测试指南

## 概述

本文档提供了完整的前后端联调测试步骤，用于验证用户认证和管理员认证功能。

## 前置条件

1. ✅ 数据库连接配置已在 `.env` 文件中
2. ✅ 认证服务单元测试已通过（87个测试用例）
3. ⚠️ 需要先应用数据库 Schema 迁移

## 步骤 1: 应用数据库迁移

由于当前数据库中某些字段长度限制（如 `id` 字段为 varchar(32)），需要先应用迁移脚本：

```bash
# 方式 1: 使用 psql 命令行工具
psql "postgresql://openclaw_admin:Oc%402026!Pg%23Secure@10.157.152.40:22001/openclaw_prod" -f src/db/migrations/0006_fix_all_schema_differences.sql

# 方式 2: 使用 Drizzle Kit
pnpm drizzle-kit push
```

迁移内容包括：
- 修复 `admins.failed_login_attempts` 类型（text → integer）
- 添加 `payment_orders.plan_id` 列
- 添加 `user_sessions.device_id` 列
- 修复其他类型不匹配问题

## 步骤 2: 创建测试账号

### 方式 A: 使用集成测试脚本（推荐）

```bash
bun run scripts/integration-test.ts
```

该脚本会自动：
1. 测试数据库连接
2. 创建测试用户账号
3. 创建测试管理员账号
4. 验证登录功能
5. 输出测试凭据

### 方式 B: 手动创建（如果脚本失败）

使用 psql 或数据库管理工具执行以下 SQL：

```sql
-- 创建测试用户
INSERT INTO users (
  id, email, password_hash, display_name,
  email_verified, is_active, created_at, updated_at
) VALUES (
  'test-user-001',
  'test@example.com',
  '$scrypt$16384$8$1$...',  -- TestP@ssw0rd123 的哈希值
  '测试用户',
  true,
  true,
  NOW(),
  NOW()
);

-- 创建测试管理员
INSERT INTO admins (
  id, username, password_hash, display_name,
  role, status, created_at, updated_at
) VALUES (
  'test-admin-001',
  'testadmin',
  '$scrypt$16384$8$1$...',  -- AdminP@ssw0rd123 的哈希值
  '测试管理员',
  'admin',
  'active',
  NOW(),
  NOW()
);
```

## 步骤 3: 启动后端 Gateway 服务

```bash
# 开发模式启动
pnpm dev:gateway

# 或者使用 npm
npm run dev:gateway
```

Gateway 服务默认监听端口：`18789`

验证服务启动：
```bash
curl http://localhost:18789/health
```

## 步骤 4: 启动前端 Web Admin 应用

```bash
cd apps/web-admin
pnpm install  # 首次运行需要安装依赖
pnpm dev
```

前端应用默认地址：`http://localhost:5173`

## 步骤 5: 前后端联调测试

### 5.1 测试用户登录流程

1. 打开浏览器访问：`http://localhost:5173`
2. 使用测试账号登录：
   - **邮箱**: `test@example.com`
   - **密码**: `TestP@ssw0rd123`
3. 验证登录成功后：
   - 检查是否获得 Access Token
   - 检查是否获得 Refresh Token
   - 检查用户信息是否正确显示

### 5.2 测试管理员登录流程

1. 访问管理员登录页面：`http://localhost:5173/admin/login`
2. 使用管理员账号登录：
   - **用户名**: `testadmin`
   - **密码**: `AdminP@ssw0rd123`
3. 验证登录成功后：
   - 检查管理员角色权限
   - 检查管理员菜单是否正确显示

### 5.3 测试 Token 刷新

1. 等待 Access Token 即将过期（默认 15 分钟）
2. 观察前端是否自动使用 Refresh Token 刷新
3. 验证刷新后的 Token 是否有效

### 5.4 测试登出功能

1. 点击登出按钮
2. 验证是否清除本地 Token
3. 验证是否撤销服务器端会话
4. 验证是否跳转到登录页面

## 步骤 6: 测试安全特性

### 6.1 测试登录失败限流

1. 使用错误密码连续登录 5 次
2. 验证账户是否被临时锁定
3. 验证锁定时间（15 分钟）

### 6.2 测试 IP 限流

1. 从同一 IP 使用不同账号连续失败登录 20 次
2. 验证 IP 是否被限制
3. 验证限制时间（1 小时）

### 6.3 测试账户状态

1. 测试已停用账户无法登录
2. 测试已锁定账户无法登录
3. 验证错误提示信息

## 测试凭据

### 用户账号
- **邮箱**: `test@example.com`
- **密码**: `TestP@ssw0rd123`

### 管理员账号
- **用户名**: `testadmin`
- **密码**: `AdminP@ssw0rd123`

## 常见问题

### Q1: 数据库连接失败
**解决方案**: 检查 `.env` 文件中的 `DATABASE_URL` 配置是否正确

### Q2: ID 字段长度错误
**解决方案**: 执行步骤 1 中的数据库迁移脚本

### Q3: Gateway 服务启动失败
**解决方案**:
1. 检查端口 18789 是否被占用
2. 检查环境变量是否正确加载
3. 查看错误日志

### Q4: 前端无法连接后端
**解决方案**:
1. 检查 Gateway 服务是否正常运行
2. 检查前端配置中的 API 地址
3. 检查浏览器控制台的网络请求

## 测试检查清单

- [ ] 数据库迁移已应用
- [ ] 测试账号已创建
- [ ] Gateway 服务正常运行
- [ ] 前端应用正常运行
- [ ] 用户登录功能正常
- [ ] 管理员登录功能正常
- [ ] Token 刷新功能正常
- [ ] 登出功能正常
- [ ] 登录失败限流正常
- [ ] IP 限流正常
- [ ] 账户状态检查正常

## 下一步

完成联调测试后，可以进行：
1. 性能测试
2. 压力测试
3. 安全渗透测试
4. 用户体验优化

## 相关文档

- [数据库 Schema 文档](../src/db/schema/README.md)
- [认证服务 API 文档](../src/assistant/auth/README.md)
- [管理员认证 API 文档](../src/assistant/admin-auth/README.md)
- [前端开发指南](../apps/web-admin/README.md)
