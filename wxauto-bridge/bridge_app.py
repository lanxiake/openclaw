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
  from pathlib import Path
  from typing import Any, Dict, Optional

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

      def __init__(self):
          self.config_manager = ConfigManager()
          self.wechat_handler: Optional[WeChatHandler] = None
          self.bridge_thread: Optional[threading.Thread] = None
          self.is_running = False
          self._window = None
          self._loop: Optional[asyncio.AbstractEventLoop] = None

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
          """向前端添加日志"""
          logger.info(f"[{level}] {content}")
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
          return self.config_manager.get_all_config()

      def save_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
          """保存配置"""
          logger.info("保存配置")
          try:
              self.config_manager.set_all_config(config)
              success = self.config_manager.save()
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
              if not self.wechat_handler:
                  self.wechat_handler = WeChatHandler()
                  if not self.wechat_handler.connect():
                      return {"success": False, "error": "微信连接失败"}

              # 获取会话列表
              sessions = self.wechat_handler.get_chat_list()

              # 简单分类：包含"群"字的视为群聊
              friends = []
              groups = []
              for session in sessions:
                  if '群' in session:
                      groups.append(session)
                  else:
                      friends.append(session)

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

          if self.is_running:
              return {"success": False, "error": "桥接已在运行"}

          try:
              # 获取配置
              config = self.config_manager.get_all_config()
              gateway_url = config.get('gateway_url', 'ws://localhost:18789')
              auth_token = config.get('auth_token', '')
              listen_chats = [
                  c['name'] for c in config.get('listen_chats', [])
                  if c.get('enabled', True)
              ]

              # 启动桥接线程
              self.bridge_thread = threading.Thread(
                  target=self._run_bridge,
                  args=(gateway_url, auth_token, listen_chats),
                  daemon=True
              )
              self.bridge_thread.start()
              self.is_running = True

              return {"success": True}
          except Exception as e:
              logger.error(f"启动桥接失败: {e}")
              return {"success": False, "error": str(e)}

      def stop_bridge(self) -> Dict[str, Any]:
          """停止桥接"""
          logger.info("停止桥接")

          if not self.is_running:
              return {"success": False, "error": "桥接未运行"}

          try:
              self.is_running = False

              if self.wechat_handler:
                  self.wechat_handler.disconnect()
                  self.wechat_handler = None

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

              # 创建桥接实例
              bridge = WeChatBridge(
                  gateway_url=gateway_url,
                  auth_token=auth_token
              )

              # 设置消息回调
              def on_message(msg):
                  self._append_log('message', f'收到消息: {msg.sender} -> {msg.content[:50]}...')

              bridge.wechat.set_message_callback(on_message)

              # 添加监听
              self._append_log('info', f'添加监听: {", ".join(listen_chats)}')

              # 运行桥接
              self._append_log('info', '桥接启动中...')
              loop.run_until_complete(bridge.start())

          except Exception as e:
              logger.error(f"桥接运行错误: {e}")
              self._append_log('error', f'桥接错误: {str(e)}')
              self._update_status('error', '运行错误')
          finally:
              self.is_running = False
              if self._loop:
                  self._loop.close()
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

      # 启动应用
      webview.start(debug=False)

      logger.info("应用已退出")


  if __name__ == '__main__':
      main()