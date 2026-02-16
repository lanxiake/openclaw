# 用户注册 API 文档

## 概述

用户注册模块提供手机号、邮箱和微信三种注册方式，支持验证码验证和自动登录。

## API 端点

### 1. 发送验证码

**POST** `/api/auth/send-verification-code`

发送手机或邮箱验证码。

#### 请求参数

| 参数    | 类型   | 必填   | 说明                                                   |
| ------- | ------ | ------ | ------------------------------------------------------ |
| phone   | string | 二选一 | 手机号（带国际区号，如 +86）                           |
| email   | string | 二选一 | 邮箱地址                                               |
| purpose | string | 否     | 用途：register / login / reset_password，默认 register |

#### 请求示例

```json
{
  "phone": "+8613800138000",
  "purpose": "register"
}
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "expiresAt": "2026-02-16T12:00:00.000Z",
    "expiresIn": 300
  }
}
```

---

### 2. 手机号注册

**POST** `/api/auth/register-by-phone`

使用手机号和验证码注册新用户。

#### 请求参数

| 参数             | 类型   | 必填 | 说明                                 |
| ---------------- | ------ | ---- | ------------------------------------ |
| phone            | string | 是   | 手机号（带国际区号）                 |
| verificationCode | string | 是   | 6位验证码                            |
| password         | string | 否   | 密码（可选，不设置则只能验证码登录） |
| displayName      | string | 否   | 显示名称                             |

#### 请求示例

```json
{
  "phone": "+8613800138000",
  "verificationCode": "123456",
  "password": "MyPassword123",
  "displayName": "张三"
}
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_abc123",
      "phone": "+8613800138000",
      "displayName": "张三",
      "createdAt": "2026-02-16T11:55:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "rt_xyz789...",
    "expiresIn": 3600
  }
}
```

---

### 3. 邮箱注册

**POST** `/api/auth/register-by-email`

使用邮箱和验证码注册新用户。

#### 请求参数

| 参数             | 类型   | 必填 | 说明                     |
| ---------------- | ------ | ---- | ------------------------ |
| email            | string | 是   | 邮箱地址                 |
| verificationCode | string | 是   | 6位验证码                |
| password         | string | 是   | 密码（邮箱注册必须设置） |
| displayName      | string | 否   | 显示名称                 |

#### 请求示例

```json
{
  "email": "user@example.com",
  "verificationCode": "654321",
  "password": "SecurePass456",
  "displayName": "李四"
}
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_def456",
      "email": "user@example.com",
      "displayName": "李四",
      "createdAt": "2026-02-16T11:56:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "rt_abc123...",
    "expiresIn": 3600
  }
}
```

---

### 4. 微信授权 URL

**GET** `/api/auth/wechat/authorize-url`

获取微信 OAuth 授权 URL。

#### 请求参数

| 参数        | 类型   | 必填 | 说明         |
| ----------- | ------ | ---- | ------------ |
| redirectUri | string | 是   | 授权回调地址 |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "authorizeUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?...",
    "state": "abc123"
  }
}
```

---

### 5. 微信注册

**POST** `/api/auth/wechat/register`

使用微信 OpenID 直接注册。

#### 请求参数

| 参数          | 类型   | 必填 | 说明         |
| ------------- | ------ | ---- | ------------ |
| wechatOpenId  | string | 是   | 微信 OpenID  |
| wechatUnionId | string | 否   | 微信 UnionID |
| displayName   | string | 否   | 显示名称     |
| avatarUrl     | string | 否   | 头像 URL     |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_ghi789",
      "wechatOpenId": "oXXXX...",
      "displayName": "微信用户",
      "createdAt": "2026-02-16T11:57:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "rt_def456...",
    "expiresIn": 3600
  }
}
```

---

## 错误码

| 错误码           | 说明                       |
| ---------------- | -------------------------- |
| VALIDATION_ERROR | 参数校验失败               |
| SEND_CODE_FAILED | 验证码发送失败             |
| REGISTER_FAILED  | 注册失败（如手机号已存在） |
| REGISTER_ERROR   | 注册异常                   |
| CONFIG_ERROR     | 配置错误（如微信未配置）   |

---

## 注册流程图

```
┌─────────────────────────────────────────────────────────────┐
│                      用户注册流程                            │
└─────────────────────────────────────────────────────────────┘

手机号注册:
┌──────────┐    ┌──────────────────┐    ┌──────────────────┐
│ 输入手机号 │───▶│ 发送验证码        │───▶│ 输入验证码+密码   │
└──────────┘    │ send-verification │    │ register-by-phone│
               │ -code             │    └────────┬─────────┘
               └──────────────────┘             │
                                                ▼
                                    ┌──────────────────┐
                                    │ 返回 Token       │
                                    │ 自动登录         │
                                    └──────────────────┘

邮箱注册:
┌──────────┐    ┌──────────────────┐    ┌──────────────────┐
│ 输入邮箱  │───▶│ 发送验证码        │───▶│ 输入验证码+密码   │
└──────────┘    │ send-verification │    │ register-by-email│
               │ -code             │    └────────┬─────────┘
               └──────────────────┘             │
                                                ▼
                                    ┌──────────────────┐
                                    │ 返回 Token       │
                                    │ 自动登录         │
                                    └──────────────────┘

微信注册:
┌──────────┐    ┌──────────────────┐    ┌──────────────────┐
│ 点击微信  │───▶│ 获取授权 URL      │───▶│ 微信授权页面     │
│ 登录按钮  │    │ wechat/authorize │    └────────┬─────────┘
└──────────┘    │ -url             │             │
               └──────────────────┘             ▼
                                    ┌──────────────────┐
                                    │ 回调处理         │
                                    │ wechat/callback  │
                                    └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │ 返回 Token       │
                                    │ 自动登录         │
                                    └──────────────────┘
```

---

## 相关文件

- `apps/api-server/src/routes/auth/registration.ts` - 注册路由实现
- `src/services/user-registration-service.ts` - 注册业务逻辑
- `src/services/verification-code-service.ts` - 验证码服务
- `src/db/repositories/users.ts` - 用户数据访问层
