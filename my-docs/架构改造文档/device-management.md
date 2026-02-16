# 设备管理指南

## 概述

本指南介绍如何在 OpenClaw 中管理用户设备，包括设备配对、查看、更新和撤销等操作。

## 设备管理功能

### 1. 设备配对

用户可以将多个设备（手机、平板、电脑等）关联到自己的账户。

#### 配对步骤

1. **新设备发起配对请求**
   - 设备生成唯一 ID 和公钥
   - 调用 `POST /api/devices/pair-request`
   - 获取配对请求 ID

2. **用户批准配对**
   - 用户在已登录设备上收到配对通知
   - 确认设备信息后调用 `POST /api/devices/pair-approve`
   - 新设备获得认证令牌

3. **开始使用**
   - 新设备使用令牌进行后续认证
   - 设备自动关联到用户账户

#### 代码示例

```typescript
// 新设备发起配对
const pairResponse = await fetch("/api/devices/pair-request", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    deviceId: "my-device-001",
    publicKey: "-----BEGIN PUBLIC KEY-----...",
    displayName: "我的手机",
    platform: "iOS",
  }),
});

const { data } = await pairResponse.json();
console.log("配对请求 ID:", data.requestId);
// 等待用户在其他设备上批准...
```

```typescript
// 用户批准配对
const approveResponse = await fetch("/api/devices/pair-approve", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    requestId: "req_xyz789",
    role: "user",
    scopes: ["read", "write", "chat"],
  }),
});

const { data } = await approveResponse.json();
console.log("设备令牌:", data.deviceToken);
```

### 2. 查看设备列表

用户可以查看所有已关联的设备。

```typescript
const response = await fetch("/api/devices", {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

const { data } = await response.json();
console.log("我的设备:", data.devices);
```

#### 设备信息字段

| 字段         | 说明                                  |
| ------------ | ------------------------------------- |
| deviceId     | 设备唯一标识                          |
| alias        | 用户自定义别名                        |
| displayName  | 设备名称                              |
| platform     | 平台（iOS/Android/macOS/Windows/Web） |
| isPrimary    | 是否为主设备                          |
| linkedAt     | 关联时间                              |
| lastActiveAt | 最后活跃时间                          |
| role         | 设备角色                              |
| scopes       | 权限范围                              |

### 3. 更新设备信息

用户可以修改设备的别名和主设备状态。

```typescript
// 设置设备别名
await fetch("/api/devices/device-001", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    alias: "工作手机",
  }),
});

// 设置为主设备
await fetch("/api/devices/device-001", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    isPrimary: true,
  }),
});
```

### 4. 撤销设备

用户可以撤销不再使用的设备。

```typescript
await fetch("/api/devices/device-001", {
  method: "DELETE",
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

**注意**: 撤销设备后，该设备将无法再访问用户数据，需要重新配对。

## 主设备功能

每个用户可以设置一个主设备，主设备具有以下特点：

- 优先接收推送通知
- 在多设备冲突时优先处理
- 可以管理其他设备

### 设置主设备

```typescript
// 方式 1: 更新设备时设置
await fetch("/api/devices/device-001", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    isPrimary: true,
  }),
});

// 方式 2: 使用 UserDeviceRepository
const deviceRepo = getUserDeviceRepository();
await deviceRepo.setPrimaryDevice(userId, "device-001");
```

## 数据一致性

### 双存储架构

设备数据存储在两个位置：

1. **文件存储** (`device-pairing.ts`)
   - 存储设备公钥、令牌等敏感信息
   - 位置: `~/.openclaw/devices/`

2. **数据库存储** (`user_devices` 表)
   - 存储用户-设备关联关系
   - 支持快速查询

### 一致性检查

使用一致性检查工具确保两个存储的数据同步：

```bash
# 检查一致性
pnpm tsx scripts/check-device-user-consistency.ts

# 修复不一致
pnpm tsx scripts/check-device-user-consistency.ts --fix
```

### 常见不一致问题

| 问题类型           | 说明                   | 修复方式             |
| ------------------ | ---------------------- | -------------------- |
| missing_in_pairing | 数据库有记录但文件没有 | 删除数据库记录       |
| missing_in_db      | 文件有记录但数据库没有 | 创建数据库记录       |
| user_id_mismatch   | 用户 ID 不匹配         | 以数据库为准更新文件 |

## 安全建议

### 1. 定期检查设备

建议用户定期检查已关联的设备列表，撤销不再使用的设备。

### 2. 注意配对请求

- 只批准自己发起的配对请求
- 注意检查设备名称和平台信息
- 配对请求 5 分钟后自动过期

### 3. 保护主设备

- 主设备应设置屏幕锁
- 丢失主设备时立即撤销

## 故障排除

### 配对失败

1. 检查网络连接
2. 确认配对请求未过期（5 分钟有效）
3. 确认用户已登录

### 设备不显示

1. 检查数据一致性
2. 确认设备已成功配对
3. 刷新设备列表

### 权限不足

1. 检查设备角色和权限范围
2. 联系管理员调整权限
3. 重新配对设备

## 相关 API

| 端点                      | 方法   | 说明         |
| ------------------------- | ------ | ------------ |
| /api/devices              | GET    | 获取设备列表 |
| /api/devices/:deviceId    | PATCH  | 更新设备信息 |
| /api/devices/:deviceId    | DELETE | 撤销设备     |
| /api/devices/pair-request | POST   | 发起配对请求 |
| /api/devices/pair-approve | POST   | 批准配对     |
| /api/devices/pair-reject  | POST   | 拒绝配对     |

## 相关文档

- [设备配对 API 文档](./device-pairing.md)
- [认证流程架构](./authentication-flow.md)
- [用户注册 API 文档](./user-registration.md)
