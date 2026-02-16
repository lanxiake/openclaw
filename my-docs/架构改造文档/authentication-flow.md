# 认证流程架构

## 概述

OpenClaw 采用多层认证架构，支持用户认证、设备认证和管理员认证三种模式。

## 认证层次

```
┌─────────────────────────────────────────────────────────────┐
│                      认证架构层次                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Gateway 认证                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ Token 认证   │ │ 密码认证    │ │ Tailscale   │            │
│  │             │ │             │ │ 身份认证     │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│  ┌─────────────┐                                            │
│  │ Loopback    │                                            │
│  │ 绕过        │                                            │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: 用户/设备认证                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ JWT Token   │ │ 设备 Token  │ │ OAuth       │            │
│  │ (用户)      │ │ (设备)      │ │ (第三方)    │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: 权限控制                                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ 角色 (Role) │ │ 权限范围    │ │ 资源访问    │            │
│  │             │ │ (Scopes)    │ │ 控制        │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## 用户认证流程

### 1. 密码登录

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐
│ 用户输入  │───▶│ 验证密码      │───▶│ 生成 JWT     │
│ 账号密码  │    │ (scrypt)     │    │ Access Token │
└──────────┘    └──────────────┘    └──────┬───────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ 创建 Session │
                                   │ Refresh Token│
                                   └──────────────┘
```

### 2. 验证码登录

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐
│ 发送验证码│───▶│ 存储验证码    │───▶│ 用户输入     │
│ 请求     │    │ (5分钟有效)   │    │ 验证码       │
└──────────┘    └──────────────┘    └──────┬───────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ 验证并标记   │
                                   │ 已使用       │
                                   └──────┬───────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ 生成 Token   │
                                   └──────────────┘
```

### 3. Token 刷新

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Refresh Token│───▶│ 验证 Session │───▶│ 生成新 Token │
│ 请求        │    │ 有效性       │    │ 对           │
└──────────────┘    └──────────────┘    └──────────────┘
```

## 设备认证流程

### 1. 设备配对

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐
│ 设备发起  │───▶│ 创建配对请求  │───▶│ 等待用户批准 │
│ 配对请求  │    │ (5分钟有效)   │    │             │
└──────────┘    └──────────────┘    └──────┬───────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ 用户批准     │
                                   │ 分配角色权限 │
                                   └──────┬───────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ 颁发设备     │
                                   │ Token        │
                                   └──────────────┘
```

### 2. 设备认证

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 设备 Token   │───▶│ 验证 Token   │───▶│ 检查权限     │
│ 请求        │    │ 有效性       │    │ (Scopes)     │
└──────────────┘    └──────────────┘    └──────────────┘
```

## JWT Token 结构

### Access Token

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "usr_abc123",
    "iat": 1708084800,
    "exp": 1708088400,
    "type": "access"
  }
}
```

### Refresh Token

存储在数据库 `user_sessions` 表中，使用 SHA-256 哈希存储。

## 权限模型

### 角色 (Roles)

| 角色  | 说明     |
| ----- | -------- |
| user  | 普通用户 |
| admin | 管理员   |
| guest | 访客     |

### 权限范围 (Scopes)

| Scope | 说明     |
| ----- | -------- |
| read  | 读取数据 |
| write | 写入数据 |
| chat  | 聊天功能 |
| admin | 管理功能 |
| tools | 工具调用 |

## 安全措施

### 1. 密码安全

- 使用 scrypt 算法哈希密码
- 自动检测明文密码并哈希
- 密码最小长度 8 字符

### 2. Token 安全

- Access Token 有效期 1 小时
- Refresh Token 有效期 7 天
- 支持 Token 撤销

### 3. 设备安全

- 设备公钥加密通信
- 配对请求 5 分钟过期
- 支持设备撤销

### 4. 会话安全

- 记录登录 IP 和 User-Agent
- 支持单点登出
- 支持撤销所有会话

## 数据库表结构

### users 表

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT,
  avatar_url TEXT,
  wechat_open_id TEXT UNIQUE,
  wechat_union_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### user_sessions 表

```sql
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  revoked BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_refreshed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### user_devices 表

```sql
CREATE TABLE user_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  alias TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, device_id)
);
```

## 相关文件

- `src/assistant/auth/auth-service.ts` - 用户认证服务
- `src/assistant/auth/jwt.ts` - JWT 生成和验证
- `src/infra/device-pairing.ts` - 设备配对逻辑
- `src/db/repositories/users.ts` - 用户数据访问层
- `apps/api-server/src/plugins/auth.ts` - Fastify 认证插件
