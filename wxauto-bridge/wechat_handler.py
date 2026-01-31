"""
微信处理器模块 - 支持微信 4.x
使用 pyautogui 键盘快捷键和剪贴板操作
"""

import ctypes
import hashlib
import logging
import re
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, List, Optional

import pyautogui
import pyperclip
import win32api
import win32con
import win32gui
import win32process

# 配置日志
logger = logging.getLogger(__name__)

# pyautogui 配置
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.05

# Windows API
user32 = ctypes.windll.user32


class WeChatStatus(Enum):
    """微信状态枚举"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


@dataclass
class WeChatMessage:
    """微信消息数据类"""
    sender: str           # 发送者: "Self" / "Other" / "SYS"
    content: str          # 消息内容
    chat_name: str        # 聊天名称
    msg_type: str = "text"
    timestamp: float = field(default_factory=time.time)
    index: int = 0
    is_group: bool = False


class WeChatHandler:
    """
    微信处理器
    使用 pyautogui 键盘快捷键操作微信 4.x
    """

    VERSION = "4.x"

    def __init__(self):
        self._status: WeChatStatus = WeChatStatus.DISCONNECTED
        self._message_callback: Optional[Callable[[WeChatMessage], None]] = None
        self._status_callback: Optional[Callable[[WeChatStatus], None]] = None
        self._listen_thread: Optional[threading.Thread] = None
        self._stop_listen: bool = False
        self._listen_chats: List[str] = []
        self._lock = threading.Lock()
        self._wxid: Optional[str] = None
        self._nickname: Optional[str] = None

        # 窗口句柄
        self._hwnd: Optional[int] = None

        # 消息追踪
        self._current_chat: str = ""
        self._last_messages_hash: str = ""
        self._all_messages: List[WeChatMessage] = []

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

    def _find_wechat_window(self) -> Optional[int]:
        """查找微信窗口"""
        # 先按标题查找
        hwnd = win32gui.FindWindow(None, '微信')
        if hwnd:
            return hwnd
        # 再按类名查找
        hwnd = win32gui.FindWindow('Qt51514QWindowIcon', None)
        return hwnd

    def _activate_window(self) -> bool:
        """激活微信窗口"""
        if not self._hwnd:
            return False

        try:
            # 如果窗口最小化，先恢复
            if win32gui.IsIconic(self._hwnd):
                win32gui.ShowWindow(self._hwnd, win32con.SW_RESTORE)
                time.sleep(0.3)

            # 使用 AttachThreadInput 绕过前台窗口限制
            current_thread_id = win32api.GetCurrentThreadId()
            target_thread_id = win32process.GetWindowThreadProcessId(self._hwnd)[0]

            if current_thread_id != target_thread_id:
                user32.AttachThreadInput(current_thread_id, target_thread_id, True)

            try:
                # 模拟键盘事件以获取输入焦点
                user32.keybd_event(0, 0, 0, 0)
                user32.keybd_event(0, 0, 2, 0)
                win32gui.SetForegroundWindow(self._hwnd)
                time.sleep(0.2)
            finally:
                if current_thread_id != target_thread_id:
                    user32.AttachThreadInput(current_thread_id, target_thread_id, False)

            return True
        except Exception as e:
            logger.error(f"激活窗口失败: {e}")
            return False

    def connect(self) -> bool:
        """连接微信客户端"""
        try:
            self._set_status(WeChatStatus.CONNECTING)

            # 查找微信窗口
            self._hwnd = self._find_wechat_window()

            if not self._hwnd:
                # 尝试使用快捷键唤醒微信
                pyautogui.hotkey('ctrl', 'alt', 'w')
                time.sleep(0.5)
                self._hwnd = self._find_wechat_window()

            if not self._hwnd:
                raise Exception("未找到微信窗口，请确保微信已启动并登录")

            # 获取窗口信息
            self._nickname = "WeChat User"
            self._wxid = f"wxid_{self._hwnd}"

            logger.info(f"找到微信窗口: hwnd={self._hwnd}")

            # 激活窗口
            self._activate_window()

            self._set_status(WeChatStatus.CONNECTED)
            logger.info(f"微信客户端连接成功: {self._nickname}")
            return True

        except Exception as e:
            logger.error(f"微信客户端连接失败: {e}")
            self._set_status(WeChatStatus.ERROR)
            return False

    def disconnect(self) -> None:
        """断开微信连接"""
        self._stop_listen = True
        if self._listen_thread and self._listen_thread.is_alive():
            self._listen_thread.join(timeout=5)
        self._hwnd = None
        self._set_status(WeChatStatus.DISCONNECTED)
        logger.info("微信客户端已断开")

    def _search_and_open_chat(self, chat_name: str) -> bool:
        """搜索并打开聊天"""
        try:
            if not self._activate_window():
                return False

            time.sleep(0.3)

            # 使用 Ctrl+F 打开搜索
            pyautogui.hotkey('ctrl', 'f')
            time.sleep(0.3)

            # 清空搜索框并输入
            pyautogui.hotkey('ctrl', 'a')
            time.sleep(0.1)

            # 通过剪贴板粘贴搜索内容
            pyperclip.copy(chat_name)
            pyautogui.hotkey('ctrl', 'v')
            time.sleep(0.3)

            # # 按向下键选择第一个结果
            # pyautogui.press('down')
            # time.sleep(0.2)

            # 按回车打开聊天
            pyautogui.press('enter')
            time.sleep(0.5)

            self._current_chat = chat_name
            return True

        except Exception as e:
            logger.error(f"搜索聊天失败: {e}")
            return False

    def send_message(self, chat_name: str, message: str) -> dict:
        """发送文本消息"""
        if not self._hwnd:
            return {"success": False, "error": "微信未连接"}

        try:
            with self._lock:
                # 搜索并打开聊天
                if not self._search_and_open_chat(chat_name):
                    return {"success": False, "error": f"无法找到聊天: {chat_name}"}

                time.sleep(0.3)

                # 通过剪贴板粘贴消息
                pyperclip.copy(message)
                pyautogui.hotkey('ctrl', 'v')
                time.sleep(0.2)

                # 发送消息
                pyautogui.press('enter')
                time.sleep(0.1)

            logger.info(f"消息发送成功: {chat_name}")
            return {"success": True}

        except Exception as e:
            error_msg = f"发送消息失败: {e}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}

    def send_file(self, chat_name: str, file_path: str) -> dict:
        """发送文件"""
        # TODO: 实现文件发送
        return {"success": False, "error": "文件发送功能暂未实现"}

    def _read_chat_messages(self) -> Optional[str]:
        """读取当前聊天的消息（使用双击复制方法）"""
        try:
            if not self._activate_window():
                return None

            # 获取窗口位置
            rect = win32gui.GetWindowRect(self._hwnd)
            left, top, right, bottom = rect
            width = right - left
            height = bottom - top

            # 先单击消息区域，确保焦点在消息列表
            msg_area_x = left + int(width * 0.85)
            msg_area_y = top + int(height * 0.50)
            pyautogui.click(msg_area_x, msg_area_y)
            time.sleep(0.2)

            # 消息位置（基于测试结果，比例约 0.9, 0.64）
            msg_x = left + int(width * 0.90)
            msg_y = top + int(height * 0.64)

            # 清空剪贴板
            pyperclip.copy("")

            # 双击消息
            pyautogui.doubleClick(msg_x, msg_y)
            time.sleep(0.2)

            # Ctrl+C 复制
            pyautogui.hotkey('ctrl', 'c')
            time.sleep(0.2)

            # 读取剪贴板
            content = pyperclip.paste()

            # 按 Escape 取消选择
            pyautogui.press('escape')

            return content if content else None

        except Exception as e:
            logger.error(f"读取聊天消息失败: {e}")
            return None

    def _parse_messages(self, content: str) -> List[WeChatMessage]:
        """解析消息内容"""
        messages = []
        if not content:
            return messages

        # 简单的消息解析
        # 微信复制的消息格式通常是：
        # 发送者名称
        # 消息内容
        # 或者
        # 发送者名称 时间
        # 消息内容

        lines = content.strip().split('\n')
        current_sender = "Other"
        current_content = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # 检查是否是时间戳行（如 "12:34" 或 "昨天 12:34"）
            if re.match(r'^(\d{1,2}:\d{2}|昨天|前天|\d+月\d+日)', line):
                continue

            # 检查是否是发送者行
            # 通常发送者行比较短，且不包含特殊字符
            if len(line) < 20 and not any(c in line for c in ['。', '，', '！', '？', '：', '、']):
                # 保存之前的消息
                if current_content:
                    msg = WeChatMessage(
                        sender=current_sender,
                        content='\n'.join(current_content),
                        chat_name=self._current_chat,
                        index=len(messages)
                    )
                    messages.append(msg)
                    current_content = []

                # 判断发送者
                if line == self._nickname or line == "我":
                    current_sender = "Self"
                else:
                    current_sender = "Other"
            else:
                current_content.append(line)

        # 保存最后一条消息
        if current_content:
            msg = WeChatMessage(
                sender=current_sender,
                content='\n'.join(current_content),
                chat_name=self._current_chat,
                index=len(messages)
            )
            messages.append(msg)

        return messages

    def get_new_message(self) -> Optional[WeChatMessage]:
        """检查并获取新消息"""
        try:
            content = self._read_chat_messages()
            if not content:
                return None

            # 计算内容哈希
            content_hash = hashlib.md5(content.encode()).hexdigest()

            # 检查是否有新消息
            if content_hash != self._last_messages_hash:
                self._last_messages_hash = content_hash

                # 创建消息对象
                # 注意：双击复制只能获取消息内容，无法判断发送者
                # 假设最新消息是对方发送的（因为我们主要监听对方的消息）
                msg = WeChatMessage(
                    sender="Other",
                    content=content,
                    chat_name=self._current_chat,
                    index=len(self._all_messages)
                )
                self._all_messages.append(msg)

                # 触发回调
                if self._message_callback:
                    self._message_callback(msg)

                return msg

            return None

        except Exception as e:
            logger.error(f"获取新消息失败: {e}")
            return None

    def start_listening(self, interval: float = 2.0) -> None:
        """开始监听新消息"""
        self._stop_listen = False

        def listen_loop():
            while not self._stop_listen:
                for chat_name in self._listen_chats:
                    if self._stop_listen:
                        break
                    # 切换到监听的聊天
                    if self._search_and_open_chat(chat_name):
                        time.sleep(0.5)
                        self.get_new_message()
                time.sleep(interval)

        self._listen_thread = threading.Thread(target=listen_loop, daemon=True)
        self._listen_thread.start()
        logger.info("开始监听新消息")

    def stop_listening(self) -> None:
        """停止监听新消息"""
        self._stop_listen = True
        if self._listen_thread:
            self._listen_thread.join(timeout=5)
        logger.info("停止监听新消息")

    def get_all_messages(self) -> List[WeChatMessage]:
        """获取所有消息"""
        content = self._read_chat_messages()
        if content:
            return self._parse_messages(content)
        return []

    def get_status(self) -> dict:
        """获取微信状态信息"""
        return {
            "status": self._status.value,
            "connected": self._status == WeChatStatus.CONNECTED,
            "listening_chats": self._listen_chats.copy(),
            "nickname": self._nickname,
            "wxid": self._wxid,
            "current_chat": self._current_chat,
            "message_count": len(self._all_messages),
        }

    def add_listener(self, chat_name: str) -> dict:
        """添加聊天监听"""
        if chat_name not in self._listen_chats:
            self._listen_chats.append(chat_name)
            logger.info(f"添加监听: {chat_name}")

        return {
            "success": True,
            "listening": self._listen_chats.copy(),
        }

    def remove_listener(self, chat_name: str) -> dict:
        """移除聊天监听"""
        if chat_name in self._listen_chats:
            self._listen_chats.remove(chat_name)
            logger.info(f"移除监听: {chat_name}")

        return {"success": True, "listening": self._listen_chats.copy()}

    def get_chat_list(self) -> List[str]:
        """获取聊天列表"""
        # TODO: 实现获取聊天列表
        return []

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
