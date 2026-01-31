"""
微信处理器模块 - 基于 wxauto 库
支持微信 3.x 版本
"""

import logging
import sys
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Callable, Dict, List, Optional

# 添加 wxauto 路径
WXAUTO_PATH = Path(__file__).parent.parent / "my-docs" / "wxauto-main"
if str(WXAUTO_PATH) not in sys.path:
    sys.path.insert(0, str(WXAUTO_PATH))

from wxauto import WeChat
from wxauto.msgs.base import Message

# 配置日志
logger = logging.getLogger(__name__)


class WeChatStatus(Enum):
    """微信状态枚举"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


@dataclass
class WeChatMessage:
    """微信消息数据类"""
    sender: str           # 发送者名称
    content: str          # 消息内容
    chat_name: str        # 聊天名称
    msg_type: str = "text"
    timestamp: float = field(default_factory=time.time)
    is_self: bool = False
    is_group: bool = False


class WeChatHandler:
    """
    微信处理器
    基于 wxauto 库操作微信 3.x
    """

    VERSION = "3.x"

    def __init__(self):
        self._status: WeChatStatus = WeChatStatus.DISCONNECTED
        self._message_callback: Optional[Callable[[WeChatMessage], None]] = None
        self._status_callback: Optional[Callable[[WeChatStatus], None]] = None
        self._stop_listen: bool = False
        self._listen_chats: Dict[str, any] = {}
        self._lock = threading.Lock()

        # wxauto 实例
        self._wx: Optional[WeChat] = None
        self._nickname: Optional[str] = None
        self._wxid: Optional[str] = None

    @property
    def status(self) -> WeChatStatus:
        return self._status

    def _set_status(self, status: WeChatStatus) -> None:
        if self._status != status:
            self._status = status
            logger.info(f"微信状态变更: {status.value}")
            if self._status_callback:
                try:
                    self._status_callback(status)
                except Exception as e:
                    logger.error(f"状态回调执行失败: {e}")

    def connect(self) -> bool:
        """连接微信客户端"""
        try:
            self._set_status(WeChatStatus.CONNECTING)

            # 初始化 wxauto
            self._wx = WeChat()
            self._nickname = self._wx.nickname
            self._wxid = f"wxid_{id(self._wx)}"

            logger.info(f"微信客户端连接成功: {self._nickname}")
            self._set_status(WeChatStatus.CONNECTED)
            return True

        except Exception as e:
            logger.error(f"微信客户端连接失败: {e}")
            self._set_status(WeChatStatus.ERROR)
            return False

    def disconnect(self) -> None:
        """断开微信连接"""
        self._stop_listen = True
        if self._wx:
            try:
                self._wx.StopListening(remove=True)
            except:
                pass
        self._wx = None
        self._set_status(WeChatStatus.DISCONNECTED)
        logger.info("微信客户端已断开")

    def send_message(self, chat_name: str, message: str) -> dict:
        """发送文本消息"""
        if not self._wx:
            return {"success": False, "error": "微信未连接"}

        try:
            with self._lock:
                # 发送消息
                result = self._wx.SendMsg(msg=message, who=chat_name)

                if result.success:
                    logger.info(f"消息发送成功: {chat_name}")
                    return {"success": True}
                else:
                    return {"success": False, "error": result.message}

        except Exception as e:
            error_msg = f"发送消息失败: {e}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}

    def send_file(self, chat_name: str, file_path: str) -> dict:
        """发送文件"""
        if not self._wx:
            return {"success": False, "error": "微信未连接"}

        try:
            with self._lock:
                result = self._wx.SendFiles(filepath=file_path, who=chat_name)

                if result.success:
                    logger.info(f"文件发送成功: {chat_name}")
                    return {"success": True}
                else:
                    return {"success": False, "error": result.message}

        except Exception as e:
            error_msg = f"发送文件失败: {e}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}

    def _on_message(self, msg: Message, chat) -> None:
        """wxauto 消息回调"""
        try:
            # 转换为 WeChatMessage
            wechat_msg = WeChatMessage(
                sender=msg.sender if hasattr(msg, 'sender') else str(chat),
                content=msg.content if hasattr(msg, 'content') else str(msg),
                chat_name=str(chat),
                msg_type=msg.type if hasattr(msg, 'type') else "text",
                is_self=msg.attr == "self" if hasattr(msg, 'attr') else False,
            )

            # 触发回调
            if self._message_callback and not wechat_msg.is_self:
                self._message_callback(wechat_msg)

        except Exception as e:
            logger.error(f"处理消息失败: {e}")

    def add_listener(self, chat_name: str) -> dict:
        """添加聊天监听"""
        if not self._wx:
            return {"success": False, "error": "微信未连接"}

        try:
            if chat_name in self._listen_chats:
                return {"success": True, "message": "已在监听列表中"}

            # 使用 wxauto 的监听功能
            result = self._wx.AddListenChat(chat_name, self._on_message)

            if result:
                self._listen_chats[chat_name] = result
                logger.info(f"添加监听成功: {chat_name}")
                return {"success": True, "listening": list(self._listen_chats.keys())}
            else:
                return {"success": False, "error": "添加监听失败"}

        except Exception as e:
            error_msg = f"添加监听失败: {e}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}

    def remove_listener(self, chat_name: str) -> dict:
        """移除聊天监听"""
        if not self._wx:
            return {"success": False, "error": "微信未连接"}

        try:
            if chat_name not in self._listen_chats:
                return {"success": True, "message": "不在监听列表中"}

            # 使用 wxauto 移除监听
            self._wx.RemoveListenChat(chat_name)
            del self._listen_chats[chat_name]

            logger.info(f"移除监听成功: {chat_name}")
            return {"success": True, "listening": list(self._listen_chats.keys())}

        except Exception as e:
            error_msg = f"移除监听失败: {e}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}

    def get_chat_list(self) -> List[str]:
        """获取会话列表"""
        if not self._wx:
            return []

        try:
            sessions = self._wx.GetSession()
            return [str(s) for s in sessions]
        except Exception as e:
            logger.error(f"获取会话列表失败: {e}")
            return []

    def get_new_messages(self) -> Dict[str, List[WeChatMessage]]:
        """获取新消息"""
        if not self._wx:
            return {}

        try:
            result = {}
            msgs_dict = self._wx.GetNextNewMessage()

            for chat_name, msgs in msgs_dict.items():
                result[chat_name] = []
                for msg in msgs:
                    wechat_msg = WeChatMessage(
                        sender=msg.sender if hasattr(msg, 'sender') else chat_name,
                        content=msg.content if hasattr(msg, 'content') else str(msg),
                        chat_name=chat_name,
                        msg_type=msg.type if hasattr(msg, 'type') else "text",
                        is_self=msg.attr == "self" if hasattr(msg, 'attr') else False,
                    )
                    result[chat_name].append(wechat_msg)

            return result

        except Exception as e:
            logger.error(f"获取新消息失败: {e}")
            return {}

    def get_status(self) -> dict:
        """获取微信状态信息"""
        return {
            "status": self._status.value,
            "connected": self._status == WeChatStatus.CONNECTED,
            "listening_chats": list(self._listen_chats.keys()),
            "nickname": self._nickname,
            "wxid": self._wxid,
        }

    def get_wxid(self) -> Optional[str]:
        return self._wxid

    def get_nickname(self) -> Optional[str]:
        return self._nickname

    def set_message_callback(self, callback: Callable[[WeChatMessage], None]) -> None:
        """设置消息回调函数"""
        self._message_callback = callback

    def set_status_callback(self, callback: Callable[[WeChatStatus], None]) -> None:
        """设置状态回调函数"""
        self._status_callback = callback

    def chat_with(self, who: str) -> bool:
        """切换到指定聊天"""
        if not self._wx:
            return False

        try:
            self._wx.ChatWith(who)
            return True
        except Exception as e:
            logger.error(f"切换聊天失败: {e}")
            return False

    def get_my_info(self) -> dict:
        """获取当前登录用户信息"""
        if not self._wx:
            return {}

        try:
            return self._wx.GetMyInfo()
        except Exception as e:
            logger.error(f"获取用户信息失败: {e}")
            return {}
