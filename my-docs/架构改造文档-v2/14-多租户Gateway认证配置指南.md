# 多租户 Gateway 认证配置指南

> 版本: 1.0 | 创建日期: 2026-02-17 | 状态: 实施完成

---

## 1. 背景

MtBot 采用多租户架构,每个用户的数据完全隔离。Gateway 需要识别用户身份以实现:

1. **租户隔离**: 用户只能访问自己的数据
2. **权限控制**: 基于用户身份进行操作授权
3. **配额管理**: 按用户统计和限制资源使用
4. **审计日志**: 记录用户的操作历史

## 2. 认证架构

### 2.1 双层认证机制

```
┌─────────────────────────────────────────────────────────────┐
│                    客户端 (Windows/iOS/Android)              │
│                                                             │
│  1. 用户登录 → API Server → 获得 accessToken (JWT)          │
│  2. 连接 Gateway → 传递 gateway.token (可选)                │
│  3. RPC 调用 → 自动附加 accessToken → Gateway 验证 JWT      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Gateway 认证层次                        │
│                                                             │
│  Layer 1: 连接层认证 (可选)                                  │
│  ├─ mode: "none"     → 无需认证 (开发环境)                   │
│  ├─ mode: "token"    → 固定 token (生产环境第一层防护)       │
│  └─ mode: "password" → 密码认证                             │
│                                                             │
│  Layer 2: 业务层认证 (必需)                                  │
│  └─ JWT Token 验证 → 提取 userId → 租户隔离                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 JWT Token 结构

**用户 Token (accessToken)**:

```json
{
  "sub": "user_abc123", // 用户 ID
  "type": "user", // Token 类型
  "email": "user@example.com", // 用户邮箱
  "phone": "+86138****1234", // 用户手机
  "planId": "plan_pro", // 订阅套餐 ID
  "planCode": "pro", // 套餐代码
  "iat": 1708156800, // 签发时间
  "exp": 1708243200 // 过期时间 (24小时)
}
```

**设备 Token (deviceToken)**:

```json
{
  "sub": "device_xyz789", // 设备 ID
  "type": "device", // Token 类型
  "userId": "user_abc123", // 所属用户
  "role": "user", // 设备角色
  "scopes": ["chat", "files"], // 权限范围
  "iat": 1708156800, // 签发时间
  "exp": 1708761600 // 过期时间 (7天)
}
```

---

## 3. 配置方案

### 3.1 开发环境配置 (推荐)

**Gateway 配置** (`~/.mtbot/mtbot.json`):

```json
{
  "gateway": {
    "port": 18789,
    "auth": {
      "mode": "none" // 开发环境不需要连接层认证
    }
  }
}
```

**Windows 客户端配置**:

```json
{
  "gateway": {
    "url": "ws://localhost:18789",
    "token": null, // 不配置 gateway token
    "autoConnect": true
  }
}
```

**认证流程**:

1. 用户登录 → 获得 `accessToken`
2. 连接 Gateway → 无需 token (mode: "none")
3. RPC 调用 → Gateway 验证 `accessToken` 中的 JWT

### 3.2 生产环境配置 (双层防护)

**Gateway 配置**:

```json
{
  "gateway": {
    "port": 18789,
    "auth": {
      "mode": "token",
      "token": "prod-gateway-secret-min-32-chars-xxxxx" // 第一层防护
    }
  }
}
```

**Windows 客户端配置**:

```json
{
  "gateway": {
    "url": "wss://gateway.example.com",
    "token": "prod-gateway-secret-min-32-chars-xxxxx", // 连接层 token
    "autoConnect": true
  }
}
```

**认证流程**:

1. 用户登录 → 获得 `accessToken`
2. 连接 Gateway → 验证 `gateway.token` (第一层)
3. RPC 调用 → 验证 `accessToken` JWT (第二层)

### 3.3 生产环境配置 (反向代理方案,推荐)

**架构**:

```
客户端 → Nginx/Caddy (TLS + 基础认证) → Gateway (mode: "none")
```

**Nginx 配置示例**:

```nginx
upstream gateway {
    server 127.0.0.1:18789;
}

server {
    listen 443 ssl http2;
    server_name gateway.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # WebSocket 支持
    location /ws {
        proxy_pass http://gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

**Gateway 配置**:

```json
{
  "gateway": {
    "port": 18789,
    "bind": "127.0.0.1", // 只监听本地
    "auth": {
      "mode": "none" // 由 Nginx 处理 TLS 和基础认证
    }
  }
}
```

---

## 4. 代码实现

### 4.1 Windows 客户端连接逻辑

**文件**: `apps/windows/src/renderer/App.tsx`

```typescript
useEffect(() => {
  if (!isAuthenticated || !accessToken || isConnected) {
    return;
  }

  const gatewayUrl = settings.gateway.url || "ws://localhost:18789";
  const gatewayToken = settings.gateway.token;

  console.log("[App] 连接 Gateway:", {
    url: gatewayUrl,
    hasGatewayToken: !!gatewayToken,
    hasAccessToken: !!accessToken,
  });

  // 连接选项: 如果配置了 gateway.token,使用它作为连接层认证
  const connectOptions = gatewayToken ? { token: gatewayToken } : undefined;

  connect(gatewayUrl, connectOptions).catch((err) => {
    console.error("[App] 连接失败:", err);
  });
}, [isAuthenticated, accessToken, isConnected, settings.gateway]);
```

### 4.2 Gateway JWT 验证逻辑

**文件**: `src/gateway/auth-context.ts`

```typescript
/**
 * 从 RPC 请求参数中提取用户认证上下文
 */
export function extractUserContext(params: Record<string, unknown>): UserAuthContext | null {
  // 优先从 Bearer Token 提取
  const authHeader = params["authorization"] as string | undefined;
  const token = extractBearerToken(authHeader);

  if (token) {
    const payload = verifyAccessToken(token); // 验证 JWT 签名和有效期
    if (payload) {
      return {
        userId: payload.sub, // 提取 userId 作为租户标识
        type: "user",
      };
    }
  }

  // 向后兼容: 从 userId 参数提取
  const userId = params["userId"] as string | undefined;
  if (userId && typeof userId === "string") {
    return { userId, type: "user" };
  }

  return null;
}
```

### 4.3 RPC 方法使用示例

**文件**: `src/gateway/server-methods/chat.ts`

```typescript
async function handleChatSend(params: ChatSendParams): Promise<ChatSendResponse> {
  // 1. 提取用户上下文
  const userContext = extractUserContext(params);
  if (!userContext) {
    throw new Error("未授权: 缺少有效的用户 Token");
  }

  // 2. 创建租户隔离的 Repository
  const conversationRepo = new ConversationRepository(db, userContext.userId);

  // 3. 查询用户的对话 (自动过滤 userId)
  const conversation = await conversationRepo.findById(params.conversationId);
  if (!conversation) {
    throw new Error("对话不存在或无权访问");
  }

  // 4. 执行业务逻辑...
}
```

---

## 5. 安全最佳实践

### 5.1 Token 管理

1. **JWT 密钥安全**:
   - 使用强随机密钥 (至少 256 位)
   - 密钥存储在环境变量中,不提交到代码仓库
   - 定期轮换密钥 (建议每 90 天)

2. **Token 过期时间**:
   - `accessToken`: 24 小时
   - `refreshToken`: 30 天
   - `deviceToken`: 7 天

3. **Token 刷新机制**:
   - 客户端在 Token 过期前 5 分钟自动刷新
   - 刷新失败时提示用户重新登录

### 5.2 连接层安全

1. **开发环境**:
   - 使用 `mode: "none"`,简化开发流程
   - 仅监听 `127.0.0.1`,不暴露到公网

2. **生产环境**:
   - 使用 TLS (wss://) 加密传输
   - 使用反向代理 (Nginx/Caddy) 处理 TLS 终止
   - 启用 IP 白名单或 VPN 访问控制

### 5.3 权限控制

1. **租户隔离**:
   - 所有数据查询必须带 `userId` 过滤
   - 使用 `TenantScopedRepository` 基类自动隔离

2. **操作审计**:
   - 记录所有敏感操作到 `admin_audit_logs`
   - 包含 `userId`, `action`, `resource`, `timestamp`

3. **配额限制**:
   - 按用户统计 API 调用次数
   - 超过配额时拒绝请求并返回友好提示

---

## 6. 故障排查

### 6.1 连接失败: "unauthorized: gateway token mismatch"

**原因**: Gateway 配置为 `mode: "token"`,但客户端未提供或提供了错误的 token。

**解决方案**:

1. **开发环境**: 修改 Gateway 配置为 `mode: "none"`

   ```json
   {
     "gateway": {
       "auth": {
         "mode": "none"
       }
     }
   }
   ```

2. **生产环境**: 在客户端配置中添加正确的 `gateway.token`
   ```json
   {
     "gateway": {
       "token": "与 Gateway 配置一致的 token"
     }
   }
   ```

### 6.2 RPC 调用失败: "未授权: 缺少有效的用户 Token"

**原因**: RPC 请求中未包含有效的 `accessToken`。

**解决方案**:

1. 检查用户是否已登录: `isAuthenticated === true`
2. 检查 `accessToken` 是否存在且未过期
3. 确认 RPC 调用时正确传递了 `authorization` 参数

### 6.3 数据查询返回空: "对话不存在或无权访问"

**原因**: 查询的数据不属于当前用户 (租户隔离生效)。

**解决方案**:

1. 确认 `userId` 提取正确
2. 检查数据库中的 `userId` 字段是否正确
3. 使用 `TenantScopedRepository` 确保自动过滤

---

## 7. 验收清单

- [ ] 开发环境 Gateway 配置为 `mode: "none"`
- [ ] Windows 客户端使用 `accessToken` 连接 Gateway
- [ ] RPC 方法正确提取 `userId` 并进行租户隔离
- [ ] 用户 A 无法访问用户 B 的数据
- [ ] Token 过期时自动刷新或提示重新登录
- [ ] 生产环境启用 TLS 和反向代理
- [ ] 审计日志记录所有敏感操作

---

_— 文档结束 —_
