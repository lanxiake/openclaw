"""
微信桥接主程序
WebSocket 服务器，等待 OpenClaw 连接，实现微信消息桥接
"""

import argparse
import asyncio
import json
import logging
import signal
import sys
from typing import Any, Optional, Set

import websockets
from websockets.server import WebSocketServerProtocol

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
    作为 WebSocket 服务器，等待 OpenClaw 连接，转发微信消息
    """

    def __init__(self, host: str = "0.0.0.0", port: int = 18790):
        """
        初始化桥接器

        参数:
            host: 监听地址
            port: 监听端口
        """
        self.host = host
        self.port = port
        self.wechat = WeChatHandler()
        self.clients: Set[WebSocketServerProtocol] = set()
        self._running = False
        self._server = None

        # 设置微信回调
        self.wechat.set_message_callback(self._on_wechat_message)
        self.wechat.set_status_callback(self._on_wechat_status)

    async def start(self) -> None:
        """启动桥接器"""
        self._running = True
        logger.info(f"启动微信桥接器，监听: {self.host}:{self.port}")

        # 首先连接微信
        if not self.wechat.connect():
            logger.error("微信连接失败，退出")
            return

        # 启动 WebSocket 服务器
        self._server = await websockets.serve(
            self._handle_client,
            self.host,
            self.port,
            ping_interval=30,
            ping_timeout=10
        )

        logger.info(f"WebSocket 服务器已启动: ws://{self.host}:{self.port}")

        # 保持运行
        while self._running:
            await asyncio.sleep(1)

    async def stop(self) -> None:
        """停止桥接器"""
        logger.info("正在停止桥接器...")
        self._running = False

        # 关闭所有客户端连接
        for client in list(self.clients):
            await client.close()

        # 关闭服务器
        if self._server:
            self._server.close()
            await self._server.wait_closed()

        self.wechat.disconnect()
        logger.info("桥接器已停止")

    async def _handle_client(self, websocket: WebSocketServerProtocol) -> None:
        """处理客户端连接"""
        client_addr = websocket.remote_address
        logger.info(f"新客户端连接: {client_addr}")
        self.clients.add(websocket)

        try:
            # 发送连接成功通知
            await self._send_to_client(websocket, {
                "type": "connected",
                "wxid": self.wechat.get_wxid(),
                "nickname": self.wechat.get_nickname(),
            })

            # 接收消息循环
            async for message in websocket:
                try:
                    await self._handle_message(websocket, message)
                except Exception as e:
                    logger.error(f"处理消息失败: {e}")
                    await self._send_to_client(websocket, {
                        "type": "error",
                        "message": str(e),
                    })

        except websockets.ConnectionClosed as e:
            logger.info(f"客户端断开连接: {client_addr} ({e})")
        except Exception as e:
            logger.error(f"客户端处理异常: {e}")
        finally:
            self.clients.discard(websocket)
            logger.info(f"客户端已移除: {client_addr}")

    async def _handle_message(self, websocket: WebSocketServerProtocol, raw_message: str) -> None:
        """
        处理收到的消息

        参数:
            websocket: WebSocket 连接
            raw_message: 原始 JSON 字符串
        """
        try:
            message = json.loads(raw_message)
        except json.JSONDecodeError as e:
            logger.error(f"JSON 解析失败: {e}")
            await self._send_to_client(websocket, {
                "type": "error",
                "message": "Invalid JSON",
            })
            return

        msg_type = message.get("type")
        logger.debug(f"收到消息: {msg_type}")

        if msg_type == "send":
            await self._handle_send(websocket, message)
        elif msg_type == "sendFile":
            await self._handle_send_file(websocket, message)
        elif msg_type == "addListen":
            await self._handle_add_listen(websocket, message)
        elif msg_type == "removeListen":
            await self._handle_remove_listen(websocket, message)
        elif msg_type == "getChats":
            await self._handle_get_chats(websocket)
        elif msg_type == "ping":
            await self._send_to_client(websocket, {"type": "pong"})
        else:
            logger.warning(f"未知消息类型: {msg_type}")
            await self._send_to_client(websocket, {
                "type": "error",
                "message": f"Unknown message type: {msg_type}",
            })

    async def _handle_send(self, websocket: WebSocketServerProtocol, message: dict) -> None:
        """处理发送消息请求"""
        to = message.get("to")
        text = message.get("text")

        if not to or not text:
            await self._send_to_client(websocket, {
                "type": "error",
                "message": "Missing required params: to, text",
            })
            return

        # 在线程池中执行同步操作
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self.wechat.send_message,
            to,
            text
        )

        await self._send_to_client(websocket, {
            "type": "sendResult",
            "success": result.get("success", False),
            "error": result.get("error"),
        })

    async def _handle_send_file(self, websocket: WebSocketServerProtocol, message: dict) -> None:
        """处理发送文件请求"""
        to = message.get("to")
        file_path = message.get("filePath")

        if not to or not file_path:
            await self._send_to_client(websocket, {
                "type": "error",
                "message": "Missing required params: to, filePath",
            })
            return

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self.wechat.send_file,
            to,
            file_path
        )

        await self._send_to_client(websocket, {
            "type": "sendFileResult",
            "success": result.get("success", False),
            "error": result.get("error"),
        })

    async def _handle_add_listen(self, websocket: WebSocketServerProtocol, message: dict) -> None:
        """处理添加监听请求"""
        chat_name = message.get("chatName")

        if not chat_name:
            await self._send_to_client(websocket, {
                "type": "error",
                "message": "Missing required param: chatName",
            })
            return

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self.wechat.add_listener,
            chat_name
        )

        await self._send_to_client(websocket, {
            "type": "addListenResult",
            "success": result.get("success", False),
            "chatName": chat_name,
            "error": result.get("error"),
        })

    async def _handle_remove_listen(self, websocket: WebSocketServerProtocol, message: dict) -> None:
        """处理移除监听请求"""
        chat_name = message.get("chatName")

        if not chat_name:
            await self._send_to_client(websocket, {
                "type": "error",
                "message": "Missing required param: chatName",
            })
            return

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self.wechat.remove_listener,
            chat_name
        )

        await self._send_to_client(websocket, {
            "type": "removeListenResult",
            "success": result.get("success", False),
            "chatName": chat_name,
        })

    async def _handle_get_chats(self, websocket: WebSocketServerProtocol) -> None:
        """处理获取聊天列表请求"""
        loop = asyncio.get_event_loop()
        chats = await loop.run_in_executor(
            None,
            self.wechat.get_chat_list
        )

        await self._send_to_client(websocket, {
            "type": "chats",
            "chats": chats,
        })

    def _on_wechat_message(self, msg: WeChatMessage) -> None:
        """微信消息回调"""
        # 广播消息给所有客户端
        asyncio.create_task(self._broadcast({
            "type": "message",
            "data": {
                "from": msg.sender,
                "to": msg.chat_name,
                "text": msg.content,
                "chatType": "group" if msg.is_group else "direct",
                "groupName": msg.chat_name if msg.is_group else None,
                "senderName": msg.sender_name,
                "timestamp": msg.timestamp,
                "msgType": msg.msg_type,
            }
        }))

    def _on_wechat_status(self, status: WeChatStatus) -> None:
        """微信状态变更回调"""
        asyncio.create_task(self._broadcast({
            "type": "status",
            "connected": status == WeChatStatus.CONNECTED,
            "status": status.value,
        }))

    async def _send_to_client(self, websocket: WebSocketServerProtocol, data: dict) -> None:
        """发送消息给指定客户端"""
        try:
            await websocket.send(json.dumps(data, ensure_ascii=False))
        except Exception as e:
            logger.error(f"发送消息失败: {e}")

    async def _broadcast(self, data: dict) -> None:
        """广播消息给所有客户端"""
        if not self.clients:
            return

        message = json.dumps(data, ensure_ascii=False)
        for client in list(self.clients):
            try:
                await client.send(message)
            except Exception as e:
                logger.error(f"广播消息失败: {e}")


def parse_args() -> argparse.Namespace:
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="微信桥接器 - WebSocket 服务器，等待 OpenClaw 连接",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s --port 18790
  %(prog)s -p 18790 --host 0.0.0.0
        """
    )

    parser.add_argument(
        "-H", "--host",
        default="0.0.0.0",
        help="监听地址 (默认: 0.0.0.0)"
    )

    parser.add_argument(
        "-p", "--port",
        type=int,
        default=18790,
        help="监听端口 (默认: 18790)"
    )

    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="启用详细日志"
    )

    return parser.parse_args()


async def main() -> None:
    """主函数"""
    args = parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    bridge = WeChatBridge(host=args.host, port=args.port)

    # 设置信号处理
    loop = asyncio.get_event_loop()

    def signal_handler():
        logger.info("收到退出信号")
        asyncio.create_task(bridge.stop())

    # Windows 不支持 add_signal_handler，使用替代方案
    if sys.platform != "win32":
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, signal_handler)

    try:
        await bridge.start()
    except KeyboardInterrupt:
        logger.info("用户中断")
    finally:
        await bridge.stop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
