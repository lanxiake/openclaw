# OpenClaw 微信渠道扩展设计方案

## 背景

基于 wxauto（Python Windows UIAutomation 库）为 OpenClaw 添加微信通讯支持，实现双向消息通讯。

---

## 方案：WebSocket 反向连接架构

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Windows 机器                            │
│  ┌─────────────────┐                  ┌──────────────────┐  │
│  │  wxauto-bridge  │ ──WebSocket───► │   OpenClaw       │  │
│  │  (Python Client)│    连接          │   Gateway        │  │
│  │                 │                  │   (Node.js)      │  │
│  │  wxauto library │ ◄──JSON-RPC────  │                  │  │
│  │       ↓         │    命令          │ extensions/      │  │
│  │  微信 Windows   │                  │   wechat/        │  │
│  │  客户端 (3.9.x) │ ───消息推送────► │                  │  │
│  └─────────────────┘                  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 核心变化

| 对比项       | 原方案                 | 新方案                     |
| ------------ | ---------------------- | -------------------------- |
| **服务端**   | wxauto-bridge (Python) | OpenClaw Gateway (Node.js) |
| **客户端**   | OpenClaw 插件          | wxauto-bridge (Python)     |
| **连接方向** | OpenClaw → Bridge      | Bridge → OpenClaw          |
| **协议**     | HTTP + WebSocket       | 纯 WebSocket (JSON-RPC)    |

### 优势

1. **简化 Python 端**：wxauto-bridge 只需实现 WebSocket 客户端，无需 HTTP 服务器
2. **复用网关能力**：OpenClaw Gateway 已有 WebSocket 基础设施
3. **统一管理**：所有渠道连接都由 OpenClaw 管理
4. **易于部署**：用户只需运行一个 Python 脚本连接到 OpenClaw

---

## 通讯协议设计

### WebSocket 连接

```
ws://localhost:18789/channels/wechat
```

### 消息格式（JSON-RPC 2.0）

**Bridge → OpenClaw（入站消息）**：

```json
{
  "jsonrpc": "2.0",
  "method": "wechat.message",
  "params": {
    "from": "张三",
    "to": "我",
    "text": "你好",
    "type": "text",
    "timestamp": 1706694000000,
    "chatType": "friend"
  }
}
```

**OpenClaw → Bridge（发送命令）**：

```json
{
  "jsonrpc": "2.0",
  "id": "msg-001",
  "method": "send",
  "params": {
    "to": "张三",
    "text": "收到，谢谢！",
    "files": []
  }
}
```

**Bridge → OpenClaw（命令响应）**：

```json
{
  "jsonrpc": "2.0",
  "id": "msg-001",
  "result": {
    "ok": true,
    "msgId": "wx-12345"
  }
}
```

### 支持的方法

| 方向        | 方法               | 说明           |
| ----------- | ------------------ | -------------- |
| OC → Bridge | `send`             | 发送消息       |
| OC → Bridge | `sendFile`         | 发送文件       |
| OC → Bridge | `getStatus`        | 获取微信状态   |
| OC → Bridge | `getContacts`      | 获取联系人列表 |
| OC → Bridge | `addListen`        | 添加聊天监听   |
| OC → Bridge | `removeListen`     | 移除聊天监听   |
| Bridge → OC | `wechat.message`   | 推送新消息     |
| Bridge → OC | `wechat.status`    | 状态变更通知   |
| Bridge → OC | `wechat.connected` | 连接成功通知   |

---

## 通讯流程

### 启动流程

```
1. 用户启动 OpenClaw Gateway
   $ openclaw gateway run --port 18789

2. 用户启动微信客户端并登录

3. 用户运行 wxauto-bridge
   $ python bridge.py --gateway ws://localhost:18789

4. Bridge 连接到 Gateway WebSocket
   → ws://localhost:18789/channels/wechat

5. Bridge 发送连接成功通知
   → { "method": "wechat.connected", "params": { "nickname": "我的微信" } }

6. OpenClaw 更新渠道状态为 "connected"
```

### 出站消息流程（OpenClaw → 微信）

```
Agent/用户发送消息
    ↓
wechat plugin.outbound.sendText("张三", "你好")
    ↓
通过 WebSocket 发送 JSON-RPC 请求
    { "method": "send", "params": { "to": "张三", "text": "你好" } }
    ↓
wxauto-bridge 收到请求
    ↓
调用 wx.SendMsg("你好", who="张三")
    ↓
返回结果
    { "result": { "ok": true } }
```

### 入站消息流程（微信 → OpenClaw）

```
微信客户端收到消息
    ↓
wxauto 监听器触发回调
    def on_message(msg, chat):
        ...
    ↓
wxauto-bridge 通过 WebSocket 推送
    { "method": "wechat.message", "params": { "from": "张三", "text": "收到" } }
    ↓
OpenClaw Gateway 收到消息
    ↓
路由到 Agent 处理
    ↓
Agent 生成回复
    ↓
通过 outbound 发送回复
```

---

## 组件实现

### 1. OpenClaw 插件 (`extensions/wechat/`)

```typescript
// src/channel.ts
export const wechatPlugin: ChannelPlugin = {
  id: "wechat",
  meta: {
    id: "wechat",
    label: "WeChat",
    selectionLabel: "WeChat (wxauto)",
    docsPath: "/channels/wechat",
    blurb: "Personal WeChat via wxauto bridge",
  },

  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
  },

  config: {
    listAccountIds: (cfg) => ["default"],
    resolveAccount: (cfg, accountId) => ({
      accountId: accountId ?? "default",
      enabled: cfg.channels?.wechat?.enabled !== false,
      config: cfg.channels?.wechat ?? {},
    }),
  },

  outbound: {
    deliveryMode: "gateway",  // 通过网关发送
    textChunkLimit: 4000,

    sendText: async ({ to, text, accountId }) => {
      // 通过 WebSocket 发送到 bridge
      const result = await sendToBridge("send", { to, text });
      return { channel: "wechat", ok: result.ok };
    },
  },

  gateway: {
    // WebSocket 连接由 bridge 主动发起，这里处理连接事件
    handleConnection: async (ws, ctx) => {
      ws.on("message", (data) => {
        const msg = JSON.parse(data);
        if (msg.method === "wechat.message") {
          // 路由入站消息
          routeInboundMessage({
            channel: "wechat",
            from: msg.params.from,
            text: msg.params.text,
            ...
          });
        }
      });
    },
  },
};
```

### 2. wxauto-bridge (`wxauto-bridge/`)

```python
# bridge.py
import asyncio
import websockets
import json
from wxauto import WeChat

class WeChatBridge:
    def __init__(self, gateway_url: str):
        self.gateway_url = gateway_url
        self.wx = None
        self.ws = None
        self.listen_chats = {}

    async def connect(self):
        """连接到 OpenClaw Gateway"""
        self.ws = await websockets.connect(
            f"{self.gateway_url}/channels/wechat"
        )

        # 初始化微信
        self.wx = WeChat()

        # 发送连接成功通知
        await self.send_notification("wechat.connected", {
            "nickname": self.wx.nickname,
            "online": self.wx.IsOnline()
        })

        # 启动消息处理循环
        await asyncio.gather(
            self.receive_commands(),
            self.poll_messages()
        )

    async def receive_commands(self):
        """接收并处理来自 OpenClaw 的命令"""
        async for message in self.ws:
            data = json.loads(message)

            if data.get("method") == "send":
                result = self.handle_send(data["params"])
                await self.send_response(data["id"], result)

            elif data.get("method") == "addListen":
                result = self.handle_add_listen(data["params"])
                await self.send_response(data["id"], result)

    def handle_send(self, params: dict) -> dict:
        """处理发送消息命令"""
        try:
            to = params["to"]
            text = params["text"]
            files = params.get("files", [])

            if files:
                self.wx.SendFiles(files, who=to)
            if text:
                self.wx.SendMsg(text, who=to)

            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def handle_add_listen(self, params: dict) -> dict:
        """添加聊天监听"""
        chat_name = params["chat"]

        def on_message(msg, chat):
            asyncio.create_task(self.push_message(msg, chat))

        result = self.wx.AddListenChat(chat_name, callback=on_message)
        if result:
            self.listen_chats[chat_name] = result
            return {"ok": True}
        return {"ok": False, "error": "Failed to add listener"}

    async def push_message(self, msg, chat):
        """推送消息到 OpenClaw"""
        await self.send_notification("wechat.message", {
            "from": msg.sender,
            "to": str(chat),
            "text": msg.content,
            "type": msg.type,
            "chatType": chat.chat_type,
            "timestamp": int(time.time() * 1000)
        })

    async def send_notification(self, method: str, params: dict):
        """发送通知（无需响应）"""
        await self.ws.send(json.dumps({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }))

    async def send_response(self, id: str, result: dict):
        """发送命令响应"""
        await self.ws.send(json.dumps({
            "jsonrpc": "2.0",
            "id": id,
            "result": result
        }))

# 启动
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--gateway", default="ws://localhost:18789")
    args = parser.parse_args()

    bridge = WeChatBridge(args.gateway)
    asyncio.run(bridge.connect())
```

---

## 配置示例

```json
{
  "channels": {
    "wechat": {
      "enabled": true,
      "allowFrom": ["张三", "工作群"],
      "dmPolicy": "pairing",
      "listenChats": ["张三", "工作群", "文件传输助手"]
    }
  }
}
```

---

## 用户使用流程

```bash
# 1. 安装 wxauto-bridge（一次性）
pip install wxauto websockets

# 2. 启动微信客户端并登录（手动）

# 3. 配置 OpenClaw
openclaw channel add wechat
openclaw config set channels.wechat.allowFrom '["张三", "工作群"]'

# 4. 启动 OpenClaw 网关
openclaw gateway run

# 5. 启动 wxauto-bridge（连接到网关）
python wxauto-bridge/bridge.py --gateway ws://localhost:18789

# 6. 测试发送
openclaw message send "你好" --channel wechat --to "文件传输助手"
```

---

## 文件结构

```
openclaw/
├── extensions/
│   └── wechat/
│       ├── index.ts              # 插件入口
│       ├── package.json
│       ├── openclaw.plugin.json
│       └── src/
│           ├── channel.ts        # ChannelPlugin 实现
│           ├── runtime.ts        # 运行时引用
│           ├── gateway.ts        # WebSocket 处理
│           └── types.ts          # 类型定义
│
└── wxauto-bridge/                # 独立 Python 项目（可单独分发）
    ├── bridge.py                 # 主程序
    ├── requirements.txt          # wxauto, websockets
    └── README.md
```

---

## 下一步实施计划

### 阶段一：基础框架

1. 创建 `extensions/wechat/` 插件骨架
2. 实现 WebSocket 端点 `/channels/wechat`
3. 创建 `wxauto-bridge/` Python 项目
4. 实现基础连接和心跳

### 阶段二：消息收发

1. 实现 `send` 命令（出站）
2. 实现 `wechat.message` 推送（入站）
3. 实现消息路由到 Agent

### 阶段三：完善功能

1. 添加文件/图片发送
2. 实现 `addListen`/`removeListen`
3. 添加配对（pairing）机制
4. 状态监控和重连

---

---

## 使用场景

### 场景一：单用户自用

```
┌─────────────────────────────────────────────────────────────┐
│                    你的 Windows 电脑                         │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ 你的微信客户端 │◄──►│ wxauto-bridge │◄──►│  OpenClaw    │  │
│  │  (已登录)     │    │  (Python)    │    │  (Gateway)   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         ▲                                                   │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │ 其他人的微信  │  ← 他们给你发消息，OpenClaw 自动回复        │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

**你自己如何和 OpenClaw 对话**：

- 方式1：给"文件传输助手"发消息（配置监听）
- 方式2：CLI 命令：`openclaw message send "你好" --channel wechat --to "张三"`
- 方式3：OpenClaw Web UI

**配置示例**：

```json
{
  "channels": {
    "wechat": {
      "enabled": true,
      "allowFrom": ["张三", "李四", "文件传输助手"],
      "listenChats": ["张三", "李四", "文件传输助手"]
    }
  }
}
```

---

### 场景二：微信机器人（多人使用）

```
┌─────────────────────────────────────────────────────────────┐
│                    服务器 (Windows)                          │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ 机器人微信号  │◄──►│ wxauto-bridge │◄──►│  OpenClaw    │  │
│  │ (专用账号)    │    │  (Python)    │    │  (Gateway)   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ▲
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  用户A   │  │  用户B   │  │  用户C   │  │  群聊    │   │
│  │ 私聊机器人│  │ 私聊机器人│  │ 私聊机器人│  │ @机器人  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**部署步骤**：

1. 注册专用微信号作为机器人
2. 在 Windows 服务器登录机器人微信
3. 让用户添加机器人好友或拉入群聊
4. 配置权限控制

**配置示例**：

```json
{
  "channels": {
    "wechat": {
      "enabled": true,
      "dmPolicy": "open", // 允许所有私聊
      "allowFrom": ["*"], // 或指定用户列表
      "groups": {
        "工作群": {
          "requireMention": true, // 群里需要 @机器人
          "allowFrom": ["*"] // 群内所有人可用
        },
        "VIP群": {
          "requireMention": false, // 不需要 @，所有消息都响应
          "allowFrom": ["管理员A", "管理员B"] // 仅特定人可用
        }
      }
    }
  }
}
```

**用户使用方式**：

- **私聊**：直接给机器人发消息
- **群聊**：`@机器人 你好` 或直接发消息（取决于 requireMention 配置）

---

### 场景三：远程访问

```
┌─────────────────────────────────────────────────────────────┐
│                    家里/公司 Windows 电脑                    │
│                                                             │
│  微信客户端 ◄──► wxauto-bridge ◄──► OpenClaw Gateway        │
│                                          │                  │
│                                          │ 内网穿透/VPN     │
└──────────────────────────────────────────│──────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    你在外面（手机/笔记本）                    │
│                                                             │
│  方式1：手机微信 → 给"文件传输助手"发消息                     │
│  方式2：手机微信 → 给机器人微信号发消息                       │
│  方式3：浏览器 → OpenClaw Web UI（需内网穿透）               │
│  方式4：SSH → openclaw CLI 命令                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**推荐的远程访问方案**：

- **Tailscale/ZeroTier**：免费内网穿透，安全
- **frp/ngrok**：端口转发
- **云服务器**：直接部署在云 Windows 服务器

---

## 权限控制设计

### DM 策略（私聊）

| 策略        | 说明                      | 配置                      |
| ----------- | ------------------------- | ------------------------- |
| `pairing`   | 需要审批才能使用（默认）  | `"dmPolicy": "pairing"`   |
| `allowlist` | 仅 allowFrom 列表中的用户 | `"dmPolicy": "allowlist"` |
| `open`      | 任何人都可以私聊          | `"dmPolicy": "open"`      |

### 群组策略

| 配置项           | 说明                   |
| ---------------- | ---------------------- |
| `requireMention` | 是否需要 @机器人       |
| `allowFrom`      | 群内允许触发的用户列表 |
| `toolPolicy`     | 允许使用的工具/命令    |

### 配对审批流程（pairing 模式）

```bash
# 1. 新用户给机器人发消息
# 2. OpenClaw 记录待审批请求

# 3. 管理员查看待审批列表
openclaw pairing list wechat

# 4. 管理员审批
openclaw pairing approve wechat "张三"

# 5. 用户被添加到 allowFrom，可以正常使用
```

---

## 消息路由逻辑

```
收到微信消息
    │
    ▼
┌─────────────────┐
│ 解析消息来源     │
│ - 私聊 or 群聊   │
│ - 发送者是谁     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     否
│ 检查 allowFrom  │────────► 忽略 / 请求配对
└────────┬────────┘
         │ 是
         ▼
┌─────────────────┐     是
│ 群聊 + 需要@？   │────────► 检查是否 @机器人
└────────┬────────┘              │
         │ 否                    │ 未@
         │                       ▼
         │                    忽略消息
         ▼
┌─────────────────┐
│ 路由到 Agent    │
│ 处理并生成回复   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 通过 wxauto     │
│ 发送回复消息     │
└─────────────────┘
```

---

## 确认

这个架构和使用场景是否符合您的预期？如果确认，我可以开始实施。
