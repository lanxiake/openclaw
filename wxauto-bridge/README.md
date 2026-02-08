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
- Python 3.8+（仅开发/打包时需要）
- 微信 PC 客户端 3.x 版本（已登录）
  - **注意**：微信 4.x 版本使用 Qt 框架，不支持 UIAutomation，请使用 3.x 版本

## 快速开始

### 方式一：使用打包好的 exe（推荐）

1. 下载 `wxauto-bridge.exe`（或运行 `package.bat` 自行打包）
2. 启动微信 PC 客户端并登录
3. 双击运行 `wxauto-bridge.exe`
4. 在界面中配置 Gateway 地址和监听列表

### 方式二：从源码运行

```bash
# 1. 安装依赖
cd wxauto-bridge
pip install -r requirements.txt

# 2. 启动微信客户端并登录（手动）

# 3. 启动 OpenClaw 网关
openclaw gateway run --port 18789

# 4. 启动 wxauto-bridge
python bridge_app.py
```

## 配置说明

配置文件位置：`~/.openclaw/wechat-bridge.json`

```json
{
  "gateway_url": "ws://localhost:18789",
  "auth_token": "your-auth-token",
  "listen_chats": [
    {"name": "文件传输助手", "type": "friend", "enabled": true},
    {"name": "工作群", "type": "group", "enabled": true}
  ]
}
```

### 配置项说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `gateway_url` | OpenClaw Gateway WebSocket 地址 | `ws://localhost:18789` |
| `auth_token` | 认证 Token（与 Gateway 配置一致） | 自动生成 |
| `listen_chats` | 监听的聊天列表 | `[]` |

### 监听列表配置

每个监听项包含：
- `name`: 聊天名称（好友昵称或群名称）
- `type`: 类型，`friend`（好友）或 `group`（群聊）
- `enabled`: 是否启用监听

## 打包为 exe

```bash
# 运行打包脚本
package.bat

# 输出文件位于 dist/wxauto-bridge.exe
```

打包后的 exe 文件约 350-400 MB，包含所有依赖，可独立运行。

## 脚本说明

| 脚本 | 说明 |
|------|------|
| `package.bat` | 打包脚本，生成独立 exe 文件 |
| `start.bat` | 启动脚本，运行打包后的 exe |
| `dev.ps1` | 开发脚本（PowerShell），用于开发调试 |
| `dev.bat` | 开发脚本（批处理），用于开发调试 |

## 界面功能

启动后会打开一个配置界面，提供以下功能：

1. **连接状态**：显示与 Gateway 的连接状态
2. **Gateway 配置**：设置 Gateway 地址和认证 Token
3. **监听管理**：添加/删除/启用/禁用监听的聊天
4. **日志查看**：实时查看运行日志

## 通讯协议

使用 JSON-RPC 2.0 协议进行通讯。

### 支持的方法

| 方向 | 方法 | 说明 |
|------|------|------|
| Gateway → Bridge | `send` | 发送消息 |
| Gateway → Bridge | `sendFile` | 发送文件 |
| Gateway → Bridge | `getStatus` | 获取微信状态 |
| Gateway → Bridge | `getContacts` | 获取联系人列表 |
| Gateway → Bridge | `addListen` | 添加聊天监听 |
| Gateway → Bridge | `removeListen` | 移除聊天监听 |
| Bridge → Gateway | `wechat.message` | 推送新消息 |
| Bridge → Gateway | `wechat.status` | 状态变更通知 |
| Bridge → Gateway | `wechat.connected` | 连接成功通知 |

## 注意事项

1. **仅支持 Windows**：wxauto 依赖 Windows UIAutomation API
2. **需要微信 PC 客户端**：必须先登录微信 PC 客户端
3. **窗口可见性**：wxauto 需要微信窗口可见（不能最小化）
4. **微信版本**：仅支持微信 3.x 版本，不支持 4.x

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
- 确认 auth_token 与 Gateway 配置一致

### 消息发送失败

- 确保目标联系人/群在最近聊天列表中
- 检查联系人/群名称是否正确（区分大小写）

### 打包失败

- 确保 Python 3.8+ 已安装
- 确保所有依赖已正确安装
- 尝试清理 build 目录后重新打包

## 开发调试

```bash
# PowerShell 开发脚本
.\dev.ps1 start    # 启动 Gateway 和 Bridge
.\dev.ps1 stop     # 停止服务
.\dev.ps1 restart  # 重启服务
.\dev.ps1 status   # 查看状态

# 或使用批处理
dev.bat start
```
