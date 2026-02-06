"""
微信桥接配置工具 - 主应用入口
使用 PyWebView 实现桌面 GUI 应用
"""

import asyncio
import json
import logging
import os
import sys
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import webview

# 添加当前目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from config_manager import ConfigManager
from wechat_handler import WeChatHandler

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)


class BridgeApi:
    """
    桥接 API 类
    提供给前端调用的 Python 方法
    """

    # 日志文件最大保留条数
    MAX_LOG_ENTRIES = 500

    def __init__(self):
        """初始化桥接 API，使用私有属性避免 pywebview 序列化问题"""
        self._config_manager = ConfigManager()
        self._wechat_handler = None
        self._bridge_thread: Optional[threading.Thread] = None
        self._bridge_instance = None  # 保存 WeChatBridge 实例引用
        self._is_running = False
        self._window = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._log_file = self._get_log_file_path()
        self._ensure_log_dir()

    def _get_log_file_path(self) -> Path:
        """获取日志文件路径"""
        log_dir = Path.home() / ".openclaw" / "logs"
        return log_dir / "wechat-bridge.log"

    def _ensure_log_dir(self) -> None:
        """确保日志目录存在"""
        self._log_file.parent.mkdir(parents=True, exist_ok=True)

    def _save_log_to_file(self, level: str, content: str) -> None:
        """将日志保存到文件"""
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            log_entry = json.dumps({
                "timestamp": timestamp,
                "level": level,
                "content": content
            }, ensure_ascii=False)

            # 追加写入日志文件
            with open(self._log_file, "a", encoding="utf-8") as f:
                f.write(log_entry + "\n")

            # 定期清理旧日志（每100条检查一次）
            self._trim_log_file()
        except Exception as e:
            logger.error(f"保存日志到文件失败: {e}")

    def _trim_log_file(self) -> None:
        """清理旧日志，保留最新的 MAX_LOG_ENTRIES 条"""
        try:
            if not self._log_file.exists():
                return

            # 读取所有日志
            with open(self._log_file, "r", encoding="utf-8") as f:
                lines = f.readlines()

            # 如果超过最大条数，只保留最新的
            if len(lines) > self.MAX_LOG_ENTRIES:
                with open(self._log_file, "w", encoding="utf-8") as f:
                    f.writelines(lines[-self.MAX_LOG_ENTRIES:])
        except Exception as e:
            logger.error(f"清理日志文件失败: {e}")

    def get_history_logs(self) -> List[Dict[str, str]]:
        """获取历史日志"""
        logs = []
        try:
            if self._log_file.exists():
                with open(self._log_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                log_entry = json.loads(line)
                                logs.append(log_entry)
                            except json.JSONDecodeError:
                                continue
                # 返回最新的100条日志
                return logs[-100:]
        except Exception as e:
            logger.error(f"读取历史日志失败: {e}")
        return logs

    def set_window(self, window):
        """设置窗口引用，用于调用 JS"""
        self._window = window

    def _call_js(self, func_name: str, *args):
        """调用前端 JavaScript 函数"""
        if self._window:
            try:
                args_json = json.dumps(args)
                self._window.evaluate_js(f'{func_name}({args_json[1:-1]})')
            except Exception as e:
                logger.error(f"调用 JS 失败: {e}")

    def _append_log(self, level: str, content: str):
        """向前端添加日志并保存到文件"""
        logger.info(f"[{level}] {content}")
        # 保存到文件
        self._save_log_to_file(level, content)
        # 发送到前端
        self._call_js('appendLog', level, content)

    def _update_status(self, status: str, text: str):
        """更新前端连接状态"""
        self._call_js('updateConnectionStatus', status, text)

    # ==========================================
    # 配置管理 API
    # ==========================================

    def get_config(self) -> Dict[str, Any]:
        """获取配置"""
        logger.info("获取配置")
        return self._config_manager.get_all_config()

    def save_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """保存配置"""
        logger.info("保存配置")
        try:
            self._config_manager.set_all_config(config)
            success = self._config_manager.save()
            return {"success": success}
        except Exception as e:
            logger.error(f"保存配置失败: {e}")
            return {"success": False, "error": str(e)}

    def generate_token(self) -> str:
        """生成新的 Token"""
        token = uuid.uuid4().hex
        logger.info("生成新 Token")
        return token

    # ==========================================
    # 连接测试 API
    # ==========================================

    def test_connection(self, url: str) -> Dict[str, Any]:
        """测试 Gateway 连接"""
        logger.info(f"测试连接: {url}")
        try:
            import websocket

            # 简单的 WebSocket 连接测试
            ws = websocket.create_connection(url, timeout=5)
            ws.close()
            return {"success": True}
        except Exception as e:
            logger.error(f"连接测试失败: {e}")
            return {"success": False, "error": str(e)}

    # ==========================================
    # 微信联系人 API
    # ==========================================

    def fetch_contacts(self) -> Dict[str, Any]:
        """从微信获取联系人列表"""
        logger.info("获取微信联系人列表")
        try:
            # 临时创建 WeChatHandler 获取联系人
            if not self._wechat_handler:
                self._wechat_handler = WeChatHandler()
                if not self._wechat_handler.connect():
                    return {"success": False, "error": "微信连接失败"}

            # 获取带类型信息的会话列表
            sessions = self._wechat_handler.get_chat_list_with_type()

            # 分类
            friends = []
            groups = []
            for session in sessions:
                if session.get('type') == 'group':
                    groups.append(session['name'])
                else:
                    friends.append(session['name'])

            return {
                "success": True,
                "data": {
                    "friends": friends,
                    "groups": groups
                }
            }
        except Exception as e:
            logger.error(f"获取联系人失败: {e}")
            return {"success": False, "error": str(e)}

    # ==========================================
    # 桥接控制 API
    # ==========================================

    def start_bridge(self) -> Dict[str, Any]:
        """启动桥接"""
        logger.info("启动桥接")

        if self._is_running:
            return {"success": False, "error": "桥接已在运行"}

        try:
            # 获取配置
            config = self._config_manager.get_all_config()
            gateway_url = config.get('gateway_url', 'ws://localhost:18789')
            auth_token = config.get('auth_token', '')

            # 处理 listen_chats，支持字符串和对象混合格式
            listen_chats = []
            for c in config.get('listen_chats', []):
                if isinstance(c, str):
                    # 字符串格式，直接添加
                    listen_chats.append(c)
                elif isinstance(c, dict):
                    # 对象格式，检查是否启用
                    if c.get('enabled', True):
                        listen_chats.append(c.get('name', ''))

            # 过滤空字符串
            listen_chats = [name for name in listen_chats if name]

            # 启动桥接线程
            self._bridge_thread = threading.Thread(
                target=self._run_bridge,
                args=(gateway_url, auth_token, listen_chats),
                daemon=True
            )
            self._bridge_thread.start()
            self._is_running = True

            return {"success": True}
        except Exception as e:
            logger.error(f"启动桥接失败: {e}")
            return {"success": False, "error": str(e)}

    def stop_bridge(self) -> Dict[str, Any]:
        """停止桥接"""
        logger.info("停止桥接")

        if not self._is_running:
            return {"success": False, "error": "桥接未运行"}

        try:
            self._is_running = False

            # 停止 WeChatBridge 实例
            if self._bridge_instance and self._loop:
                logger.info("正在停止 WeChatBridge 实例...")
                # 在事件循环中调度停止操作
                future = asyncio.run_coroutine_threadsafe(
                    self._bridge_instance.stop(),
                    self._loop
                )
                try:
                    # 等待停止完成，最多等待5秒
                    future.result(timeout=5)
                    logger.info("WeChatBridge 实例已停止")
                except Exception as e:
                    logger.warning(f"停止 WeChatBridge 超时或失败: {e}")

            # 清理引用
            self._bridge_instance = None

            if self._wechat_handler:
                self._wechat_handler.disconnect()
                self._wechat_handler = None

            self._append_log('info', '桥接已停止')
            self._update_status('disconnected', '已断开')

            return {"success": True}
        except Exception as e:
            logger.error(f"停止桥接失败: {e}")
            return {"success": False, "error": str(e)}

    def _run_bridge(self, gateway_url: str, auth_token: str, listen_chats: list):
        """在后台线程运行桥接"""
        try:
            # 导入桥接模块
            from bridge import WeChatBridge

            # 创建新的事件循环
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            self._loop = loop

            # 创建桥接实例并保存引用
            bridge = WeChatBridge(
                gateway_url=gateway_url,
                auth_token=auth_token
            )
            self._bridge_instance = bridge

            # 保存原有的消息回调，添加日志功能
            original_callback = bridge.wechat._message_callback

            def on_message_with_log(msg):
                # 检查桥接是否仍在运行
                if not self._is_running:
                    logger.info("桥接已停止，忽略消息")
                    return
                # 先记录日志到 GUI
                content_preview = msg.content[:50] if msg.content else ''
                self._append_log('message', f'收到消息: {msg.sender} -> {content_preview}...')
                # 然后调用原有回调（推送到 Gateway）
                if original_callback:
                    original_callback(msg)

            bridge.wechat.set_message_callback(on_message_with_log)

            # 记录监听配置
            if listen_chats:
                self._append_log('info', f'配置监听: {", ".join(listen_chats)}')
            else:
                self._append_log('warning', '没有配置监听的聊天，请先添加监听项')

            # 运行桥接（监听会在连接微信后自动添加）
            self._append_log('info', '桥接启动中...')
            loop.run_until_complete(bridge.start(listen_chats=listen_chats))

        except Exception as e:
            logger.error(f"桥接运行错误: {e}")
            self._append_log('error', f'桥接错误: {str(e)}')
            self._update_status('error', '运行错误')
        finally:
            self._is_running = False
            self._bridge_instance = None
            if self._loop:
                try:
                    self._loop.close()
                except Exception:
                    pass
                self._loop = None


def get_asset_path(filename: str) -> str:
    """获取资源文件路径"""
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后
        base_path = sys._MEIPASS
    else:
        # 开发环境
        base_path = Path(__file__).parent

    return str(Path(base_path) / 'assets' / filename)


def main():
    """主函数"""
    logger.info("启动微信桥接配置工具")

    # 创建 API 实例
    api = BridgeApi()

    # 创建窗口
    window = webview.create_window(
        title='微信桥接',
        url=get_asset_path('index.html'),
        width=800,
        height=700,
        min_size=(600, 500),
        js_api=api,
        text_select=False
    )

    # 设置窗口引用
    api.set_window(window)

    # 启动应用（启用 debug 模式以查看 JS 控制台）
    webview.start(debug=True)

    logger.info("应用已退出")


if __name__ == '__main__':
    main()
