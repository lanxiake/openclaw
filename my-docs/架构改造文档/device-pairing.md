# 设备配对 API 文档

## 概述

设备配对模块允许用户将多个设备（手机、平板、电脑等）关联到自己的账户，实现跨设备的统一管理和认证。

## 核心概念

- **设备 ID (deviceId)**: 设备的唯一标识符
- **公钥 (publicKey)**: 设备的加密公钥，用于安全通信
- **配对请求 (PairingRequest)**: 设备发起的配对申请，有效期 5 分钟
- **设备令牌 (deviceToken)**: 配对成功后颁发的认证令牌

## API 端点

### 1. 发起配对请求

**POST** `/api/devices/pair-request`

设备发起配对请求，等待用户批准。

#### 请求头

```
Authorization: Bearer <accessToken>
```

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deviceId | string | 是 | 设备唯一标识 |
| publicKey | string | 是 | 设备公钥 |
| displayName | string | 否 | 设备名称 |
| platform | string | 否 | 平台：iOS / Android / macOS / Windows / Web |
| clientId | string | 否 | 客户端 ID |
| clientMode | string | 否 | 客户端模式 |
| role | string | 否 | 请求角色：user / admin / guest |
| scopes | string[] | 否 | 请求权限范围 |

#### 请求示例

```json
{
  "deviceId": "device-abc123",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...",
  "displayName": "我的 iPhone",
  "platform": "iOS",
  "role": "user",
  "scopes": ["read", "write"]
}
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "requestId": "req_xyz789",
    "status": "pending",
    "expiresAt": "2026-02-16T12:05:00.000Z"
  }
}
```

---

### 2. 批准配对请求

**POST** `/api/devices/pair-approve`

用户批准设备配对请求。

#### 请求头

```
Authorization: Bearer <accessToken>
```

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| requestId | string | 是 | 配对请求 ID |
| role | string | 否 | 分配角色（覆盖请求中的角色） |
| scopes | string[] | 否 | 分配权限（覆盖请求中的权限） |

#### 请求示例

```json
{
  "requestId": "req_xyz789",
  "role": "user",
  "scopes": ["read", "write", "chat"]
}
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "device": {
      "deviceId": "device-abc123",
      "userId": "usr_def456",
      "displayName": "我的 iPhone",
      "platform": "iOS",
      "role": "user",
      "scopes": ["read", "write", "chat"],
      "createdAt": "2026-02-16T12:00:00.000Z",
      "approvedAt": "2026-02-16T12:01:00.000Z"
    },
    "deviceToken": "dt_secret_token_here"
  }
}
```

---

### 3. 拒绝配对请求

**POST** `/api/devices/pair-reject`

用户拒绝设备配对请求。

#### 请求头

```
Authorization: Bearer <accessToken>
```

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| requestId | string | 是 | 配对请求 ID |
| reason | string | 否 | 拒绝原因 |

#### 请求示例

```json
{
  "requestId": "req_xyz789",
  "reason": "不认识此设备"
}
```

#### 响应示例

```json
{
  "success": true
}
```

---

### 4. 获取设备列表

**GET** `/api/devices`

获取当前用户的所有已配对设备。

#### 请求头

```
Authorization: Bearer <accessToken>
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "deviceId": "device-abc123",
        "userId": "usr_def456",
        "alias": "我的手机",
        "isPrimary": true,
        "linkedAt": "2026-02-16T12:01:00.000Z",
        "lastActiveAt": "2026-02-16T14:30:00.000Z",
        "displayName": "我的 iPhone",
        "platform": "iOS",
        "role": "user",
        "scopes": ["read", "write", "chat"]
      }
    ]
  }
}
```

---

### 5. 更新设备信息

**PATCH** `/api/devices/:deviceId`

更新设备的别名或主设备状态。

#### 请求头

```
Authorization: Bearer <accessToken>
```

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| alias | string | 否 | 设备别名 |
| isPrimary | boolean | 否 | 是否设为主设备 |

#### 请求示例

```json
{
  "alias": "工作手机",
  "isPrimary": true
}
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "device": {
      "deviceId": "device-abc123",
      "userId": "usr_def456",
      "alias": "工作手机",
      "isPrimary": true,
      "linkedAt": "2026-02-16T12:01:00.000Z",
      "lastActiveAt": "2026-02-16T14:30:00.000Z"
    }
  }
}
```

---

### 6. 撤销设备

**DELETE** `/api/devices/:deviceId`

撤销设备的配对关系。

#### 请求头

```
Authorization: Bearer <accessToken>
```

#### 响应示例

```json
{
  "success": true
}
```

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| UNAUTHORIZED | 未授权（需要登录） |
| FORBIDDEN | 无权操作此设备 |
| VALIDATION_ERROR | 参数校验失败 |
| REQUEST_NOT_FOUND | 配对请求不存在或已过期 |
| PAIR_REQUEST_ERROR | 配对请求失败 |
| PAIR_APPROVE_ERROR | 配对批准失败 |
| PAIR_REJECT_ERROR | 配对拒绝失败 |

---

## 配对流程图

```
┌─────────────────────────────────────────────────────────────┐
│                      设备配对流程                            │
└─────────────────────────────────────────────────────────────┘

┌──────────┐                              ┌──────────┐
│  新设备   │                              │  用户端   │
└────┬─────┘                              └────┬─────┘
     │                                         │
     │  1. POST /api/devices/pair-request      │
     │────────────────────────────────────────▶│
     │                                         │
     │  2. 返回 requestId, status: pending     │
     │◀────────────────────────────────────────│
     │                                         │
     │                                         │  3. 用户查看配对请求
     │                                         │     (推送通知/轮询)
     │                                         │
     │                                         │  4. 用户批准/拒绝
     │                                         │
     │  5. POST /api/devices/pair-approve      │
     │◀────────────────────────────────────────│
     │                                         │
     │  6. 返回 device + deviceToken           │
     │────────────────────────────────────────▶│
     │                                         │
     │  7. 设备使用 deviceToken 进行后续认证    │
     │                                         │
     ▼                                         ▼
```

---

## 数据存储

### 文件存储 (device-pairing.ts)

配对数据存储在 `~/.openclaw/devices/` 目录：

- `pending.json` - 待处理的配对请求
- `paired.json` - 已配对的设备信息

### 数据库存储 (user_devices 表)

用户-设备关联存储在 PostgreSQL：

```sql
CREATE TABLE user_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  alias TEXT,
  is_primary BOOLEAN DEFAULT FALSE NOT NULL,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_active_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, device_id)
);
```

---

## 相关文件

- `apps/api-server/src/routes/devices/index.ts` - 设备路由实现
- `src/infra/device-pairing.ts` - 设备配对核心逻辑
- `src/db/repositories/users.ts` - UserDeviceRepository
- `src/db/schema/users.ts` - user_devices 表定义
