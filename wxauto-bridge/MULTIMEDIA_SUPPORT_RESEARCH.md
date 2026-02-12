# 微信桥接器多媒体消息支持研究报告

## 研究目标

分析当前微信桥接器是否可以监听接收图片、文件、语音消息，以及如何将这些多媒体内容发送给网关。

## 一、wxauto 库多媒体消息支持能力

### 1.1 支持的消息类型

根据 `wxauto/msgs/type.py` 分析，wxauto 支持以下消息类型：

| 消息类型 | 类名                | type 值         | 接收支持 | 下载支持     |
| -------- | ------------------- | --------------- | -------- | ------------ |
| 文本消息 | TextMessage         | `text`          | YES      | N/A          |
| 图片消息 | ImageMessage        | `image`         | YES      | YES          |
| 视频消息 | VideoMessage        | `video`         | YES      | YES          |
| 语音消息 | VoiceMessage        | `voice`         | YES      | 转文字       |
| 文件消息 | FileMessage         | `file`          | YES      | YES          |
| 链接消息 | LinkMessage         | `link`          | YES      | 获取URL      |
| 位置消息 | LocationMessage     | `location`      | YES      | N/A          |
| 表情消息 | EmotionMessage      | `emotion`       | YES      | N/A          |
| 引用消息 | QuoteMessage        | `quote`         | YES      | 下载引用图片 |
| 合并消息 | MergeMessage        | `merge`         | YES      | 获取内容     |
| 名片消息 | PersonalCardMessage | `personal_card` | YES      | N/A          |
| 笔记消息 | NoteMessage         | `note`          | YES      | 保存文件     |
| 其他消息 | OtherMessage        | `other`         | YES      | N/A          |

### 1.2 多媒体消息处理方法

#### 图片消息 (ImageMessage)

```python
# 下载图片
msg.download(dir_path=None, timeout=10, mouse_move=False) -> Path
```

#### 视频消息 (VideoMessage)

```python
# 下载视频
msg.download(dir_path=None, timeout=10, mouse_move=False) -> Path
```

#### 语音消息 (VoiceMessage)

```python
# 语音转文字
msg.to_text() -> str
```

注意：wxauto 不支持直接下载语音文件，只能转换为文字。

#### 文件消息 (FileMessage)

```python
# 下载文件
msg.download(dir_path=None, force_click=False, timeout=10) -> Path
# 属性
msg.filename  # 文件名
msg.filesize  # 文件大小
```

## 二、当前桥接器实现分析

### 2.1 消息回调处理 (wechat_handler.py:233-281)

当前实现只处理消息的基本属性：

- `sender`: 发送者
- `content`: 消息内容（文本）
- `chat_name`: 聊天名称
- `msg_type`: 消息类型
- `is_self`: 是否自己发送
- `is_at_me`: 是否@了当前账号
- `is_group`: 是否群聊

**问题**：当前实现没有处理多媒体消息的下载和转发。

### 2.2 消息推送 (bridge.py:297-314)

当前推送到 Gateway 的消息格式：

```json
{
  "from": "发送者",
  "to": "聊天名称",
  "text": "消息内容",
  "type": "消息类型",
  "chatType": "group/friend",
  "timestamp": 1234567890,
  "isSelf": false,
  "isAtMe": false
}
```

**缺失**：没有多媒体文件的 URL 或 Base64 数据。

## 三、实现方案

### 3.1 接收多媒体消息

#### 方案 A：本地下载 + 文件路径

1. 收到多媒体消息时，调用 `msg.download()` 下载到本地
2. 将本地文件路径发送给 Gateway
3. Gateway 通过 HTTP 接口获取文件

**优点**：实现简单，不占用 WebSocket 带宽
**缺点**：需要额外的 HTTP 服务，文件管理复杂

#### 方案 B：本地下载 + Base64 编码

1. 收到多媒体消息时，调用 `msg.download()` 下载到本地
2. 读取文件并转换为 Base64
3. 通过 WebSocket 发送 Base64 数据

**优点**：不需要额外服务
**缺点**：大文件会占用大量带宽和内存

#### 方案 C：本地下载 + HTTP 文件服务 (推荐)

1. 桥接器启动一个简单的 HTTP 文件服务
2. 收到多媒体消息时下载到指定目录
3. 发送文件的 HTTP URL 给 Gateway

**优点**：灵活，支持大文件，Gateway 可按需获取
**缺点**：需要额外端口

### 3.2 发送多媒体消息

wxauto 已支持发送文件：

```python
# 发送文件
wx.SendFiles(filepath, who=None, exact=False) -> WxResponse
```

当前桥接器已实现 `send_file` 方法 (wechat_handler.py:207-231)。

### 3.3 语音消息特殊处理

wxauto 不支持直接下载语音文件，只能转文字：

```python
msg.to_text() -> str
```

**建议**：

1. 收到语音消息时，调用 `to_text()` 转换为文字
2. 在消息中标记 `type: "voice"` 和 `voiceText: "转换后的文字"`

## 四、推荐实现方案

### 4.1 修改 WeChatMessage 数据类

```python
@dataclass
class WeChatMessage:
    sender: str
    content: str
    chat_name: str
    msg_type: str = "text"
    timestamp: float = field(default_factory=time.time)
    is_self: bool = False
    is_group: bool = False
    is_at_me: bool = False
    # 新增多媒体字段
    media_path: Optional[str] = None      # 本地文件路径
    media_url: Optional[str] = None       # HTTP URL
    file_name: Optional[str] = None       # 文件名
    file_size: Optional[str] = None       # 文件大小
    voice_text: Optional[str] = None      # 语音转文字
```

### 4.2 修改消息回调处理

```python
def _on_message(self, msg: Message, chat) -> None:
    # ... 现有代码 ...

    media_path = None
    media_url = None
    file_name = None
    file_size = None
    voice_text = None

    # 处理多媒体消息
    if msg.type == 'image':
        media_path = msg.download(dir_path=self._media_dir)
        media_url = self._get_media_url(media_path)
    elif msg.type == 'video':
        media_path = msg.download(dir_path=self._media_dir)
        media_url = self._get_media_url(media_path)
    elif msg.type == 'file':
        media_path = msg.download(dir_path=self._media_dir)
        media_url = self._get_media_url(media_path)
        file_name = msg.filename
        file_size = msg.filesize
    elif msg.type == 'voice':
        voice_text = msg.to_text()

    wechat_msg = WeChatMessage(
        # ... 现有字段 ...
        media_path=str(media_path) if media_path else None,
        media_url=media_url,
        file_name=file_name,
        file_size=file_size,
        voice_text=voice_text,
    )
```

### 4.3 添加 HTTP 文件服务

```python
from aiohttp import web

class MediaServer:
    def __init__(self, media_dir: str, port: int = 18790):
        self.media_dir = Path(media_dir)
        self.port = port

    async def start(self):
        app = web.Application()
        app.router.add_static('/media', self.media_dir)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, 'localhost', self.port)
        await site.start()
```

### 4.4 修改消息推送格式

```json
{
  "from": "发送者",
  "to": "聊天名称",
  "text": "消息内容",
  "type": "image",
  "chatType": "group",
  "timestamp": 1234567890,
  "isSelf": false,
  "isAtMe": false,
  "media": {
    "url": "http://localhost:18790/media/wxauto_image_20240101120000.jpg",
    "path": "D:/media/wxauto_image_20240101120000.jpg",
    "fileName": null,
    "fileSize": null
  },
  "voiceText": null
}
```

## 五、Gateway 端处理建议

### 5.1 接收多媒体消息

Gateway 收到带 `media.url` 的消息时：

1. 下载文件到本地或云存储
2. 将文件 URL 传递给 AI Agent
3. AI Agent 可以使用图片理解能力处理图片

### 5.2 发送多媒体消息

Gateway 发送多媒体消息时：

1. 将文件下载到桥接器可访问的路径
2. 调用 `sendFile` 方法发送

## 六、实现优先级

1. **高优先级**：图片消息接收和发送
2. **中优先级**：文件消息接收和发送
3. **中优先级**：语音消息转文字
4. **低优先级**：视频消息处理

## 七、注意事项

1. **文件清理**：需要定期清理下载的临时文件
2. **并发处理**：下载操作可能耗时，需要异步处理
3. **错误处理**：下载失败时需要优雅降级
4. **安全性**：HTTP 文件服务需要限制访问范围
5. **性能**：大文件下载可能影响消息处理速度

## 八、总结

wxauto 库完整支持多媒体消息的接收和下载，当前桥接器只需要：

1. 在消息回调中添加多媒体下载逻辑
2. 启动 HTTP 文件服务提供文件访问
3. 修改消息推送格式包含媒体信息

预计实现工作量：2-3 天
