# Gateway 配置数据库化实施方案

> 版本: 1.0 | 创建日期: 2026-02-17 | 状态: 设计完成,待实施

---

## 1. 背景与目标

### 1.1 当前问题

1. **配置文件不稳定**: JSON 文件容易损坏(Windows 路径转义问题)
2. **无法支持多租户**: 所有用户共享同一个配置文件
3. **配置管理困难**: 无法动态更新,需要重启服务
4. **缺少审计**: 无法追踪配置变更历史

### 1.2 改造目标

1. **配置持久化**: 将 Gateway 配置存储到 PostgreSQL 数据库
2. **多租户支持**: 系统配置 + 租户配置,租户配置优先
3. **动态更新**: 支持运行时更新配置,无需重启
4. **审计追踪**: 记录配置变更历史和操作者

---

## 2. 数据库设计

### 2.1 表结构

```sql
CREATE TABLE gateway_configs (
  id VARCHAR(32) PRIMARY KEY,

  -- 配置类型: 'system' (全局) 或 'tenant' (租户)
  config_type VARCHAR(20) NOT NULL DEFAULT 'system',

  -- 租户 ID (仅 tenant 类型)
  user_id VARCHAR(32) REFERENCES users(id) ON DELETE CASCADE,

  -- Gateway 基础配置
  gateway_mode VARCHAR(20) NOT NULL DEFAULT 'local', -- local, remote
  gateway_port INTEGER DEFAULT 18789,
  gateway_bind VARCHAR(50) DEFAULT 'loopback',

  -- 认证配置
  auth_mode VARCHAR(20) NOT NULL DEFAULT 'none', -- none, token, password
  auth_token VARCHAR(255), -- 仅开发环境使用
  auth_password VARCHAR(255),
  auth_allow_tailscale BOOLEAN DEFAULT FALSE,

  -- Control UI 配置
  control_ui_enabled BOOLEAN DEFAULT TRUE,
  control_ui_allow_insecure_auth BOOLEAN DEFAULT FALSE,

  -- Tailscale 配置
  tailscale_mode VARCHAR(20) DEFAULT 'off',
  tailscale_reset_on_exit BOOLEAN DEFAULT FALSE,

  -- 扩展配置 (JSON)
  extra_config JSONB,

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(32),
  updated_by VARCHAR(32),

  -- 约束
  CONSTRAINT gateway_configs_system_unique UNIQUE (config_type) WHERE config_type = 'system',
  CONSTRAINT gateway_configs_tenant_unique UNIQUE (user_id) WHERE config_type = 'tenant'
);
```

### 2.2 配置优先级

```
租户配置 (tenant) > 系统配置 (system) > 代码默认值
```

**示例**:
- 系统配置: `auth_mode = 'none'`
- 租户 A 配置: `auth_mode = 'token'`
- 租户 A 实际使用: `'token'` (租户配置优先)
- 租户 B 无配置: 使用系统配置 `'none'`

---

## 3. 代码实现

### 3.1 文件清单

| 文件 | 说明 | 状态 |
|------|------|------|
| `src/db/migrations/0007_add_gateway_configs.sql` | 数据库迁移文件 | ✅ 已创建 |
| `src/db/schema/gateway-configs.ts` | Drizzle ORM Schema | ✅ 已创建 |
| `src/db/repositories/gateway-configs.ts` | Repository 层 | ✅ 已创建 |
| `src/gateway/config-loader.ts` | 配置加载器 | ⬜ 待创建 |
| `apps/api-server/src/routes/gateway-config/` | 配置管理 API | ⬜ 待创建 |

### 3.2 Repository API

```typescript
import { GatewayConfigRepository } from './db/repositories/gateway-configs.js';

const repo = new GatewayConfigRepository(db);

// 获取系统配置
const systemConfig = await repo.getSystemConfig();

// 获取租户配置
const tenantConfig = await repo.getTenantConfig(userId);

// 获取有效配置 (租户优先)
const effectiveConfig = await repo.getEffectiveConfig(userId);

// 更新系统配置
await repo.upsertSystemConfig({
  authMode: 'none',
  gatewayMode: 'local',
}, 'admin_id');

// 更新租户配置
await repo.upsertTenantConfig(userId, {
  authMode: 'token',
  authToken: 'tenant_specific_token',
}, 'admin_id');
```

### 3.3 Gateway 配置加载器

```typescript
// src/gateway/config-loader.ts

import { getDatabase } from '../db/connection.js';
import { GatewayConfigRepository } from '../db/repositories/gateway-configs.js';

/**
 * 从数据库加载 Gateway 配置
 */
export async function loadGatewayConfigFromDatabase(userId?: string): Promise<GatewayConfig> {
  const db = getDatabase();
  const repo = new GatewayConfigRepository(db);

  // 获取有效配置 (租户优先)
  const config = await repo.getEffectiveConfig(userId);

  if (!config) {
    // 使用默认配置
    return {
      mode: 'local',
      port: 18789,
      bind: 'loopback',
      auth: {
        mode: 'none',
      },
      controlUi: {
        enabled: true,
        allowInsecureAuth: true,
      },
      tailscale: {
        mode: 'off',
      },
    };
  }

  // 转换数据库配置为 Gateway 配置格式
  return {
    mode: config.gatewayMode as 'local' | 'remote',
    port: config.gatewayPort || 18789,
    bind: config.gatewayBind as 'loopback' | 'tailnet' | '0.0.0.0',
    auth: {
      mode: config.authMode as 'none' | 'token' | 'password',
      token: config.authToken || undefined,
      password: config.authPassword || undefined,
      allowTailscale: config.authAllowTailscale || false,
    },
    controlUi: {
      enabled: config.controlUiEnabled !== false,
      allowInsecureAuth: config.controlUiAllowInsecureAuth || false,
    },
    tailscale: {
      mode: config.tailscaleMode as 'off' | 'serve',
      resetOnExit: config.tailscaleResetOnExit || false,
    },
  };
}
```

---

## 4. API 端点设计

### 4.1 管理员 API

```typescript
// GET /api/admin/gateway-config/system
// 获取系统配置
{
  "success": true,
  "data": {
    "id": "system_default",
    "configType": "system",
    "gatewayMode": "local",
    "authMode": "none",
    ...
  }
}

// PUT /api/admin/gateway-config/system
// 更新系统配置
{
  "gatewayMode": "local",
  "authMode": "none",
  "gatewayPort": 18789
}

// GET /api/admin/gateway-config/tenants
// 列出所有租户配置

// GET /api/admin/gateway-config/tenant/:userId
// 获取指定租户配置

// PUT /api/admin/gateway-config/tenant/:userId
// 更新租户配置

// DELETE /api/admin/gateway-config/tenant/:userId
// 删除租户配置 (恢复使用系统配置)
```

### 4.2 用户 API

```typescript
// GET /api/users/me/gateway-config
// 获取当前用户的有效配置 (租户配置或系统配置)
{
  "success": true,
  "data": {
    "gatewayUrl": "ws://localhost:18789",
    "authMode": "none",
    "controlUiEnabled": true
  }
}
```

---

## 5. 实施步骤

### Step 1: 数据库迁移 ✅

```bash
# 1. 启动 PostgreSQL (Docker 或本地)
docker-compose up -d postgres

# 2. 执行迁移
pnpm db:migrate

# 或手动执行
node scripts/migrate-gateway-config.mjs
```

### Step 2: 创建配置加载器 ⬜

```bash
# 创建文件
touch src/gateway/config-loader.ts

# 实现 loadGatewayConfigFromDatabase() 函数
```

### Step 3: 修改 Gateway 启动逻辑 ⬜

```typescript
// src/commands/gateway.ts

import { loadGatewayConfigFromDatabase } from '../gateway/config-loader.js';

async function startGateway() {
  // 从数据库加载配置
  const config = await loadGatewayConfigFromDatabase();

  // 启动 Gateway
  await startGatewayServer(config);
}
```

### Step 4: 创建配置管理 API ⬜

```bash
# 创建路由文件
mkdir -p apps/api-server/src/routes/gateway-config
touch apps/api-server/src/routes/gateway-config/index.ts

# 实现 CRUD 端点
```

### Step 5: 更新 Windows 客户端 ⬜

```typescript
// apps/windows/src/renderer/hooks/useSettings.ts

// 从 API Server 获取配置,而不是本地存储
async function fetchGatewayConfig() {
  const response = await window.electronAPI.api.getCurrentUser();
  return response.data.gatewayConfig;
}
```

### Step 6: 测试验证 ⬜

```bash
# 1. 测试系统配置
curl http://localhost:3000/api/admin/gateway-config/system

# 2. 测试租户配置
curl http://localhost:3000/api/admin/gateway-config/tenant/user_123

# 3. 测试配置优先级
# 4. 测试 Gateway 启动
# 5. 测试 Windows 客户端连接
```

---

## 6. 配置迁移方案

### 6.1 从文件迁移到数据库

```typescript
// scripts/migrate-config-to-db.mjs

import fs from 'fs';
import { getDatabase } from '../src/db/connection.js';
import { GatewayConfigRepository } from '../src/db/repositories/gateway-configs.js';

async function migrateConfigToDatabase() {
  // 1. 读取现有配置文件
  const configPath = '~/.openclaw/openclaw.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  // 2. 提取 Gateway 配置
  const gatewayConfig = config.gateway;

  // 3. 写入数据库
  const db = getDatabase();
  const repo = new GatewayConfigRepository(db);

  await repo.upsertSystemConfig({
    gatewayMode: gatewayConfig.mode,
    gatewayPort: gatewayConfig.port,
    gatewayBind: gatewayConfig.bind,
    authMode: gatewayConfig.auth.mode,
    authToken: gatewayConfig.auth.token,
    controlUiEnabled: gatewayConfig.controlUi.enabled,
    controlUiAllowInsecureAuth: gatewayConfig.controlUi.allowInsecureAuth,
    tailscaleMode: gatewayConfig.tailscale.mode,
  }, 'system');

  console.log('✅ 配置已迁移到数据库');
}
```

### 6.2 向后兼容

在过渡期,同时支持文件配置和数据库配置:

```typescript
async function loadGatewayConfig(userId?: string): Promise<GatewayConfig> {
  // 1. 尝试从数据库加载
  try {
    const dbConfig = await loadGatewayConfigFromDatabase(userId);
    if (dbConfig) {
      return dbConfig;
    }
  } catch (error) {
    console.warn('[Config] 数据库配置加载失败,回退到文件配置:', error);
  }

  // 2. 回退到文件配置
  return loadGatewayConfigFromFile();
}
```

---

## 7. 安全考虑

### 7.1 敏感信息加密

```typescript
// 存储前加密
import { encrypt, decrypt } from '../utils/crypto.js';

async function upsertSystemConfig(config) {
  if (config.authToken) {
    config.authToken = encrypt(config.authToken);
  }
  if (config.authPassword) {
    config.authPassword = encrypt(config.authPassword);
  }
  // ...
}

// 读取后解密
async function getSystemConfig() {
  const config = await repo.getSystemConfig();
  if (config.authToken) {
    config.authToken = decrypt(config.authToken);
  }
  // ...
}
```

### 7.2 权限控制

- **系统配置**: 仅超级管理员可修改
- **租户配置**: 管理员可修改任意租户,用户只能查看自己的配置
- **审计日志**: 记录所有配置变更

---

## 8. 优势总结

| 方面 | 文件配置 | 数据库配置 |
|------|---------|-----------|
| **稳定性** | ❌ 易损坏 | ✅ 事务保证 |
| **多租户** | ❌ 不支持 | ✅ 原生支持 |
| **动态更新** | ❌ 需重启 | ✅ 运行时更新 |
| **审计追踪** | ❌ 无 | ✅ 完整历史 |
| **权限控制** | ❌ 文件系统 | ✅ 数据库级别 |
| **备份恢复** | ❌ 手动 | ✅ 数据库备份 |
| **配置验证** | ❌ 运行时 | ✅ 数据库约束 |

---

## 9. 后续优化

1. **配置热更新**: 监听数据库变更,自动重载配置
2. **配置版本控制**: 记录配置变更历史,支持回滚
3. **配置模板**: 预定义常用配置模板
4. **配置导入导出**: 支持批量导入导出配置
5. **配置验证**: 在保存前验证配置的有效性

---

_— 文档结束 —_
