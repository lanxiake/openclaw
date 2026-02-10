#!/usr/bin/env python3
"""
AI 自动化配置微信桥接器
"""

import subprocess
import re
import json
import os
import sys
from pathlib import Path

class BridgeConfigurator:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.bridge_dir = self.project_root / "wxauto-bridge"
        self.config_file = self.bridge_dir / "config.json"

        # 确保目录存在
        self.bridge_dir.mkdir(parents=True, exist_ok=True)

    def detect_python(self) -> str:
        """检测可用的 Python 解释器"""
        python_paths = [
            # 本地 Python 安装
            r"C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python312\python.exe",
            r"C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe",
            r"C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python310\python.exe",
            r"C:\Python312\python.exe",
            r"C:\Python311\python.exe",
            r"C:\Python310\python.exe",
            # 系统 PATH
            "python3",
            "python"
        ]

        for path_template in python_paths:
            path = os.path.expandvars(path_template)
            if os.path.exists(path):
                try:
                    result = subprocess.run(
                        [path, "--version"],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    if result.returncode == 0:
                        version = result.stdout.strip()
                        print(f"✅ 找到 Python: {path} ({version})")
                        return path
                except (subprocess.SubprocessError, FileNotFoundError):
                    continue

        # 尝试在 PATH 中查找
        try:
            result = subprocess.run(
                ["where", "python"],
                capture_output=True,
                text=True,
                shell=True,
                timeout=5
            )
            if result.returncode == 0:
                paths = result.stdout.strip().split('\n')
                for path in paths:
                    if path.strip() and os.path.exists(path.strip()):
                        print(f"✅ 在 PATH 中找到 Python: {path.strip()}")
                        return path.strip()
        except:
            pass

        raise Exception("❌ 未找到可用的 Python 解释器")

    def parse_gateway_token(self, gateway_output: str) -> str:
        """从 Gateway 输出中解析 auth token"""
        # 匹配模式: Generated auth token: xxxxx
        pattern = r"Generated auth token: ([a-f0-9]{32})"
        match = re.search(pattern, gateway_output)
        if match:
            token = match.group(1)
            print(f"✅ 从 Gateway 输出解析到 token: {token}")
            return token

        # 尝试其他模式
        patterns = [
            r"auth token: ([a-f0-9]{32})",
            r"token: ([a-f0-9]{32})",
            r"Configure your bridge with: --token ([a-f0-9]{32})"
        ]

        for pattern in patterns:
            match = re.search(pattern, gateway_output)
            if match:
                token = match.group(1)
                print(f"✅ 从 Gateway 输出解析到 token: {token}")
                return token

        raise Exception("❌ 未找到 Gateway auth token")

    def get_gateway_token_interactive(self) -> str:
        """交互式获取 Gateway token"""
        print("\n=== 获取 Gateway Auth Token ===")
        print("请启动 Gateway 并复制包含 token 的输出行，例如：")
        print("  [wechat:default] Generated auth token: 9021e21b4e574349bc7a6e39574c7845")
        print("  Configure your bridge with: --token 9021e21b4e574349bc7a6e39574c7845")
        print()

        while True:
            gateway_output = input("粘贴 Gateway 输出（或输入 'skip' 跳过）: ").strip()

            if gateway_output.lower() == 'skip':
                return ""

            try:
                token = self.parse_gateway_token(gateway_output)
                return token
            except Exception as e:
                print(f"❌ {e}")
                print("请重新输入正确的 Gateway 输出")

    def get_listen_chats_interactive(self) -> list:
        """交互式获取监听聊天列表"""
        print("\n=== 配置监听聊天 ===")
        print("请输入要监听的微信聊天名称（用逗号分隔）")
        print("例如: TOOLAN,文件传输助手,云鲲创想-930")
        print("注意: 确保这些聊天在微信中已打开")
        print()

        while True:
            chats_input = input("监听聊天列表: ").strip()

            if not chats_input:
                print("❌ 请输入至少一个聊天名称")
                continue

            chats = [chat.strip() for chat in chats_input.split(',')]
            chats = [chat for chat in chats if chat]  # 移除空项

            if not chats:
                print("❌ 请输入有效的聊天名称")
                continue

            print(f"✅ 将监听 {len(chats)} 个聊天: {', '.join(chats)}")
            confirm = input("确认吗？(y/n): ").strip().lower()

            if confirm == 'y':
                return chats

    def create_config(self, gateway_url: str, token: str, listen_chats: list):
        """创建 Bridge 配置文件"""
        try:
            python_path = self.detect_python()
        except Exception as e:
            print(f"⚠️ {e}")
            python_path = "python"  # 使用默认值

        config = {
            "gateway_url": gateway_url,
            "auth_token": token,
            "listen_chats": listen_chats,
            "debug": True,
            "python_path": python_path,
            "version": "1.0.0",
            "auto_restart": True,
            "max_retries": 3
        }

        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)

        print(f"\n✅ 配置文件已创建: {self.config_file}")
        return config

    def generate_start_script(self, config: dict):
        """生成启动脚本"""
        # Windows BAT 脚本
        bat_content = f'''@echo off
echo 微信桥接器启动脚本 (AI 自动生成)
echo ========================================

REM Python 路径
set PYTHON_PATH={config['python_path']}

REM Bridge 参数
set GATEWAY_URL={config['gateway_url']}
set AUTH_TOKEN={config['auth_token']}
set LISTEN_CHATS={','.join(config['listen_chats'])}

echo.
echo 配置信息:
echo   使用 Python: %PYTHON_PATH%
echo   Gateway: %GATEWAY_URL%
echo   Token: %AUTH_TOKEN%
echo   监听聊天: %LISTEN_CHATS%
echo.

REM 检查 Python
if not exist "%PYTHON_PATH%" (
    echo ❌ Python 未找到: %PYTHON_PATH%
    pause
    exit /b 1
)

REM 切换到 Bridge 目录
cd /d "{self.bridge_dir}"

echo 启动 Bridge...
echo.

REM 启动 Bridge
"%PYTHON_PATH%" bridge.py --gateway %GATEWAY_URL% --token %AUTH_TOKEN% -v

echo.
echo Bridge 已退出
pause
'''

        bat_path = self.bridge_dir / "start_bridge.bat"
        with open(bat_path, 'w', encoding='utf-8') as f:
            f.write(bat_content)

        # PowerShell 脚本
        ps_content = f'''# 微信桥接器启动脚本 (AI 自动生成)
Write-Host "微信桥接器启动脚本" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# 配置信息
$PythonPath = "{config['python_path']}"
$GatewayUrl = "{config['gateway_url']}"
$AuthToken = "{config['auth_token']}"
$ListenChats = "{','.join(config['listen_chats'])}"

Write-Host "`n配置信息:" -ForegroundColor Cyan
Write-Host "  使用 Python: $PythonPath"
Write-Host "  Gateway: $GatewayUrl"
Write-Host "  Token: $AuthToken"
Write-Host "  监听聊天: $ListenChats"
Write-Host ""

# 检查 Python
if (-not (Test-Path $PythonPath)) {{
    Write-Host "❌ Python 未找到: $PythonPath" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}}

# 切换到 Bridge 目录
Set-Location "{self.bridge_dir}"

Write-Host "启动 Bridge..." -ForegroundColor Yellow
Write-Host ""

# 启动 Bridge
& $PythonPath bridge.py --gateway $GatewayUrl --token $AuthToken -v

Write-Host "`nBridge 已退出" -ForegroundColor Yellow
Read-Host "按 Enter 退出"
'''

        ps_path = self.bridge_dir / "start_bridge.ps1"
        with open(ps_path, 'w', encoding='utf-8') as f:
            f.write(ps_content)

        print(f"✅ 启动脚本已生成:")
        print(f"   - {bat_path}")
        print(f"   - {ps_path}")

        return bat_path, ps_path

    def generate_readme(self, config: dict):
        """生成 README 文件"""
        readme_content = f'''# 微信桥接器配置

## 配置信息

- **Gateway URL**: {config['gateway_url']}
- **Auth Token**: {config['auth_token']}
- **监听聊天**: {', '.join(config['listen_chats'])}
- **Python 路径**: {config['python_path']}
- **调试模式**: {'开启' if config['debug'] else '关闭'}

## 启动方式

### 方法1: 使用启动脚本
双击运行 `start_bridge.bat` (Windows) 或 `start_bridge.ps1` (PowerShell)

### 方法2: 手动启动
```bash
cd "{self.bridge_dir}"
"{config['python_path']}" bridge.py --gateway {config['gateway_url']} --token {config['auth_token']} -v
```

## 健康检查
运行健康检查脚本验证系统状态：
```bash
"{config['python_path']}" health_check.py
```

## 故障排除

### 1. Gateway 连接失败
- 确保 Gateway 正在运行
- 检查 auth token 是否正确
- 验证 Gateway URL: {config['gateway_url']}

### 2. 微信客户端未找到
- 确保微信客户端已登录
- 检查监听聊天是否在微信中打开

### 3. Python 环境问题
- Python 路径: {config['python_path']}
- 安装依赖: `pip install -r requirements.txt`

## 更新配置
如需更新配置，请编辑 `config.json` 或重新运行配置脚本。

---
*本配置由 AI 自动生成于 {os.path.basename(__file__)}*
'''

        readme_path = self.bridge_dir / "CONFIG_README.md"
        with open(readme_path, 'w', encoding='utf-8') as f:
            f.write(readme_content)

        print(f"✅ README 文件已生成: {readme_path}")
        return readme_path

def main():
    print("=== AI 微信桥接器自动化配置 ===")
    print()

    # 确定项目根目录
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    print(f"项目根目录: {project_root}")
    print(f"Bridge 目录: {project_root / 'wxauto-bridge'}")
    print()

    # 创建配置器
    configurator = BridgeConfigurator(str(project_root))

    try:
        # 1. 检测 Python
        print("1. 检测 Python 环境...")
        python_path = configurator.detect_python()

        # 2. 获取 Gateway 配置
        print("\n2. 配置 Gateway 连接...")
        gateway_url = input(f"Gateway URL (默认: ws://127.0.0.1:19001): ").strip()
        if not gateway_url:
            gateway_url = "ws://127.0.0.1:19001"

        token = configurator.get_gateway_token_interactive()

        # 3. 获取监听聊天
        listen_chats = configurator.get_listen_chats_interactive()

        # 4. 创建配置
        print("\n3. 创建配置文件...")
        config = configurator.create_config(gateway_url, token, listen_chats)

        # 5. 生成启动脚本
        print("\n4. 生成启动脚本...")
        bat_path, ps_path = configurator.generate_start_script(config)

        # 6. 生成 README
        print("\n5. 生成文档...")
        readme_path = configurator.generate_readme(config)

        # 7. 完成
        print("\n" + "="*50)
        print("✅ 配置完成！")
        print("="*50)
        print()
        print("生成的文件:")
        print(f"  - 配置文件: {configurator.config_file}")
        print(f"  - 启动脚本: {bat_path}")
        print(f"  - PowerShell脚本: {ps_path}")
        print(f"  - 文档: {readme_path}")
        print(f"  - 健康检查: {configurator.bridge_dir / 'health_check.py'}")
        print(f"  - 配置指南: {configurator.bridge_dir / 'BRIDGE_CONFIG_GUIDE.md'}")
        print()
        print("下一步操作:")
        print("1. 确保 Gateway 正在运行")
        print("2. 确保微信客户端已登录")
        print("3. 双击运行 start_bridge.bat 启动 Bridge")
        print("4. 检查 Bridge 连接状态")
        print()
        print("如需重新配置，请再次运行此脚本。")

    except Exception as e:
        print(f"\n❌ 配置失败: {e}")
        print("\n请检查:")
        print("1. Python 是否安装")
        print("2. 项目目录结构是否正确")
        print("3. Gateway 输出格式是否正确")
        sys.exit(1)

if __name__ == "__main__":
    main()