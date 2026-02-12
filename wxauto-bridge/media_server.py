"""
HTTP 文件服务器模块
提供多媒体文件的 HTTP 访问服务
"""

import asyncio
import logging
import mimetypes
from pathlib import Path
from typing import Optional

from aiohttp import web

logger = logging.getLogger(__name__)


class MediaServer:
    """HTTP 文件服务器

    提供多媒体文件的 HTTP 访问，支持：
    - 静态文件服务
    - MIME 类型自动检测
    - 跨域访问 (CORS)
    """

    def __init__(self, media_dir: Path, port: int = 18790, host: str = "localhost"):
        """初始化文件服务器

        Args:
            media_dir: 多媒体文件目录
            port: HTTP 服务端口
            host: 绑定地址
        """
        self.media_dir = Path(media_dir)
        self.port = port
        self.host = host
        self._runner: Optional[web.AppRunner] = None
        self._site: Optional[web.TCPSite] = None
        self._app: Optional[web.Application] = None

        # 确保目录存在
        self.media_dir.mkdir(parents=True, exist_ok=True)

        # 添加常见的 MIME 类型
        mimetypes.add_type('image/webp', '.webp')
        mimetypes.add_type('video/mp4', '.mp4')
        mimetypes.add_type('audio/amr', '.amr')
        mimetypes.add_type('audio/silk', '.silk')

    async def start(self) -> bool:
        """启动 HTTP 服务器，端口被占用时自动尝试备选端口

        Returns:
            是否启动成功
        """
        # 尝试原始端口和最多 5 个备选端口
        ports_to_try = [self.port + i for i in range(6)]
        for port in ports_to_try:
            try:
                self._app = web.Application()

                # 添加 CORS 中间件
                self._app.middlewares.append(self._cors_middleware)

                # 添加路由
                self._app.router.add_get('/media/{path:.*}', self._handle_media)
                self._app.router.add_get('/health', self._handle_health)

                # 启动服务器
                self._runner = web.AppRunner(self._app)
                await self._runner.setup()
                self._site = web.TCPSite(self._runner, self.host, port)
                await self._site.start()

                self.port = port
                logger.info(f"HTTP 文件服务器已启动: http://{self.host}:{self.port}")
                logger.info(f"媒体文件目录: {self.media_dir}")
                return True

            except OSError as e:
                logger.warning(f"端口 {port} 被占用: {e}")
                # 清理本次失败的 runner
                if self._runner:
                    try:
                        await self._runner.cleanup()
                    except Exception:
                        pass
                    self._runner = None
                self._site = None
                self._app = None
                continue
            except Exception as e:
                logger.error(f"启动 HTTP 文件服务器失败: {e}")
                return False

        logger.error(f"所有端口 {ports_to_try[0]}-{ports_to_try[-1]} 均被占用，HTTP 文件服务器启动失败")
        return False

    async def stop(self) -> None:
        """停止 HTTP 服务器"""
        try:
            if self._site:
                await self._site.stop()
            if self._runner:
                await self._runner.cleanup()
            logger.info("HTTP 文件服务器已停止")
        except Exception as e:
            logger.error(f"停止 HTTP 文件服务器失败: {e}")

    @web.middleware
    async def _cors_middleware(self, request: web.Request, handler):
        """CORS 中间件"""
        response = await handler(request)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = '*'
        return response

    async def _handle_media(self, request: web.Request) -> web.Response:
        """处理媒体文件请求

        Args:
            request: HTTP 请求

        Returns:
            HTTP 响应
        """
        try:
            # 获取请求路径
            path = request.match_info.get('path', '')
            file_path = self.media_dir / path

            # 安全检查：确保路径在 media_dir 内
            try:
                file_path.resolve().relative_to(self.media_dir.resolve())
            except ValueError:
                logger.warning(f"非法路径访问: {path}")
                return web.Response(status=403, text="Forbidden")

            # 检查文件是否存在
            if not file_path.exists():
                logger.warning(f"文件不存在: {file_path}")
                return web.Response(status=404, text="Not Found")

            if not file_path.is_file():
                logger.warning(f"路径不是文件: {file_path}")
                return web.Response(status=400, text="Bad Request")

            # 获取 MIME 类型
            content_type, _ = mimetypes.guess_type(str(file_path))
            if content_type is None:
                content_type = 'application/octet-stream'

            # 读取文件内容
            with open(file_path, 'rb') as f:
                content = f.read()

            logger.debug(f"提供文件: {file_path}, type={content_type}, size={len(content)}")

            return web.Response(
                body=content,
                content_type=content_type,
                headers={
                    'Content-Disposition': f'inline; filename="{file_path.name}"',
                    'Cache-Control': 'public, max-age=3600',
                }
            )

        except Exception as e:
            logger.error(f"处理媒体请求失败: {e}")
            return web.Response(status=500, text="Internal Server Error")

    async def _handle_health(self, request: web.Request) -> web.Response:
        """健康检查接口"""
        return web.json_response({
            "status": "ok",
            "media_dir": str(self.media_dir),
            "port": self.port
        })

    def get_url(self, file_path: Path) -> Optional[str]:
        """获取文件的 HTTP URL

        Args:
            file_path: 本地文件路径

        Returns:
            HTTP URL
        """
        try:
            relative_path = file_path.relative_to(self.media_dir)
            url_path = str(relative_path).replace('\\', '/')
            return f"http://{self.host}:{self.port}/media/{url_path}"
        except Exception as e:
            logger.error(f"生成媒体 URL 失败: {e}")
            return None
