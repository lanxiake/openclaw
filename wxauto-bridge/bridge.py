"""
微信桥接主程序
WebSocket 客户端，主动连接 OpenClaw Gateway，实现微信消息桥接

架构：
  wxauto-bridge (Python Client) ──WebSocket──► OpenClaw Gateway (Node.js)
                                   连接
  wxauto library ◄──JSON-RPC── OpenClaw
       ↓            命令
  微信 Windows 客户端
"""

import argparse
import asyncio
import json
import logging
import os
import signal
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, Optional

import websockets
from websockets.client import WebSocketClientProtocol

from wechat_handler import WeChatHandler, WeChatMessage, WeChatStatus

# 配置日志格式
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class WeChatBridge:
    """
    微信桥接器
    作为 WebSocket 客户端，主动连接 OpenClaw Gateway，转发微信消息
    """

    def __init__(self, gateway_url: str = "ws://localhost:18789", auth_token: str = ""):
        """
        初始化桥接器

        参数:
            gateway_url: OpenClaw Gateway WebSocket 地址
            auth_token: 认证令牌
        """
        self.gateway_url = gateway_url.rstrip('/')
        self.auth_token = auth_token
        # 构建带认证的 WebSocket URL
        ws_path = "/channels/wechat"
        if auth_token:
            ws_path = f"{ws_path}?token={auth_token}"
        self.ws_url = f"{self.gateway_url}{ws_path}"
        self.wechat = WeChatHandler()
        self.ws: Optional[WebSocketClientProtocol] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._running = False
        self._reconnect_delay = 5  # 重连延迟（秒）
        self._pending_requests: Dict[str, asyncio.Future] = {}

        # 设置微信回调
        self.wechat.set_message_callback(self._on_wechat_message)
        self.wechat.set_status_callback(self._on_wechat_status)

    async def connect(self) -> bool:
        """连接到 OpenClaw Gateway"""
        try:
            logger.info(f"正在连接到 OpenClaw Gateway: {self.ws_url}")
            self.ws = await websockets.connect(
                self.ws_url,
                ping_interval=30,
                ping_timeout=10
            )
            logger.info("WebSocket 连接成功")
            return True
        except Exception as e:
            logger.error(f"WebSocket 连接失败: {e}")
            return False

    async def start(self, listen_chats: list = None) -> None:
        """启动桥接器

        参数:
            listen_chats: 要监听的聊天列表
        """
        self._running = True
        self._loop = asyncio.get_running_loop()
        logger.info("启动微信桥接器")

        # 首先连接微信
        if not self.wechat.connect():
            logger.error("微信连接失败，退出")
            return

        # 添加监听
        if listen_chats:
            logger.info(f"添加监听: {listen_chats}")
            for chat_name in listen_chats:
                result = self.wechat.add_listener(chat_name)
                if result.get('success'):
                    logger.info(f"监听 {chat_name} 成功")
                else:
                    logger.warning(f"监听 {chat_name} 失败: {result.get('error', '未知错误')}")

        # 连接到 Gateway 并保持运行
        while self._running:
            try:
                if not await self.connect():
                    logger.info(f"{self._reconnect_delay}秒后重试连接...")
                    await asyncio.sleep(self._reconnect_delay)
                    continue

                # 发送连接成功通知
                await self._send_connected_notification()

                # 启动消息处理循环
                await self._message_loop()

            except websockets.ConnectionClosed as e:
                logger.warning(f"WebSocket 连接断开: {e}")
                if self._running:
                    logger.info(f"{self._reconnect_delay}秒后重试连接...")
                    await asyncio.sleep(self._reconnect_delay)
            except Exception as e:
                logger.error(f"发生错误: {e}")
                if self._running:
                    await asyncio.sleep(self._reconnect_delay)

    async def stop(self) -> None:
        """停止桥接器"""
        logger.info("正在停止桥接器...")
        self._running = False

        if self.ws:
            await self.ws.close()

        self.wechat.disconnect()
        logger.info("桥接器已停止")

    async def _message_loop(self) -> None:
        """消息处理循环"""
        async for message in self.ws:
            try:
                data = json.loads(message)
                await self._handle_message(data)
            except json.JSONDecodeError as e:
                logger.error(f"JSON 解析错误: {e}")
            except Exception as e:
                logger.error(f"处理消息错误: {e}")

    async def _handle_message(self, data: dict) -> None:
        """处理来自 Gateway 的消息"""
        # 检查是否是响应消息
        if "id" in data and "result" in data:
            request_id = data["id"]
            if request_id in self._pending_requests:
                self._pending_requests[request_id].set_result(data.get("result"))
            return

        # 处理 JSON-RPC 请求
        method = data.get("method")
        params = data.get("params", {})
        request_id = data.get("id")

        logger.debug(f"收到命令: {method}, params: {params}")

        result = None
        error = None

        try:
            if method == "send":
                result = await self._handle_send(params)
            elif method == "sendFile":
                result = await self._handle_send_file(params)
            elif method == "getStatus":
                result = await self._handle_get_status(params)
            elif method == "getContacts":
                result = await self._handle_get_contacts(params)
            elif method == "addListen":
                result = await self._handle_add_listen(params)
            elif method == "removeListen":
                result = await self._handle_remove_listen(params)
            elif method == "ping":
                result = {"pong": True, "timestamp": int(time.time() * 1000)}
            else:
                error = {"code": -32601, "message": f"Method not found: {method}"}
        except Exception as e:
            error = {"code": -32000, "message": str(e)}

        # 发送响应
        if request_id:
            await self._send_response(request_id, result, error)

    async def _handle_send(self, params: dict) -> dict:
        """处理发送消息命令"""
        to = params.get("to")
        text = params.get("text", "")
        files = params.get("files", [])
        at = params.get("at")  # @用户列表

        if not to:
            return {"ok": False, "error": "Missing 'to' parameter"}

        # 发送文件
        if files:
            for file_path in files:
                result = self.wechat.send_file(to, file_path)
                if not result.get("success"):
                    return {"ok": False, "error": result.get("error")}

        # 发送文本（支持 @功能）
        if text:
            # 将 at 参数转换为列表
            at_list = None
            if at:
                at_list = [at] if isinstance(at, str) else at

            result = self.wechat.send_message(to, text, at=at_list)
            if not result.get("success"):
                return {"ok": False, "error": result.get("error")}

        return {"ok": True}

    async def _handle_send_file(self, params: dict) -> dict:
        """处理发送文件命令"""
        to = params.get("to")
        file_path = params.get("filePath")

        if not to or not file_path:
            return {"ok": False, "error": "Missing 'to' or 'filePath' parameter"}

        result = self.wechat.send_file(to, file_path)
        return {"ok": result.get("success", False), "error": result.get("error")}

    async def _handle_get_status(self, params: dict) -> dict:
        """处理获取状态命令"""
        return self.wechat.get_status()

    async def _handle_get_contacts(self, params: dict) -> dict:
        """处理获取联系人列表命令"""
        chats = self.wechat.get_chat_list()
        return {"ok": True, "contacts": chats}

    async def _handle_add_listen(self, params: dict) -> dict:
        """处理添加监听命令"""
        chat = params.get("chat")
        if not chat:
            return {"ok": False, "error": "Missing 'chat' parameter"}

        result = self.wechat.add_listener(chat)
        return {"ok": result.get("success", False), "error": result.get("error")}

    async def _handle_remove_listen(self, params: dict) -> dict:
        """处理移除监听命令"""
        chat = params.get("chat")
        if not chat:
            return {"ok": False, "error": "Missing 'chat' parameter"}

        result = self.wechat.remove_listener(chat)
        return {"ok": result.get("success", False), "error": result.get("error")}

    def _on_wechat_message(self, msg: WeChatMessage) -> None:
        """微信消息回调"""
        # Log metadata only, not message content
        logger.info(f"收到微信消息: from={msg.sender}, chat={msg.chat_name}, type={msg.msg_type}, is_group={msg.is_group}")
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self._push_message(msg), self._loop)
        else:
            logger.warning("事件循环未运行，无法推送消息")

    def _on_wechat_status(self, status: WeChatStatus) -> None:
        """微信状态回调"""
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self._push_status(status), self._loop)

    def _is_ws_connected(self) -> bool:
        """检查 WebSocket 是否已连接"""
        if not self.ws:
            return False
        try:
            # websockets 13.x uses state property
            return self.ws.state.name == "OPEN"
        except AttributeError:
            # Fallback for older versions
            try:
                return not self.ws.closed
            except AttributeError:
                return True

    async def _push_message(self, msg: WeChatMessage) -> None:
        """推送消息到 Gateway"""
        if not self._is_ws_connected():
            logger.warning("WebSocket 未连接，无法推送消息")
            return

        # Log metadata only, not message content
        logger.info(f"推送消息到 Gateway: from={msg.sender}, to={msg.chat_name}, type={msg.msg_type}, is_at_me={msg.is_at_me}")
        await self._send_notification("wechat.message", {
            "from": msg.sender,
            "to": msg.chat_name,
            "text": msg.content,
            "type": msg.msg_type,
            "chatType": "group" if msg.is_group else "friend",
            "timestamp": int(msg.timestamp * 1000),
            "isSelf": msg.is_self,
            "isAtMe": msg.is_at_me
        })

    async def _push_status(self, status: WeChatStatus) -> None:
        """推送状态到 Gateway"""
        if not self._is_ws_connected():
            return

        await self._send_notification("wechat.status", {
            "status": status.value,
            "timestamp": int(time.time() * 1000)
        })

    async def _send_connected_notification(self) -> None:
        """发送连接成功通知"""
        await self._send_notification("wechat.connected", {
            "nickname": self.wechat.get_nickname(),
            "wxid": self.wechat.get_wxid(),
            "online": self.wechat.status == WeChatStatus.CONNECTED,
            "timestamp": int(time.time() * 1000)
        })

    async def _send_notification(self, method: str, params: dict) -> None:
        """发送通知（无需响应）"""
        if not self._is_ws_connected():
            return

        message = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }
        await self.ws.send(json.dumps(message))
        logger.debug(f"发送通知: {method}")

    async def _send_response(self, request_id: str, result: Any = None, error: dict = None) -> None:
        """发送命令响应"""
        if not self._is_ws_connected():
            return

        message = {
            "jsonrpc": "2.0",
            "id": request_id
        }
        if error:
            message["error"] = error
        else:
            message["result"] = result

        await self.ws.send(json.dumps(message))
        logger.debug(f"发送响应: {request_id}")

    async def _send_request(self, method: str, params: dict, timeout: float = 30) -> Any:
        """发送请求并等待响应"""
        if not self._is_ws_connected():
            raise Exception("WebSocket not connected")

        request_id = str(uuid.uuid4())
        message = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params
        }

        future = asyncio.get_event_loop().create_future()
        self._pending_requests[request_id] = future

        try:
            await self.ws.send(json.dumps(message))
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
        finally:
            self._pending_requests.pop(request_id, None)


async def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="微信桥接器 - 连接 OpenClaw Gateway")
    parser.add_argument(
        "--gateway", "-g",
        default="ws://localhost:18789",
        help="OpenClaw Gateway WebSocket 地址 (默认: ws://localhost:18789)"
    )
    parser.add_argument(
        "--token", "-t",
        default="",
        help="认证令牌 (可通过 WECHAT_AUTH_TOKEN 环境变量设置)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="启用详细日志"
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # 优先使用命令行参数，其次使用环境变量
    auth_token = args.token or os.environ.get("WECHAT_AUTH_TOKEN", "")

    bridge = WeChatBridge(gateway_url=args.gateway, auth_token=auth_token)

    # 设置信号处理
    loop = asyncio.get_event_loop()

    def signal_handler():
        logger.info("收到停止信号")
        asyncio.create_task(bridge.stop())

    if sys.platform != "win32":
        loop.add_signal_handler(signal.SIGINT, signal_handler)
        loop.add_signal_handler(signal.SIGTERM, signal_handler)

    try:
        await bridge.start()
    except KeyboardInterrupt:
        logger.info("收到键盘中断")
    finally:
        await bridge.stop()


if __name__ == "__main__":
    asyncio.run(main())
