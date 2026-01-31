# wxauto-bridge

微信桥接器 - 通过 wxauto 实现 OpenClaw 与微信的消息桥接。

## 架构

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   OpenClaw      │ ◄─────────────────► │  wxauto-bridge  │
│   Gateway       │    (客户端连接)      │  (WebSocket     │
│                 │                     │   服务器)        │
└─────────────────┘                     └────────┬────────┘
                                                 │
                                                 │ UIAutomation
                                                 ▼
                                        ┌─────────────────┐
                                        │  微信 PC 客户端  │
                                        │  (Windows)      │
                                        └─────────────────┘
```

wxauto-bridge 作为 WebSocket 服务器运行，OpenClaw Gateway 作为客户端连接。

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

### 启动桥接器

```bash
# 默认监听 0.0.0.0:18790
python bridge.py

# 指定端口
python bridge.py --port 18790

# 指定监听地址
python bridge.py --host 127.0.0.1 --port 18790

# 启用详细日志
python bridge.py -v
```

### 配置 OpenClaw

```bash
# 设置 bridgeUrl
openclaw config set channels.wechat.bridgeUrl "ws://localhost:18790"

# 启用 wechat 渠道
openclaw config set channels.wechat.enabled true

# 查看渠道状态
openclaw channels list
```

### 启动 OpenClaw Gateway

```bash
openclaw gateway run
```

## 消息协议

wxauto-bridge 使用简单的 JSON 消息协议：

### 连接成功

```json
{
  "type": "connected",
  "wxid": "wxid_xxx",
  "nickname": "用户昵称"
}
```

### 发送消息

```json
{
  "type": "send",
  "to": "联系人或群名",
  "text": "消息内容"
}
```

### 发送文件

```json
{
  "type": "sendFile",
  "to": "联系人或群名",
  "filePath": "C:\\path\\to\\file.jpg"
}
```

### 添加监听

```json
{
  "type": "addListen",
  "chatName": "要监听的聊天名称"
}
```

### 接收消息

```json
{
  "type": "message",
  "data": {
    "from": "发送者",
    "to": "聊天名称",
    "text": "消息内容",
    "chatType": "direct|group",
    "groupName": "群名（如果是群消息）",
    "senderName": "发送者昵称",
    "timestamp": 1234567890.123,
    "msgType": "text"
  }
}
```

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
4. **防火墙**：如果远程连接，需要开放对应端口

## 故障排除

### 微信连接失败

- 确保微信 PC 客户端已启动并登录
- 确保微信窗口没有最小化
- 尝试重启微信客户端

### WebSocket 连接失败

- 检查端口是否被占用
- 检查防火墙设置
- 确保 OpenClaw 配置的 bridgeUrl 正确

### 消息发送失败

- 确保目标联系人/群在最近聊天列表中
- 检查联系人/群名称是否正确
