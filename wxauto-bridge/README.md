# wxauto-bridge

微信桥接器 - 通过 wxauto 实现 OpenClaw 与微信的消息桥接。

## 架构

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
│  │  客户端 (3.x)   │ ───消息推送────► │                  │  │
│  └─────────────────┘                  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

wxauto-bridge 作为 WebSocket **客户端**，主动连接到 OpenClaw Gateway。

## 系统要求

- Windows 10/11
- Python 3.8+
- 微信 PC 客户端 3.x 版本（已登录）
  - **注意**：微信 4.x 版本使用 Qt 框架，不支持 UIAutomation，请使用 3.x 版本

## 安装

1. 安装 Python 依赖：

```bash
cd wxauto-bridge
pip install -r requirements.txt
```

2. 安装 wxauto（从本地源码或 GitHub）：

```bash
# 从本地源码安装
pip install ../my-docs/wxauto-main

# 或从 GitHub 安装
pip install git+https://github.com/cluic/wxauto.git
```

## 使用方法

### 启动流程

```bash
# 1. 启动微信客户端并登录（手动）

# 2. 启动 OpenClaw 网关
openclaw gateway run --port 18789

# 3. 启动 wxauto-bridge（连接到网关）
python bridge.py --gateway ws://localhost:18789
```

### 命令行参数

```bash
# 默认连接 ws://localhost:18789
python bridge.py

# 指定 Gateway 地址
python bridge.py --gateway ws://192.168.1.100:18789

# 启用详细日志
python bridge.py -v
```

### 配置 OpenClaw

```bash
# 启用 wechat 渠道
openclaw config set channels.wechat.enabled true

# 配置允许的联系人
openclaw config set channels.wechat.allowFrom '["张三", "文件传输助手"]'

# 查看渠道状态
openclaw channels list
```

## 通讯协议

使用 JSON-RPC 2.0 协议进行通讯。

### Bridge → OpenClaw（入站消息）

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

### OpenClaw → Bridge（发送命令）

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

### Bridge → OpenClaw（命令响应）

```json
{
  "jsonrpc": "2.0",
  "id": "msg-001",
  "result": {
    "ok": true
  }
}
```

### 支持的方法

| 方向 | 方法 | 说明 |
|------|------|------|
| OC → Bridge | `send` | 发送消息 |
| OC → Bridge | `sendFile` | 发送文件 |
| OC → Bridge | `getStatus` | 获取微信状态 |
| OC → Bridge | `getContacts` | 获取联系人列表 |
| OC → Bridge | `addListen` | 添加聊天监听 |
| OC → Bridge | `removeListen` | 移除聊天监听 |
| Bridge → OC | `wechat.message` | 推送新消息 |
| Bridge → OC | `wechat.status` | 状态变更通知 |
| Bridge → OC | `wechat.connected` | 连接成功通知 |

## 打包为 exe

使用 PyInstaller 打包：

```bash
# Windows
build.bat

# 或手动执行
pyinstaller --onefile --name wxauto-bridge bridge.py
```

打包后的 exe 文件位于 `dist/wxauto-bridge.exe`。

## 注意事项

1. **仅支持 Windows**：wxauto 依赖 Windows UIAutomation API
2. **需要微信 PC 客户端**：必须先登录微信 PC 客户端
3. **窗口可见性**：wxauto 需要微信窗口可见（不能最小化）
4. **连接顺序**：先启动 OpenClaw Gateway，再启动 wxauto-bridge

## 故障排除

### 微信连接失败

- 确保微信 PC 客户端已启动并登录
- 确保微信窗口没有最小化
- 确保使用微信 3.x 版本（不支持 4.x）
- 尝试重启微信客户端

### WebSocket 连接失败

- 确保 OpenClaw Gateway 已启动
- 检查 Gateway 地址和端口是否正确
- 检查防火墙设置

### 消息发送失败

- 确保目标联系人/群在最近聊天列表中
- 检查联系人/群名称是否正确
