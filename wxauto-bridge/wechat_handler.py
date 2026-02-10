"""
微信处理器模块 - 基于 wxauto 库
支持微信 3.x 版本
"""

import logging
import os
import sys
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

# 添加 wxauto 路径
WXAUTO_PATH = Path(__file__).parent.parent / "my-docs" / "wxauto-main"
if str(WXAUTO_PATH) not in sys.path:
    sys.path.insert(0, str(WXAUTO_PATH))

from wxauto import WeChat
from wxauto.msgs.base import Message

# 配置日志
logger = logging.getLogger(__name__)

# 允许发送文件的目录白名单（可通过环境变量配置）
ALLOWED_FILE_DIRS = os.environ.get("WECHAT_ALLOWED_FILE_DIRS", "").split(os.pathsep)
ALLOWED_FILE_DIRS = [d.strip() for d in ALLOWED_FILE_DIRS if d.strip()]


def validate_file_path(file_path: str) -> tuple[bool, str]:
    """
    验证文件路径安全性

    Returns:
        (is_valid, error_message)
    """
    try:
        # 转换为绝对路径并规范化
        path = Path(file_path).resolve()

        # 检查文件是否存在
        if not path.exists():
            return False, f"文件不存在: {file_path}"

        # 检查是否是文件（不是目录）
        if not path.is_file():
            return False, f"路径不是文件: {file_path}"

        # 检查路径遍历攻击（确保规范化后的路径不包含 ..）
        if ".." in str(path):
            return False, f"路径包含非法字符: {file_path}"

        # 如果配置了白名单目录，检查文件是否在白名单目录中
        if ALLOWED_FILE_DIRS:
            is_allowed = False
            for allowed_dir in ALLOWED_FILE_DIRS:
                allowed_path = Path(allowed_dir).resolve()
                try:
                    path.relative_to(allowed_path)
                    is_allowed = True
                    break
                except ValueError:
                    continue

            if not is_allowed:
                return False, f"文件不在允许的目录中: {file_path}"

        return True, ""

    except Exception as e:
        return False, f"路径验证失败: {e}"


class WeChatStatus(Enum):
    """微信状态枚举"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


@dataclass
class WeChatMessage:
    """微信消息数据类

    支持多媒体消息类型：text, image, video, voice, file, link, location, emotion, quote, merge, personal_card, note, other
    """
    sender: str           # 发送者名称
    content: str          # 消息内容
    chat_name: str        # 聊天名称
    msg_type: str = "text"
    timestamp: float = field(default_factory=time.time)
    is_self: bool = False
    is_group: bool = False
    is_at_me: bool = False  # 是否@了当前账号
    # 多媒体消息字段
    media_path: Optional[str] = None      # 本地文件路径
    media_url: Optional[str] = None       # HTTP URL (由 MediaServer 提供)
    file_name: Optional[str] = None       # 文件名 (文件消息)
    file_size: Optional[str] = None       # 文件大小 (文件消息)
    voice_text: Optional[str] = None      # 语音转文字内容


class WeChatHandler:
    """
    微信处理器
    基于 wxauto 库操作微信 3.x
    支持多媒体消息接收和发送
    """

    VERSION = "3.x"
    # 支持下载的多媒体消息类型
    DOWNLOADABLE_TYPES = {'image', 'video', 'file'}
    # 支持语音转文字的消息类型
    VOICE_TYPES = {'voice'}

    def __init__(self, media_dir: Optional[str] = None, media_port: int = 18790):
        """初始化微信处理器

        Args:
            media_dir: 多媒体文件保存目录，默认为当前目录下的 media 文件夹
            media_port: HTTP 文件服务端口，默认 18790
        """
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

        # 多媒体文件配置
        self._media_dir = Path(media_dir) if media_dir else Path(__file__).parent / "media"
        self._media_port = media_port
        self._media_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"多媒体文件保存目录: {self._media_dir}")

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

    def connect(self, debug: bool = False) -> bool:
        """连接微信客户端

        Args:
            debug: 是否启用 wxauto debug 模式
        """
        try:
            self._set_status(WeChatStatus.CONNECTING)

            # 初始化 wxauto（debug 模式启用 wxauto 内部日志）
            self._wx = WeChat(debug=debug)
            self._nickname = self._wx.nickname
            self._wxid = f"wxid_{id(self._wx)}"

            logger.info(f"微信客户端连接成功: {self._nickname}, debug={debug}")
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

    def send_message(self, chat_name: str, message: str, at: Optional[List[str]] = None) -> dict:
        """发送文本消息（带剪贴板重试）

        Args:
            chat_name: 聊天名称
            message: 消息内容
            at: @用户列表（仅群聊有效）
        """
        if not self._wx:
            return {"success": False, "error": "微信未连接"}

        max_retries = 3
        last_error = None

        for attempt in range(1, max_retries + 1):
            try:
                with self._lock:
                    # 发送消息，支持 @功能
                    result = self._wx.SendMsg(msg=message, who=chat_name, at=at)

                    if result.success:
                        logger.info(f"消息发送成功: {chat_name}, at={at}")
                        return {"success": True}
                    else:
                        last_error = result.message
                        logger.warning(f"消息发送失败 (尝试 {attempt}/{max_retries}): {last_error}")

            except Exception as e:
                last_error = str(e)
                logger.warning(f"消息发送异常 (尝试 {attempt}/{max_retries}): {last_error}")

            # 剪贴板竞争时短暂等待后重试
            if attempt < max_retries:
                import time
                time.sleep(0.5)

        error_msg = f"发送消息失败 (已重试 {max_retries} 次): {last_error}"
        logger.error(error_msg)
        return {"success": False, "error": error_msg}

    def send_file(self, chat_name: str, file_path: str) -> dict:
        """发送文件"""
        if not self._wx:
            return {"success": False, "error": "微信未连接"}

        # 验证文件路径安全性
        is_valid, error_msg = validate_file_path(file_path)
        if not is_valid:
            logger.warning(f"文件路径验证失败: {error_msg}")
            return {"success": False, "error": error_msg}

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
        """wxauto 消息回调

        处理各种消息类型，包括多媒体消息的下载
        """
        try:
            msg_type = msg.type if hasattr(msg, 'type') else "text"
            logger.info(f"收到 wxauto 消息回调: chat={chat}, type={msg_type}, msg={msg}")

            # 获取消息内容
            content = msg.content if hasattr(msg, 'content') else str(msg)

            # 判断是否是群聊
            is_group = False
            try:
                if hasattr(msg, 'parent') and msg.parent:
                    chat_info = msg.parent.get_info()
                    is_group = chat_info.get('chat_type') == 'group'
                    logger.info(f"聊天类型: {chat_info.get('chat_type')}, is_group={is_group}")
            except Exception as e:
                logger.warning(f"获取聊天类型失败: {e}")

            # 检测是否@了当前账号
            is_at_me = False
            if self._nickname and f"@{self._nickname}" in content:
                is_at_me = True
                # 移除 @昵称 部分，保留实际消息内容
                content = content.replace(f"@{self._nickname}", "").strip()

            # 处理多媒体消息
            media_path = None
            media_url = None
            file_name = None
            file_size = None
            voice_text = None

            # 下载图片/视频/文件
            if msg_type in self.DOWNLOADABLE_TYPES:
                media_path, media_url = self._download_media(msg, msg_type)
                # 获取文件信息
                if msg_type == 'file' and hasattr(msg, 'filename'):
                    file_name = msg.filename
                    file_size = msg.filesize if hasattr(msg, 'filesize') else None
                    logger.info(f"文件消息: name={file_name}, size={file_size}")

            # 语音转文字
            elif msg_type in self.VOICE_TYPES:
                voice_text = self._convert_voice_to_text(msg)
                if voice_text:
                    logger.info(f"语音转文字成功: {voice_text[:50]}...")

            # 转换为 WeChatMessage
            wechat_msg = WeChatMessage(
                sender=msg.sender if hasattr(msg, 'sender') else str(chat),
                content=content,
                chat_name=str(chat),
                msg_type=msg_type,
                is_self=msg.attr == "self" if hasattr(msg, 'attr') else False,
                is_at_me=is_at_me,
                is_group=is_group,
                media_path=str(media_path) if media_path else None,
                media_url=media_url,
                file_name=file_name,
                file_size=file_size,
                voice_text=voice_text,
            )

            logger.info(f"转换后的消息: sender={wechat_msg.sender}, type={wechat_msg.msg_type}, "
                       f"content={wechat_msg.content[:50] if wechat_msg.content else ''}, "
                       f"is_self={wechat_msg.is_self}, is_at_me={wechat_msg.is_at_me}, "
                       f"media_path={wechat_msg.media_path}")

            # 触发回调
            if self._message_callback and not wechat_msg.is_self:
                logger.info("触发消息回调...")
                self._message_callback(wechat_msg)
            elif wechat_msg.is_self:
                logger.info("跳过自己发送的消息")
            else:
                logger.warning("没有设置消息回调函数")

        except Exception as e:
            logger.error(f"处理消息失败: {e}", exc_info=True)

    def _download_media(self, msg: Message, msg_type: str) -> tuple[Optional[Path], Optional[str]]:
        """下载多媒体文件

        Args:
            msg: wxauto 消息对象
            msg_type: 消息类型 (image, video, file)

        Returns:
            (本地文件路径, HTTP URL)
        """
        try:
            if not hasattr(msg, 'download'):
                logger.warning(f"消息类型 {msg_type} 不支持下载")
                return None, None

            logger.info(f"开始下载 {msg_type} 消息...")

            # 调用 wxauto 的下载方法
            result = msg.download(dir_path=self._media_dir, timeout=30)

            if isinstance(result, Path) and result.exists():
                logger.info(f"下载成功: {result}")
                # 生成 HTTP URL
                media_url = self._get_media_url(result)
                return result, media_url
            else:
                logger.warning(f"下载失败或文件不存在: {result}")
                return None, None

        except Exception as e:
            logger.error(f"下载多媒体文件失败: {e}", exc_info=True)
            return None, None

    def _convert_voice_to_text(self, msg: Message) -> Optional[str]:
        """语音消息转文字

        Args:
            msg: wxauto 语音消息对象

        Returns:
            转换后的文字内容
        """
        try:
            if not hasattr(msg, 'to_text'):
                logger.warning("语音消息不支持转文字")
                return None

            logger.info("开始语音转文字...")
            result = msg.to_text()

            if isinstance(result, str):
                logger.info(f"语音转文字成功: {result[:50]}...")
                return result
            else:
                logger.warning(f"语音转文字失败: {result}")
                return None

        except Exception as e:
            logger.error(f"语音转文字失败: {e}", exc_info=True)
            return None

    def _get_media_url(self, file_path: Path) -> Optional[str]:
        """获取文件的 HTTP URL

        Args:
            file_path: 本地文件路径

        Returns:
            HTTP URL
        """
        try:
            # 获取相对于 media_dir 的路径
            relative_path = file_path.relative_to(self._media_dir)
            # 构建 URL (使用正斜杠)
            url_path = str(relative_path).replace('\\', '/')
            return f"http://localhost:{self._media_port}/media/{url_path}"
        except Exception as e:
            logger.error(f"生成媒体 URL 失败: {e}")
            return None

    def get_media_dir(self) -> Path:
        """获取多媒体文件保存目录"""
        return self._media_dir

    def get_media_port(self) -> int:
        """获取 HTTP 文件服务端口"""
        return self._media_port

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

                # 启动监听线程（如果还没启动）
                self._wx.StartListening()
                logger.info("监听线程已启动")

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
        """获取会话列表，返回会话名称"""
        if not self._wx:
            return []

        try:
            sessions = self._wx.GetSession()
            names = []
            for s in sessions:
                # 尝试获取会话名称
                if hasattr(s, 'name') and s.name:
                    names.append(s.name)
                elif hasattr(s, 'Name') and s.Name:
                    names.append(s.Name)
                elif hasattr(s, 'nickname') and s.nickname:
                    names.append(s.nickname)
                else:
                    # 尝试从字符串表示中提取名称
                    s_str = str(s)
                    if 'Element(' in s_str and ' - ' in s_str:
                        # 格式: <wxauto Session Element(名称 - 消息...)>
                        try:
                            name_part = s_str.split('Element(')[1].split(' - ')[0]
                            names.append(name_part)
                        except:
                            names.append(s_str)
                    else:
                        names.append(s_str)
            return names
        except Exception as e:
            logger.error(f"获取会话列表失败: {e}")
            return []

    def get_chat_list_with_type(self) -> List[Dict[str, Any]]:
        """获取会话列表，包含类型信息"""
        if not self._wx:
            return []

        try:
            sessions = self._wx.GetSession()
            result = []
            for s in sessions:
                name = None
                chat_type = 'friend'  # 默认为好友

                # 尝试获取会话名称
                if hasattr(s, 'name') and s.name:
                    name = s.name
                elif hasattr(s, 'Name') and s.Name:
                    name = s.Name
                elif hasattr(s, 'nickname') and s.nickname:
                    name = s.nickname
                else:
                    # 尝试从字符串表示中提取名称
                    s_str = str(s)
                    if 'Element(' in s_str and ' - ' in s_str:
                        try:
                            name = s_str.split('Element(')[1].split(' - ')[0]
                        except:
                            name = s_str
                    else:
                        name = s_str

                # 尝试判断是否是群聊
                # 方法1: 检查 wxauto 对象属性
                if hasattr(s, 'chattype'):
                    if s.chattype == 'group' or s.chattype == 2:
                        chat_type = 'group'
                elif hasattr(s, 'chat_type'):
                    if s.chat_type == 'group' or s.chat_type == 2:
                        chat_type = 'group'
                # 方法2: 尝试获取聊天信息
                elif hasattr(s, 'get_info'):
                    try:
                        info = s.get_info()
                        if info.get('chat_type') == 'group':
                            chat_type = 'group'
                    except:
                        pass

                # 方法3: 根据名称特征判断（备用）
                if chat_type == 'friend' and name:
                    # 群聊通常有多个成员，名称可能包含特定模式
                    # 这里使用一些常见的群聊名称特征
                    group_keywords = ['群', '交流', '讨论','沟通','应用', '项目', '团队', '部门', '小组','公司', '工作', '家庭', '同学', '朋友']
                    for keyword in group_keywords:
                        if keyword in name:
                            chat_type = 'group'
                            break

                if name:
                    result.append({
                        'name': name,
                        'type': chat_type
                    })

            return result
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
