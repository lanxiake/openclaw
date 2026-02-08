# 数据库迁移指南

## 概述

本项目使用 Drizzle ORM 进行数据库迁移管理。迁移文件位于 `src/db/migrations/` 目录。

## 迁移文件

当前迁移：
- `0000_wandering_the_spike.sql` - 初始数据库schema，包含23个表

## 执行迁移

### 1. 生成迁移文件

当你修改了 `src/db/schema/` 中的表定义后，运行以下命令生成迁移文件：

```bash
pnpm db:generate
```

这将：
1. 比较当前schema与数据库的差异
2. 在 `src/db/migrations/` 目录生成SQL迁移文件

### 2. 执行迁移

将迁移应用到数据库：

```bash
pnpm db:migrate
```

这将：
1. 连接到 `DATABASE_URL` 指定的数据库
2. 执行所有未应用的迁移文件
3. 更新数据库schema

### 3. 查看数据库

使用 Drizzle Studio 可视化查看数据库：

```bash
pnpm db:studio
```

## 环境变量

确保设置了正确的数据库连接字符串：

```bash
# .env
DATABASE_URL=postgresql://user:password@host:port/database
```

## 迁移到生产环境

**⚠️ 重要提示：在生产环境执行迁移前，请务必备份数据库！**

### 步骤：

1. **备份数据库**
   ```bash
   pg_dump -h 10.157.152.40 -p 22001 -U openclaw_admin openclaw_prod > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **测试迁移（可选）**

   在测试数据库上先执行一次迁移，确保没有问题：
   ```bash
   DATABASE_URL=postgresql://...test_db pnpm db:migrate
   ```

3. **执行生产迁移**
   ```bash
   DATABASE_URL=postgresql://openclaw_admin:Oc%402026!Pg%23Secure@10.157.152.40:22001/openclaw_prod pnpm db:migrate
   ```

4. **验证迁移**

   检查表结构是否正确：
   ```bash
   psql "postgresql://..." -c "\d users"
   psql "postgresql://..." -c "\d verification_codes"
   ```

## 当前Schema变更

从旧schema到新schema的主要变更：

### users表
- **旧**: id, phone, phone_hash, display_name, avatar_url, status, preferences, created_at, updated_at, last_login_at, deleted_at
- **新**: id, phone, email, wechatOpenId, wechatUnionId, passwordHash, displayName, avatarUrl, mfaSecret, mfaBackupCodes, mfaEnabled, isActive, emailVerified, phoneVerified, lastLoginAt, createdAt, updatedAt, preferences, metadata

### verification_codes表
- **旧**: id, phone_hash, code_hash, type, expires_at, verified_at, attempts, created_at
- **新**: id, target, targetType, code, purpose, expiresAt, used, attempts, createdAt

### user_sessions表
- **旧**: id, user_id, device_id, refresh_token_hash, expires_at, created_at, last_used_at, revoked_at, ip_address, user_agent
- **新**: id, userId, refreshTokenHash, userAgent, ipAddress, expiresAt, revoked, createdAt, lastRefreshedAt

## 故障排除

### 迁移失败

如果迁移失败，Drizzle会自动回滚事务。检查错误信息并修复问题后重新运行。

### 回滚迁移

Drizzle ORM 不支持自动回滚。如果需要回滚：

1. 从备份恢复数据库
2. 或手动编写回滚SQL并执行

### 查看迁移历史

Drizzle会在数据库中创建 `__drizzle_migrations` 表来跟踪已执行的迁移。

```sql
SELECT * FROM __drizzle_migrations;
```

## 开发工作流

1. 修改 `src/db/schema/*.ts` 文件
2. 运行 `pnpm db:generate` 生成迁移
3. 检查生成的SQL文件
4. 运行 `pnpm db:migrate` 应用迁移
5. 运行测试验证
6. 提交代码

## 相关文件

- `src/db/schema/` - 数据库表定义
- `src/db/migrations/` - 迁移SQL文件
- `scripts/db-migrate.ts` - 迁移执行脚本
- `drizzle.config.ts` - Drizzle配置
