"""
配置管理模块
负责读写 ~/.openclaw/openclaw.json 配置文件
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ConfigManager:
    """
    配置管理器
    管理微信桥接的配置，包括 Gateway 地址、Token、监听列表等
    """

    # 默认配置
    DEFAULT_CONFIG = {
        "gateway_url": "ws://localhost:18789",
        "auth_token": "wechat-bridge-token-2026",
        "listen_chats": [],  # 监听的聊天列表 [{"name": "xxx", "type": "friend/group", "enabled": True}]
    }

    def __init__(self, config_dir: Optional[str] = None):
        """
        初始化配置管理器

        Args:
            config_dir: 配置目录路径，默认为 ~/.openclaw
        """
        if config_dir:
            self.config_dir = Path(config_dir)
        else:
            self.config_dir = Path.home() / ".openclaw"

        self.config_file = self.config_dir / "wechat-bridge.json"
        self._config: Dict[str, Any] = {}
        self._load_config()

    def _ensure_config_dir(self) -> None:
        """确保配置目录存在"""
        if not self.config_dir.exists():
            logger.info(f"创建配置目录: {self.config_dir}")
            self.config_dir.mkdir(parents=True, exist_ok=True)

    def _load_config(self) -> None:
        """从文件加载配置"""
        self._ensure_config_dir()

        if self.config_file.exists():
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                    self._config = json.load(f)
                logger.info(f"配置已加载: {self.config_file}")
            except json.JSONDecodeError as e:
                logger.error(f"配置文件解析失败: {e}")
                self._config = self.DEFAULT_CONFIG.copy()
            except Exception as e:
                logger.error(f"配置文件读取失败: {e}")
                self._config = self.DEFAULT_CONFIG.copy()
        else:
            logger.info("配置文件不存在，使用默认配置")
            self._config = self.DEFAULT_CONFIG.copy()
            self._save_config()

    def _save_config(self) -> bool:
        """
        保存配置到文件

        Returns:
            是否保存成功
        """
        self._ensure_config_dir()

        try:
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(self._config, f, ensure_ascii=False, indent=2)
            logger.info(f"配置已保存: {self.config_file}")
            return True
        except Exception as e:
            logger.error(f"配置保存失败: {e}")
            return False

    def get_gateway_url(self) -> str:
        """获取 Gateway 地址"""
        return self._config.get("gateway_url", self.DEFAULT_CONFIG["gateway_url"])

    def set_gateway_url(self, url: str) -> None:
        """设置 Gateway 地址"""
        self._config["gateway_url"] = url
        logger.info(f"Gateway 地址已更新: {url}")

    def get_auth_token(self) -> str:
        """获取认证 Token"""
        return self._config.get("auth_token", "")

    def set_auth_token(self, token: str) -> None:
        """设置认证 Token"""
        self._config["auth_token"] = token
        logger.info("认证 Token 已更新")

    def generate_auth_token(self) -> str:
        """
        生成新的认证 Token

        Returns:
            生成的 Token
        """
        import uuid
        token = uuid.uuid4().hex
        self.set_auth_token(token)
        logger.info("已生成新的认证 Token")
        return token

    def get_listen_chats(self) -> List[Dict[str, Any]]:
        """
        获取监听聊天列表

        Returns:
            监听列表，格式: [{"name": "xxx", "type": "friend/group", "enabled": True}]
        """
        return self._config.get("listen_chats", [])

    def set_listen_chats(self, chats: List[Dict[str, Any]]) -> None:
        """设置监听聊天列表"""
        self._config["listen_chats"] = chats
        logger.info(f"监听列表已更新，共 {len(chats)} 项")

    def add_listen_chat(self, name: str, chat_type: str = "friend", enabled: bool = True) -> bool:
        """
        添加监听聊天

        Args:
            name: 聊天名称
            chat_type: 聊天类型 (friend/group)
            enabled: 是否启用

        Returns:
            是否添加成功
        """
        chats = self.get_listen_chats()

        # 检查是否已存在
        for chat in chats:
            if chat.get("name") == name:
                logger.warning(f"聊天已存在: {name}")
                return False

        chats.append({
            "name": name,
            "type": chat_type,
            "enabled": enabled
        })
        self.set_listen_chats(chats)
        logger.info(f"已添加监听: {name} ({chat_type})")
        return True

    def remove_listen_chat(self, name: str) -> bool:
        """
        移除监听聊天

        Args:
            name: 聊天名称

        Returns:
            是否移除成功
        """
        chats = self.get_listen_chats()
        original_len = len(chats)

        chats = [c for c in chats if c.get("name") != name]

        if len(chats) < original_len:
            self.set_listen_chats(chats)
            logger.info(f"已移除监听: {name}")
            return True
        else:
            logger.warning(f"监听不存在: {name}")
            return False

    def toggle_listen_chat(self, name: str, enabled: bool) -> bool:
        """
        切换监听聊天的启用状态

        Args:
            name: 聊天名称
            enabled: 是否启用

        Returns:
            是否切换成功
        """
        chats = self.get_listen_chats()

        for chat in chats:
            if chat.get("name") == name:
                chat["enabled"] = enabled
                self.set_listen_chats(chats)
                logger.info(f"监听状态已更新: {name} -> {'启用' if enabled else '禁用'}")
                return True

        logger.warning(f"监听不存在: {name}")
        return False

    def get_enabled_listen_chats(self) -> List[str]:
        """
        获取已启用的监听聊天名称列表

        Returns:
            启用的聊天名称列表
        """
        chats = self.get_listen_chats()
        return [c["name"] for c in chats if c.get("enabled", True)]

    def get_all_config(self) -> Dict[str, Any]:
        """获取所有配置"""
        return self._config.copy()

    def set_all_config(self, config: Dict[str, Any]) -> None:
        """设置所有配置"""
        self._config = config
        logger.info("配置已全量更新")

    def save(self) -> bool:
        """保存配置到文件"""
        return self._save_config()

    def reload(self) -> None:
        """重新加载配置"""
        self._load_config()
        logger.info("配置已重新加载")
