# 飞书机器人 API 参考文档

## 概述

飞书（Feishu/Lark）是字节跳动旗下的企业协作平台。本文档整理了飞书机器人开发所需的核心 API 接口和配置要求。

## 认证方式

### 1. 应用凭证

飞书机器人使用以下凭证进行认证：

- **App ID**: 应用唯一标识符
- **App Secret**: 应用密钥
- **Verification Token**: 用于验证 webhook 请求的令牌
- **Encrypt Key**: 消息加密密钥（可选）

### 2. 获取 Access Token

**接口**: `POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/`

**请求体**:
```json
{
  "app_id": "cli_xxx",
  "app_secret": "xxx"
}
```

**响应**:
```json
{
  "code": 0,
  "msg": "success",
  "tenant_access_token": "t-xxx",
  "expire": 7200
}
```

## 消息接收（Webhook）

### 1. Webhook 配置

在飞书开放平台配置 Webhook URL，用于接收用户消息和事件。

### 2. 请求验证

飞书会发送 `url_verification` 类型的请求来验证 Webhook URL：

**请求体**:
```json
{
  "challenge": "ajls384kdjx98XX",
  "token": "xxxxxx",
  "type": "url_verification"
}
```

**响应**:
```json
{
  "challenge": "ajls384kdjx98XX"
}
```

### 3. 消息事件格式

**接收消息事件**:
```json
{
  "schema": "2.0",
  "header": {
    "event_id": "xxx",
    "event_type": "im.message.receive_v1",
    "create_time": "1608725989000",
    "token": "xxx",
    "app_id": "cli_xxx",
    "tenant_key": "xxx"
  },
  "event": {
    "sender": {
      "sender_id": {
        "union_id": "on_xxx",
        "user_id": "ou_xxx",
        "open_id": "ou_xxx"
      },
      "sender_type": "user",
      "tenant_key": "xxx"
    },
    "message": {
      "message_id": "om_xxx",
      "root_id": "om_xxx",
      "parent_id": "om_xxx",
      "create_time": "1609073151345",
      "chat_id": "oc_xxx",
      "chat_type": "p2p",
      "message_type": "text",
      "content": "{\"text\":\"hello world\"}"
    }
  }
}
```

## 消息发送

### 1. 发送文本消息

**接口**: `POST https://open.feishu.cn/open-apis/im/v1/messages`

**请求头**:
```
Authorization: Bearer t-xxx
Content-Type: application/json
```

**请求参数**:
- `receive_id_type`: 接收者 ID 类型（open_id, user_id, union_id, email, chat_id）
- `receive_id`: 接收者 ID

**请求体**:
```json
{
  "receive_id": "ou_xxx",
  "msg_type": "text",
  "content": "{\"text\":\"hello world\"}"
}
```

**响应**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "message_id": "om_xxx",
    "root_id": "om_xxx",
    "parent_id": "om_xxx",
    "msg_type": "text",
    "create_time": "1609073151345",
    "update_time": "1609073151345",
    "deleted": false,
    "updated": false,
    "chat_id": "oc_xxx",
    "sender": {
      "id": "cli_xxx",
      "id_type": "app_id",
      "sender_type": "app",
      "tenant_key": "xxx"
    },
    "body": {
      "content": "{\"text\":\"hello world\"}"
    }
  }
}
```

### 2. 支持的消息类型

- **text**: 文本消息
- **post**: 富文本消息
- **image**: 图片消息
- **file**: 文件消息
- **audio**: 音频消息
- **media**: 视频消息
- **sticker**: 表情包消息
- **interactive**: 交互式卡片消息
- **share_chat**: 分享群名片
- **share_user**: 分享用户名片

### 3. 发送图片消息

**步骤 1**: 上传图片获取 image_key

**接口**: `POST https://open.feishu.cn/open-apis/im/v1/images`

**请求头**:
```
Authorization: Bearer t-xxx
Content-Type: multipart/form-data
```

**请求体**:
```
image_type: message
image: <binary>
```

**响应**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "image_key": "img_xxx"
  }
}
```

**步骤 2**: 发送图片消息

**请求体**:
```json
{
  "receive_id": "ou_xxx",
  "msg_type": "image",
  "content": "{\"image_key\":\"img_xxx\"}"
}
```

### 4. 发送文件消息

**步骤 1**: 上传文件获取 file_key

**接口**: `POST https://open.feishu.cn/open-apis/im/v1/files`

**步骤 2**: 发送文件消息

**请求体**:
```json
{
  "receive_id": "ou_xxx",
  "msg_type": "file",
  "content": "{\"file_key\":\"file_xxx\"}"
}
```

## 消息回复

### 回复消息

**接口**: `POST https://open.feishu.cn/open-apis/im/v1/messages/{message_id}/reply`

**请求体**:
```json
{
  "msg_type": "text",
  "content": "{\"text\":\"reply content\"}"
}
```

## 事件订阅

### 常用事件类型

- `im.message.receive_v1`: 接收消息
- `im.message.message_read_v1`: 消息已读
- `im.chat.member.user.added_v1`: 用户加入群聊
- `im.chat.member.user.deleted_v1`: 用户退出群聊
- `application.bot.menu_v6`: 机器人菜单事件

## API 限流

- 租户级别限流：每个租户每分钟最多调用 1000 次
- 用户级别限流：每个用户每分钟最多调用 100 次

## 错误码

常见错误码：

- `0`: 成功
- `99991400`: 参数错误
- `99991401`: 无权限操作
- `99991403`: 应用未启用
- `99991663`: 租户 access token 无效
- `99991664`: 用户 access token 无效
- `99991668`: 应用 ticket 无效

## 开发环境

- **中国大陆**: `https://open.feishu.cn`
- **海外**: `https://open.larksuite.com`

## 参考链接

- 飞书开放平台: https://open.feishu.cn
- 机器人开发文档: https://open.feishu.cn/document/server-docs/bot-v3/bot-overview
- API 参考: https://open.feishu.cn/document/server-docs/api-call-guide/api-overview
