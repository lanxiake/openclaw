# Feishu/Lark Channel Plugin for OpenClaw

飞书（Feishu）/ Lark 通讯渠道插件，支持通过飞书机器人 API 进行消息收发。

## 功能特性

- ✅ 文本消息发送和接收
- ✅ 图片上传和发送
- ✅ 文件上传和发送
- ✅ Webhook 实时消息接收
- ✅ 多账户支持
- ✅ DM 策略配置（pairing, allowlist, open, disabled）
- ✅ 自动 Token 管理和刷新
- ✅ 支持国际版（Lark）和中国版（Feishu）

## 安装

```bash
# 从 npm 安装
pnpm add @openclaw/feishu

# 或从本地开发
cd extensions/feishu
pnpm install
```

## 配置

### 1. 创建飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn)
2. 创建企业自建应用
3. 获取 **App ID** 和 **App Secret**
4. 在"事件订阅"中配置 Webhook URL
5. 获取 **Verification Token**（用于验证 Webhook 请求）

### 2. 配置 OpenClaw

运行交互式配置向导：

```bash
openclaw setup feishu
```

或手动编辑配置文件 `~/.openclaw/openclaw.json`：

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_xxxxxxxxxx",
      "appSecret": "your-app-secret",
      "verificationToken": "your-verification-token",
      "webhookUrl": "https://your-domain.com/feishu/webhook",
      "dmPolicy": "pairing",
      "allowFrom": ["ou_xxxxxx", "ou_yyyyyy"]
    }
  }
}
```

### 3. 环境变量（可选）

对于默认账户，可以使用环境变量：

```bash
export FEISHU_APP_ID="cli_xxxxxxxxxx"
export FEISHU_APP_SECRET="your-app-secret"
export FEISHU_VERIFICATION_TOKEN="your-verification-token"
```

## 配置选项

| 选项 | 类型 | 说明 |
|------|------|------|
| `appId` | string | 飞书应用 ID（必需） |
| `appSecret` | string | 飞书应用密钥（必需） |
| `verificationToken` | string | Webhook 验证令牌 |
| `encryptKey` | string | 消息加密密钥（可选） |
| `webhookUrl` | string | Webhook 完整 URL |
| `webhookPath` | string | Webhook 路径（如 `/feishu/webhook`） |
| `dmPolicy` | string | DM 策略：`pairing`, `allowlist`, `open`, `disabled` |
| `allowFrom` | array | 允许的用户 ID 列表 |
| `mediaMaxMb` | number | 媒体文件最大大小（MB） |
| `apiBase` | string | API 基础 URL（默认：`https://open.feishu.cn`） |

## 使用方法

### 发送消息

```bash
# 发送文本消息
openclaw message send feishu:ou_xxxxxx "Hello from OpenClaw!"

# 发送到群聊
openclaw message send feishu:oc_xxxxxx "Hello group!"
```

### 接收消息

配置 Webhook 后，机器人会自动接收用户发送的消息。

### 多账户支持

```json
{
  "channels": {
    "feishu": {
      "defaultAccount": "work",
      "accounts": {
        "work": {
          "name": "Work Bot",
          "appId": "cli_work_xxx",
          "appSecret": "work-secret"
        },
        "personal": {
          "name": "Personal Bot",
          "appId": "cli_personal_xxx",
          "appSecret": "personal-secret"
        }
      }
    }
  }
}
```

## Webhook 配置

### 1. 配置 Webhook URL

在飞书开放平台的"事件订阅"中配置：

```
https://your-domain.com/feishu/webhook
```

### 2. URL 验证

飞书会发送验证请求，插件会自动响应 `challenge` 完成验证。

### 3. 订阅事件

在飞书开放平台订阅以下事件：

- `im.message.receive_v1` - 接收消息

## 国际版（Lark）支持

如果使用国际版 Lark，需要配置 `apiBase`：

```json
{
  "channels": {
    "feishu": {
      "apiBase": "https://open.larksuite.com",
      "appId": "cli_xxxxxxxxxx",
      "appSecret": "your-app-secret"
    }
  }
}
```

## 故障排查

### 1. Token 获取失败

检查 App ID 和 App Secret 是否正确：

```bash
openclaw channels status feishu --probe
```

### 2. Webhook 验证失败

确保 `verificationToken` 配置正确，与飞书开放平台中的一致。

### 3. 消息发送失败

- 检查接收者 ID 格式（应为 `ou_xxx` 或 `oc_xxx`）
- 确认机器人有权限发送消息给该用户/群组

## API 参考

详细的飞书 API 文档请参考：

- [飞书开放平台文档](https://open.feishu.cn/document/)
- [机器人开发指南](https://open.feishu.cn/document/server-docs/bot-v3/bot-overview)

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 运行测试
pnpm test
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
