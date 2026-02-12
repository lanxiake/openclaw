# 微信桥接器配置与调试指南

## 概述

微信桥接器 (`wxauto-bridge`) 是一个 Python WebSocket 客户端，用于连接 OpenClaw Gateway 和微信 Windows 客户端。它基于 wxauto 库，通过 Windows UI Automation 控制微信 3.x 版本。

## 核心架构

```
微信 Windows 客户端 (Loop)
        ↑
    wxauto 库 (UI Automation)
        ↑
微信桥接器 (Python WebSocket 客户端)
        ↑
    WebSocket 连接
        ↑
OpenClaw Gateway (Node.js WebSocket 服务器)
```

## 安装与配置

### 1. 环境要求

- **Python**: 3.8+ (推荐 3.12)
- **微信版本**: 3.x (Windows 客户端)
- **操作系统**: Windows 10/11
- **依赖库**: 见 `requirements.txt`

### 2. 安装步骤

```bash
# 1. 安装 Python 依赖
cd wxauto-bridge
pip install -r requirements.txt

# 2. 安装 wxauto 库（从本地路径）
# 确保 my-docs/wxauto-main 目录存在
# 或从 GitHub 安装：
pip install git+https://github.com/cluic/wxauto.git

# 3. 安装 pywin32（Windows UI Automation）
pip install pywin32
```

### 3. 配置 Bridge

#### 配置文件位置

- Bridge 配置: `wxauto-bridge/config.json` (可选)
- Gateway 配置: `~/.openclaw-dev/openclaw.json`

#### 关键配置项

```json
{
  "gateway_url": "ws://127.0.0.1:19001",
  "auth_token": "自动生成，每次 Gateway 重启变化",
  "listen_chats": ["TOOLAN", "文件传输助手", "群聊名称"],
  "debug": false
}
```

## 调试经验总结

### 1. 消息检测死循环问题

**问题现象**：

- Bridge 连接成功，监听器添加成功
- 但收不到任何微信消息
- `get_new_msgs()` 日志显示 `used_ids=0` 且永不更新

**根本原因**：
在 `chatbox.py` 的 `get_new_msgs()` 方法中：

```python
# 原代码问题：
if not self.used_msg_ids and now_msg_ids:
    # 当 used_msg_ids 为空时，直接返回空列表
    # 但 never 更新 USED_MSG_IDS，导致死循环
    return []
```

**解决方案**：

```python
# 修复后的代码：
if not self.used_msg_ids and now_msg_ids:
    wxlog.debug(f'[get_new_msgs] 初始化基线: {len(now_msg_ids)} 条已有消息')
    USED_MSG_IDS[self.id] = now_msg_ids[-100:]  # 保存最近100条消息ID作为基线
    return []
```

### 2. 群聊消息发送失败（剪贴板竞争）

**问题现象**：

- 私聊消息发送成功
- 群聊 @me 回复时发送失败
- 错误：`Error calling OpenClipboard ([WinError 0] 操作成功完成。)`

**根本原因**：
wxauto 在群聊中发送 @ 消息时：

1. `input_at()` 操作编辑框，触发 UI 事件
2. `send_text()` 调用 `SetClipboardText()` 打开剪贴板
3. Windows 剪贴板被其他进程（或 wxauto 自身）锁定
4. `OpenClipboard` API 调用失败

**解决方案**：
在 `wechat_handler.py` 的 `send_message()` 方法中添加重试逻辑：

```python
def send_message(self, chat_name: str, message: str, at: Optional[List[str]] = None) -> dict:
    max_retries = 3
    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            with self._lock:
                result = self._wx.SendMsg(msg=message, who=chat_name, at=at)
                if result.success:
                    return {"success": True}
                else:
                    last_error = result.message
                    logger.warning(f"消息发送失败 (尝试 {attempt}/{max_retries}): {last_error}")

        except Exception as e:
            last_error = str(e)
            logger.warning(f"消息发送异常 (尝试 {attempt}/{max_retries}): {last_error}")

        # 剪贴板竞争时短暂等待后重试
        if attempt < max_retries:
            time.sleep(0.5)

    error_msg = f"发送消息失败 (已重试 {max_retries} 次): {last_error}"
    logger.error(error_msg)
    return {"success": False, "error": error_msg}
```

### 3. Python 环境问题

**问题现象**：

- `python` 命令返回 exit code 49
- Windows 应用商店的 Python 无法启动

**解决方案**：

1. 使用本地安装的 Python 3.12
2. 指定完整路径：`"C:\Users\<用户名>\AppData\Local\Programs\Python\Python312\python.exe"`

### 4. Gateway Auth Token 变化

**问题现象**：

- Bridge 连接被拒绝 (1008 policy violation)
- Gateway 每次重启生成新的 auth token

**解决方案**：

1. 启动 Gateway 后，从控制台输出获取新 token
2. 更新 Bridge 启动命令中的 token 参数
3. 或设置固定 token（见下文）

## 自动化配置指南

### 1. 自动获取 Auth Token

Gateway 启动时输出：

```
[wechat:default] Generated auth token: 9021e21b4e574349bc7a6e39574c7845
Configure your bridge with: --token 9021e21b4e574349bc7a6e39574c7845
```

AI 可以：

1. 解析 Gateway 启动日志中的 token
2. 自动更新 Bridge 启动命令
3. 或将 token 保存到配置文件

### 2. 设置固定 Auth Token

在 `openclaw.json` 中配置固定 token：

```json
{
  "channels": {
    "wechat": {
      "enabled": true,
      "authToken": "your-fixed-token-here",
      "listenChats": ["TOOLAN", "文件传输助手", "群聊名称"]
    }
  }
}
```

然后使用固定 token 启动 Gateway：

```bash
OPENCLAW_GATEWAY_TOKEN=your-fixed-token node openclaw.mjs --dev gateway --token your-fixed-token
```

### 3. 自动检测微信窗口

Bridge 启动时自动检测已登录的微信窗口：

```
初始化成功，获取到已登录窗口：Loop
```

AI 可以：

1. 验证微信客户端是否已登录
2. 确认微信昵称是否正确
3. 检查监听聊天窗口是否成功打开

### 4. 健康检查脚本

创建健康检查脚本 `health_check.py`：

```python
#!/usr/bin/env python3
"""
微信桥接器健康检查脚本
AI 可以自动运行此脚本来验证系统状态
"""

import asyncio
import websockets
import json
import sys

async def check_gateway(gateway_url: str, token: str) -> bool:
    """检查 Gateway 是否可连接"""
    try:
        ws_url = f"{gateway_url}/channels/wechat?token={token}"
        async with websockets.connect(ws_url) as websocket:
            # 发送 ping 测试
            ping_msg = {
                "jsonrpc": "2.0",
                "id": "health-check",
                "method": "ping",
                "params": {}
            }
            await websocket.send(json.dumps(ping_msg))
            response = await websocket.recv()
            data = json.loads(response)
            return data.get("result", {}).get("pong") is True
    except Exception as e:
        print(f"Gateway 连接失败: {e}")
        return False

def check_wxauto() -> bool:
    """检查 wxauto 库是否可用"""
    try:
        from wxauto import WeChat
        wx = WeChat()
        nickname = wx.nickname
        print(f"微信客户端检测到: {nickname}")
        return True
    except Exception as e:
        print(f"wxauto 检查失败: {e}")
        return False

async def main():
    # 从环境变量或配置文件读取配置
    gateway_url = "ws://127.0.0.1:19001"
    token = "9021e21b4e574349bc7a6e39574c7845"  # 实际应从配置读取

    print("=== 微信桥接器健康检查 ===")

    # 1. 检查 Gateway
    print("1. 检查 Gateway 连接...")
    gateway_ok = await check_gateway(gateway_url, token)
    print(f"   Gateway: {'✅ 正常' if gateway_ok else '❌ 失败'}")

    # 2. 检查 wxauto
    print("2. 检查 wxauto 库...")
    wxauto_ok = check_wxauto()
    print(f"   wxauto: {'✅ 正常' if wxauto_ok else '❌ 失败'}")

    # 3. 总体状态
    print("\n=== 检查结果 ===")
    if gateway_ok and wxauto_ok:
        print("✅ 系统正常，可以启动 Bridge")
        sys.exit(0)
    else:
        print("❌ 系统有问题，需要修复")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
```

## 启动脚本示例

### 1. 完整启动脚本 `start_bridge.bat`

```batch
@echo off
echo 启动微信桥接器...

REM 1. 检查 Python 环境
set PYTHON_PATH=C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python312\python.exe
if not exist "%PYTHON_PATH%" (
    echo ❌ Python 3.12 未安装
    pause
    exit /b 1
)

REM 2. 检查 Gateway 是否运行
netstat -ano | findstr :19001 > nul
if errorlevel 1 (
    echo ❌ Gateway 未运行，请先启动 Gateway
    pause
    exit /b 1
)

REM 3. 启动 Bridge（token 需要从 Gateway 输出获取）
cd /d D:\AI-workspace\openclaw\wxauto-bridge
"%PYTHON_PATH%" bridge.py --gateway ws://127.0.0.1:19001 --token 9021e21b4e574349bc7a6e39574c7845 -v

pause
```

### 2. AI 自动化配置脚本

```python
# ai_configure_bridge.py
"""
AI 自动化配置微信桥接器
"""

import subprocess
import re
import json
import os
from pathlib import Path

class BridgeConfigurator:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.bridge_dir = self.project_root / "wxauto-bridge"
        self.config_file = self.bridge_dir / "config.json"

    def detect_python(self) -> str:
        """检测可用的 Python 解释器"""
        # 优先使用本地安装的 Python 3.12
        python_paths = [
            r"C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python312\python.exe",
            r"C:\Python312\python.exe",
            "python3",
            "python"
        ]

        for path in python_paths:
            expanded_path = os.path.expandvars(path)
            if os.path.exists(expanded_path):
                try:
                    result = subprocess.run(
                        [expanded_path, "--version"],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    if result.returncode == 0:
                        print(f"✅ 找到 Python: {expanded_path} ({result.stdout.strip()})")
                        return expanded_path
                except:
                    continue

        raise Exception("❌ 未找到可用的 Python 解释器")

    def parse_gateway_token(self, gateway_output: str) -> str:
        """从 Gateway 输出中解析 auth token"""
        # 匹配模式: Generated auth token: xxxxx
        pattern = r"Generated auth token: ([a-f0-9]{32})"
        match = re.search(pattern, gateway_output)
        if match:
            return match.group(1)
        raise Exception("❌ 未找到 Gateway auth token")

    def create_config(self, gateway_url: str, token: str, listen_chats: list):
        """创建 Bridge 配置文件"""
        config = {
            "gateway_url": gateway_url,
            "auth_token": token,
            "listen_chats": listen_chats,
            "debug": True,
            "python_path": self.detect_python()
        }

        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)

        print(f"✅ 配置文件已创建: {self.config_file}")
        return config

    def generate_start_script(self, config: dict):
        """生成启动脚本"""
        script_content = f'''@echo off
echo 微信桥接器启动脚本 (AI 自动生成)

REM Python 路径
set PYTHON_PATH={config['python_path']}

REM Bridge 参数
set GATEWAY_URL={config['gateway_url']}
set AUTH_TOKEN={config['auth_token']}

echo 使用 Python: %PYTHON_PATH%
echo Gateway: %GATEWAY_URL%
echo Token: %AUTH_TOKEN%

REM 切换到 Bridge 目录
cd /d {self.bridge_dir}

REM 启动 Bridge
"%PYTHON_PATH%" bridge.py --gateway %GATEWAY_URL% --token %AUTH_TOKEN% -v

pause
'''

        script_path = self.bridge_dir / "start_bridge_ai.bat"
        with open(script_path, 'w', encoding='utf-8') as f:
            f.write(script_content)

        print(f"✅ 启动脚本已生成: {script_path}")
        return script_path

# 使用示例
if __name__ == "__main__":
    configurator = BridgeConfigurator("D:/AI-workspace/openclaw")

    # 1. 检测 Python
    python_path = configurator.detect_python()

    # 2. 假设从 Gateway 输出获取的 token
    gateway_output = """
    [wechat:default] Generated auth token: 9021e21b4e574349bc7a6e39574c7845
    Configure your bridge with: --token 9021e21b4e574349bc7a6e39574c7845
    """
    token = configurator.parse_gateway_token(gateway_output)

    # 3. 创建配置
    config = configurator.create_config(
        gateway_url="ws://127.0.0.1:19001",
        token=token,
        listen_chats=["TOOLAN", "文件传输助手", "云鲲创想-930"]
    )

    # 4. 生成启动脚本
    script_path = configurator.generate_start_script(config)

    print("\n✅ 配置完成！")
    print(f"   配置文件: {configurator.config_file}")
    print(f"   启动脚本: {script_path}")
    print("\n下一步：")
    print("1. 确保 Gateway 正在运行")
    print("2. 双击运行启动脚本")
    print("3. 检查 Bridge 连接状态")
```

## 故障排除

### 常见问题及解决方案

| 问题                | 症状                      | 解决方案                                  |
| ------------------- | ------------------------- | ----------------------------------------- |
| **消息检测死循环**  | `used_ids=0` 永不更新     | 修复 `chatbox.py` 的基线初始化逻辑        |
| **群聊发送失败**    | `OpenClipboard` 错误      | 在 `send_message()` 中添加重试机制        |
| **Python 无法启动** | exit code 49              | 使用本地 Python 3.12，而非 Windows 商店版 |
| **WebSocket 断开**  | `no close frame received` | 检查 Gateway 是否崩溃，重新启动           |
| **认证失败**        | `1008 policy violation`   | 更新 Bridge 的 auth token                 |
| **微信窗口未找到**  | `获取到已登录窗口：None`  | 确保微信客户端已登录并打开                |

### 日志分析指南

**正常启动日志**：

```
✅ WebSocket 连接成功
✅ 微信客户端连接成功: Loop
✅ 监听器添加成功: TOOLAN
✅ 初始化基线: 35 条已有消息
```

**异常日志**：

```
❌ used_ids=0, _empty=False (消息检测死循环)
❌ Error calling OpenClipboard (剪贴板竞争)
❌ [WinError 1225] 远程计算机拒绝网络连接 (Gateway 未运行)
❌ 1008 policy violation (auth token 错误)
```

## 最佳实践

### 1. 启动顺序

1. 启动微信客户端并登录
2. 启动 OpenClaw Gateway
3. 复制 Gateway 输出的 auth token
4. 使用正确 token 启动 Bridge

### 2. 监控建议

- 定期检查 Gateway 和 Bridge 进程是否存活
- 监控微信窗口是否被意外关闭
- 设置日志轮转，避免日志文件过大

### 3. 性能优化

- 减少不必要的 debug 日志（生产环境）
- 调整监听间隔（默认 1 秒）
- 限制基线消息数量（默认最近 100 条）

### 4. 安全注意事项

- auth token 应定期更换
- 不要将 token 提交到版本控制
- 限制监听聊天的范围，避免隐私泄露

## 更新记录

### v1.0.0 (2026-02-10)

- ✅ 修复消息检测死循环问题
- ✅ 添加剪贴板竞争重试机制
- ✅ 支持 Python 3.12 环境
- ✅ 完善自动化配置脚本
- ✅ 添加健康检查功能

---

_本文档由 AI 根据实际调试经验生成，将持续更新。_
