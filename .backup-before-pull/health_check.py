#!/usr/bin/env python3
"""
微信桥接器健康检查脚本
AI 可以自动运行此脚本来验证系统状态
"""

import asyncio
import websockets
import json
import sys
import os
from pathlib import Path

async def check_gateway(gateway_url: str, token: str) -> bool:
    """检查 Gateway 是否可连接"""
    try:
        ws_url = f"{gateway_url}/channels/wechat?token={token}"
        async with websockets.connect(ws_url, timeout=10) as websocket:
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
        # 添加 wxauto 路径到 sys.path
        wxauto_path = Path(__file__).parent.parent / "my-docs" / "wxauto-main"
        if wxauto_path.exists():
            import sys
            sys.path.insert(0, str(wxauto_path.parent))

        from wxauto import WeChat
        wx = WeChat()
        nickname = wx.nickname
        print(f"微信客户端检测到: {nickname}")
        return True
    except Exception as e:
        print(f"wxauto 检查失败: {e}")
        return False

def check_python() -> bool:
    """检查 Python 环境"""
    try:
        import sys
        print(f"Python 版本: {sys.version}")
        return True
    except Exception as e:
        print(f"Python 检查失败: {e}")
        return False

def check_dependencies() -> bool:
    """检查依赖库"""
    required_libs = ["websockets", "pywin32", "comtypes", "uiautomation"]
    missing_libs = []

    for lib in required_libs:
        try:
            __import__(lib)
        except ImportError:
            missing_libs.append(lib)

    if missing_libs:
        print(f"缺少依赖库: {', '.join(missing_libs)}")
        return False
    else:
        print("所有依赖库已安装")
        return True

async def main():
    print("=== 微信桥接器健康检查 ===")
    print()

    # 0. 检查 Python 环境
    print("0. 检查 Python 环境...")
    python_ok = check_python()
    print(f"   Python: {'✅ 正常' if python_ok else '❌ 失败'}")

    # 1. 检查依赖库
    print("1. 检查依赖库...")
    deps_ok = check_dependencies()
    print(f"   依赖库: {'✅ 正常' if deps_ok else '❌ 失败'}")

    # 2. 检查 wxauto
    print("2. 检查 wxauto 库...")
    wxauto_ok = check_wxauto()
    print(f"   wxauto: {'✅ 正常' if wxauto_ok else '❌ 失败'}")

    # 3. 检查 Gateway（需要配置）
    print("3. 检查 Gateway 连接...")
    # 从环境变量或配置文件读取配置
    gateway_url = os.environ.get("GATEWAY_URL", "ws://127.0.0.1:19001")
    token = os.environ.get("WECHAT_AUTH_TOKEN", "")

    if token:
        gateway_ok = await check_gateway(gateway_url, token)
        print(f"   Gateway: {'✅ 正常' if gateway_ok else '❌ 失败'}")
    else:
        print("   Gateway: ⚠️ 跳过（未设置 WECHAT_AUTH_TOKEN）")
        gateway_ok = False

    # 4. 总体状态
    print("\n=== 检查结果 ===")

    all_ok = python_ok and deps_ok and wxauto_ok
    if gateway_url and token:
        all_ok = all_ok and gateway_ok

    if all_ok:
        print("✅ 系统正常，可以启动 Bridge")
        print("\n建议操作：")
        print("1. 确保微信客户端已登录")
        print("2. 启动 Bridge: python bridge.py --gateway ws://127.0.0.1:19001 --token <your-token> -v")
        sys.exit(0)
    else:
        print("❌ 系统有问题，需要修复")
        print("\n修复建议：")
        if not python_ok:
            print("- 安装 Python 3.8+")
        if not deps_ok:
            print("- 运行: pip install -r requirements.txt")
        if not wxauto_ok:
            print("- 确保 wxauto 库可用（my-docs/wxauto-main 目录存在）")
        if token and not gateway_ok:
            print("- 检查 Gateway 是否运行，token 是否正确")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())