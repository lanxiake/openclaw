# Phase 0 实施计划：多用户认证与隔离基础改造

> 状态：实施中 | 创建日期：2026-02-22

## 1. 背景

OpenClaw Gateway 当前使用全局 token/password 认证，不区分用户。所有连接共享 `DEFAULT_USER_ID = "default"`。

DB 层（19 个 TenantScopedRepository）已全面支持 userId 隔离，但运行时（认证、Session Key、NodeRegistry）未启用用户维度。

## 2. 目标

- Device Token 为主认证方式，通过 deviceId 反查 userId
- Admin Console 使用 admin JWT 认证
- 移除 DEFAULT_USER_ID 回退和全局 token 认证（不保留回退开关）
- resolveAgentRoute 的 38+ 调用方留到 Phase 1

## 3. 实施步骤

### Step 1: 类型扩展（无破坏性变更）

| #   | 文件                                  | 行号  | 改动                                                                        | 状态 |
| --- | ------------------------------------- | ----- | --------------------------------------------------------------------------- | ---- |
| 1.1 | `src/gateway/auth.ts`                 | 15-20 | `GatewayAuthResult` 新增 `userId?` `deviceId?`，method 增加 `"admin-token"` | ✅   |
| 1.2 | `src/gateway/server/ws-types.ts`      | 9-25  | `GatewayWsClient` 新增 `deviceId?: string`                                  | ✅   |
| 1.3 | `src/gateway/server-methods/types.ts` | 21-35 | `GatewayClient` 新增 `deviceId?: string`                                    | ✅   |
| 1.4 | `src/gateway/user-context.ts`         | 17-36 | `AuthenticatedUser` 新增 `deviceId?: string`                                | ✅   |
| 1.5 | `src/gateway/node-registry.ts`        | 5-22  | `NodeSession` 新增 `userId?: string`                                        | ✅   |

**验证**：`pnpm build` 通过

---

### Step 2: 新增认证函数（新增代码，不修改现有逻辑）

| #   | 文件                                     | 改动                                                       | 状态 |
| --- | ---------------------------------------- | ---------------------------------------------------------- | ---- |
| 2.1 | `src/infra/device-pairing-db.ts:311-334` | `verifyDeviceToken` 返回值扩展：新增 `userId?` `deviceId?` | ⬜   |
| 2.2 | `src/gateway/auth.ts`                    | 新增 `authorizeDeviceConnect()` 函数                       | ⬜   |
| 2.3 | `src/gateway/auth.ts`                    | 新增 `authorizeAdminConnect()` 函数                        | ⬜   |

#### 2.1 verifyDeviceToken 返回值扩展

**当前返回**：`{ ok: boolean; reason?: string }`
**改为返回**：`{ ok: boolean; reason?: string; userId?: string; deviceId?: string }`

成功时从 DB 查询的 device 记录中提取 `device.userId`。

**测试用例**（先写测试）：

```
- 有效 token + 设备有 userId → { ok: true, userId: "u1", deviceId: "d1" }
- 有效 token + 设备无 userId → { ok: true, userId: undefined, deviceId: "d1" }
- 无效 token → { ok: false, reason: "..." }
```

#### 2.2 authorizeDeviceConnect

```typescript
export async function authorizeDeviceConnect(params: {
  deviceId: string;
  token: string;
  role?: string;
  scopes?: string[];
}): Promise<GatewayAuthResult> {
  const result = await verifyDeviceToken(params);
  if (!result.ok) {
    return { ok: false, method: "device-token", reason: result.reason ?? "device-token-invalid" };
  }
  if (!result.userId) {
    return { ok: false, method: "device-token", reason: "device-not-bound" };
  }
  return { ok: true, method: "device-token", userId: result.userId, deviceId: params.deviceId };
}
```

**测试用例**：

```
- 有效 token + 有 userId → { ok: true, userId, deviceId }
- 有效 token + 无 userId → { ok: false, reason: "device-not-bound" }
- 无效 token → { ok: false, reason: "device-token-invalid" }
```

#### 2.3 authorizeAdminConnect

```typescript
export async function authorizeAdminConnect(params: {
  adminToken: string;
}): Promise<GatewayAuthResult> {
  const payload = verifyAdminAccessToken(params.adminToken);
  if (!payload) {
    return { ok: false, method: "admin-token", reason: "admin-token-invalid" };
  }
  return { ok: true, method: "admin-token", userId: payload.sub, user: payload.sub };
}
```

**验证**：新函数单元测试全通过

---

### Step 3: 握手流程重构（核心变更，风险最高）

| #   | 文件                                                  | 行号                 | 改动                                                                     | 状态 |
| --- | ----------------------------------------------------- | -------------------- | ------------------------------------------------------------------------ | ---- |
| 3.1 | `src/gateway/protocol/schema/frames.ts`               | 55-65                | ConnectParams.auth 新增 `adminToken?: string`                            | ⬜   |
| 3.2 | `src/gateway/server/ws-connection/message-handler.ts` | 574-639              | 替换认证逻辑为 device-token 主路径                                       | ⬜   |
| 3.3 | 同上                                                  | 756-778              | 移除 userAuth.accessToken JWT 验证，改为认证后直接构建 authenticatedUser | ⬜   |
| 3.4 | 同上                                                  | 875-882              | GatewayWsClient 构建新增 `deviceId`                                      | ⬜   |
| 3.5 | `src/db/repositories/devices.ts`                      | update()             | Pick 类型新增 `userId`                                                   | ⬜   |
| 3.6 | `src/infra/device-pairing-db.ts`                      | approveDevicePairing | 审批后确保 device.userId 被设置                                          | ⬜   |

#### 3.2 认证流程替换（核心）

**当前流程**：

```
1. authorizeGatewayConnect (全局 token/password)
2. 失败 → 回退 verifyDeviceToken (device.id + auth.token)
3. 失败 → 回退 verifyDeviceToken (auth.deviceId + auth.token)
```

**新流程**：

```
路径 1: 有 device 签名 + auth.token
  → authorizeDeviceConnect(device.id, token)

路径 2: 无 device 签名 + auth.deviceId + auth.token
  → authorizeDeviceConnect(auth.deviceId, token)

路径 3: isControlUi + auth.adminToken
  → authorizeAdminConnect(adminToken)

以上都不匹配 → 如果有 device 签名走配对流程，否则拒绝
```

**关键变量**（新流程产出）：

```typescript
let authOk = false;
let authMethod: string | undefined;
let resolvedUserId: string | undefined;
let resolvedDeviceId: string | undefined;
```

#### 3.3 authenticatedUser 构建

移除 `userAuth.accessToken` JWT 验证（行 756-778），改为：

```typescript
let authenticatedUser: AuthenticatedUser | undefined;
if (resolvedUserId) {
  authenticatedUser = {
    userId: resolvedUserId,
    deviceId: resolvedDeviceId,
    authenticatedAt: new Date(),
  };
}
```

**验证**：手动测试三种连接方式

---

### Step 4: 移除 DEFAULT_USER_ID 回退

| #   | 文件                                    | 改动                                                   | 状态 |
| --- | --------------------------------------- | ------------------------------------------------------ | ---- |
| 4.1 | `src/routing/session-key.ts:13`         | DEFAULT_USER_ID 标记 `@deprecated`                     | ⬜   |
| 4.2 | `src/routing/session-key.ts:123-139`    | `normalizeUserId()` 空值/default 抛 Error              | ⬜   |
| 4.3 | `src/routing/session-key.ts:147-162`    | `buildUserAgentSessionKey()` 移除 DEFAULT_USER_ID 分支 | ⬜   |
| 4.4 | `src/routing/session-key.ts:170-186`    | `extractUserIdFromSessionKey()` 旧格式返回 undefined   | ⬜   |
| 4.5 | `src/gateway/chat-persistence.ts`       | 移除 DEFAULT_USER_ID 导入和回退                        | ⬜   |
| 4.5 | `src/gateway/todo-persistence.ts`       | 同上                                                   | ⬜   |
| 4.5 | `src/gateway/queue-persistence.ts`      | 同上                                                   | ⬜   |
| 4.5 | `src/gateway/checkpoint-persistence.ts` | 同上                                                   | ⬜   |
| 4.6 | `src/agents/user-context.ts`            | 移除 `isDefaultUser` 相关逻辑                          | ⬜   |

**验证**：`pnpm build && pnpm test` 通过

---

### Step 5: 方法层认证强化

| #   | 文件                                    | 改动                                   | 状态 |
| --- | --------------------------------------- | -------------------------------------- | ---- |
| 5.1 | `src/gateway/server-methods.ts:396-455` | `handleGatewayRequest()` 增加认证检查  | ⬜   |
| 5.2 | `src/gateway/node-registry.ts:44-80`    | `register()` 填充 `NodeSession.userId` | ⬜   |
| 5.3 | `src/gateway/node-registry.ts`          | 新增 `listConnectedByUser(userId)`     | ⬜   |

#### 5.1 认证豁免方法

```typescript
const AUTH_EXEMPT_PREFIXES = ["auth.", "admin."];
const AUTH_EXEMPT_METHODS = new Set(["connect", "heartbeat", "assistant.heartbeat"]);

function isAuthExempt(method: string): boolean {
  if (AUTH_EXEMPT_METHODS.has(method)) return true;
  return AUTH_EXEMPT_PREFIXES.some((p) => method.startsWith(p));
}
```

非豁免方法 + 无 `client.authenticatedUser.userId` → 返回错误。

**验证**：未认证 RPC 方法返回错误

---

### Step 6: Windows 客户端适配

| #   | 文件                                              | 改动                           | 状态 |
| --- | ------------------------------------------------- | ------------------------------ | ---- |
| 6.1 | `apps/windows/src/main/gateway-client.ts:334-396` | connect 帧用 Device Token 认证 | ⬜   |

确保 `auth.token` 来自 Device Token，`auth.deviceId` 来自已绑定设备。

**验证**：Windows 客户端正常连接

---

### Step 7: Admin Console 适配

| #   | 文件                                           | 改动                           | 状态 |
| --- | ---------------------------------------------- | ------------------------------ | ---- |
| 7.1 | `apps/admin-console/src/lib/gateway-client.ts` | connect 帧传 `auth.adminToken` | ⬜   |

**验证**：Admin Console 正常连接

---

## 4. 已有可复用代码

| 函数                             | 位置                                    | 用途                              |
| -------------------------------- | --------------------------------------- | --------------------------------- |
| `verifyDeviceToken()`            | `src/infra/device-pairing-db.ts:311`    | Device Token 验证（需扩展返回值） |
| `DeviceRepository.verifyToken()` | `src/db/repositories/devices.ts:173`    | DB 层 token 验证                  |
| `verifyAdminAccessToken()`       | `src/assistant/admin-auth/admin-jwt.ts` | Admin JWT 验证                    |
| `buildUserAgentSessionKey()`     | `src/routing/session-key.ts:147`        | Session Key 构建（需移除回退）    |
| `extractUserIdFromSessionKey()`  | `src/routing/session-key.ts:170`        | Session Key 解析（需调整返回值）  |
| `TenantScopedRepository`         | `src/db/repositories/tenant-scope.ts`   | DB 隔离基类                       |

## 5. 依赖关系

```
Step 1 (类型扩展) ← 无依赖
    ↓
Step 2 (认证函数) ← 依赖 Step 1.1 (GatewayAuthResult 类型)
    ↓
Step 3 (握手重构) ← 依赖 Step 2 全部
    ↓
Step 4 (移除 DEFAULT) ← 依赖 Step 3 (所有调用方已传入真实 userId)
    ↓
Step 5 (方法层强化) ← 依赖 Step 3
    ↓
Step 6 (Windows) ← 依赖 Step 3
    ↓
Step 7 (Admin Console) ← 依赖 Step 3.1
```

## 6. 最终验证

- [ ] `pnpm lint && pnpm build && pnpm test` 全通过
- [ ] Device Token 连接：authenticatedUser.userId 正确填充
- [ ] Admin JWT 连接：Admin Console 正常工作
- [ ] 无认证连接：被拒绝
- [ ] 非豁免 RPC：未认证时返回错误
- [ ] Session Key：包含 `user:{userId}:` 前缀
- [ ] NodeSession：包含 userId
- [ ] DEFAULT_USER_ID：不在运行时回退路径中
