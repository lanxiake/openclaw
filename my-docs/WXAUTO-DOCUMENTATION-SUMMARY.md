# wxauto 文档摘要

## 1. 下载内容清单

### 文档文件 (9 个 Markdown 文件)
| 文件 | 描述 |
|------|------|
| `README.md` | 项目概述，已于 2025-10-28 停止维护 |
| `docs/README.md` | 主文档入口 |
| `docs/example.md` | 使用示例 |
| `docs/class/WeChat.md` | WeChat 类方法（主窗口控制） |
| `docs/class/Chat.md` | Chat 类方法（聊天窗口控制） |
| `docs/class/Message.md` | Message 类方法（消息类型处理） |
| `docs/class/Moment.md` | Moments 类方法（朋友圈） |
| `docs/class/Session.md` | Session 类方法（会话管理） |
| `docs/class/Other.md` | 其他工具类 |

### 源代码文件 (28 个 Python 文件)
| 目录 | 文件 | 功能 |
|------|------|------|
| `wxauto/` | `__init__.py`, `wx.py`, `exceptions.py`, `languages.py`, `logger.py`, `param.py` | 核心模块 |
| `wxauto/msgs/` | `__init__.py`, `base.py`, `friend.py`, `mattr.py`, `msg.py`, `self.py`, `type.py` | 消息处理 |
| `wxauto/ui/` | `__init__.py`, `base.py`, `browser.py`, `chatbox.py`, `component.py`, `main.py`, `moment.py`, `navigationbox.py`, `sessionbox.py` | UI 自动化 |
| `wxauto/uia/` | `__init__.py`, `uiautomation.py`, `uiplug.py` | Windows UI Automation |
| `wxauto/utils/` | `__init__.py`, `lock.py`, `tools.py`, `win32.py` | 工具函数 |

---

## 2. wxauto 核心特性

### 环境要求
- **操作系统**: 仅 Windows (10/11/Server2016+)
- **微信版本**: 3.9.x
- **Python**: 3.9+
- **技术基础**: Windows UIAutomation

### 核心类
| 类名 | 用途 |
|------|------|
| `WeChat` | 微信主窗口实例，继承自 Chat 和 Listener |
| `Chat` | 独立聊天窗口实例 |
| `Message` | 消息基类，包含多种消息类型 |
| `LoginWnd` | 登录窗口控制 |

### 主要功能

#### 消息收发
```python
from wxauto import WeChat

wx = WeChat()
wx.SendMsg("你好", who="张三")           # 发送文本
wx.SendFiles("file.txt", who="张三")    # 发送文件
msgs = wx.GetAllMessage()                # 获取所有消息
```

#### 消息监听
```python
def on_message(msg, chat):
    print(f"收到消息: {msg.content}")

wx.AddListenChat("张三", callback=on_message)
wx.KeepRunning()  # 保持程序运行
```

#### 消息类型
| 属性 (attr) | 类型 (type) |
|-------------|-------------|
| system, time, tickle, self, friend, other | text, quote, voice, image, video, file, location, link, emotion, merge, personal_card, note, other |

### 关键限制
1. **仅 Windows**: 基于 Windows UIAutomation，无法在 Linux/macOS 运行
2. **已停止维护**: 项目于 2025-10-28 归档
3. **版本依赖**: 需要特定微信版本 (3.9.x)
4. **需要 GUI**: 无法在无头服务器部署

---

## 3. API 速览

### WeChat 类主要方法
| 方法 | 描述 |
|------|------|
| `SendMsg(msg, who)` | 发送文本消息 |
| `SendFiles(filepath, who)` | 发送文件 |
| `SendEmotion(index, who)` | 发送自定义表情 |
| `ChatWith(who)` | 打开聊天窗口 |
| `AddListenChat(nickname, callback)` | 添加消息监听 |
| `RemoveListenChat(nickname)` | 移除消息监听 |
| `GetNextNewMessage()` | 获取下一条新消息 |
| `GetNewFriends()` | 获取好友申请列表 |
| `AddNewFriend(keywords)` | 添加新好友 |
| `GetAllRecentGroups()` | 获取最近群聊列表 |
| `Moments()` | 进入朋友圈 |
| `IsOnline()` | 检查是否在线 |
| `GetMyInfo()` | 获取自己的信息 |

### Chat 类主要方法
| 方法 | 描述 |
|------|------|
| `SendMsg(msg)` | 发送消息 |
| `GetAllMessage()` | 获取所有消息 |
| `GetNewMessage()` | 获取新消息 |
| `AddGroupMembers(members)` | 添加群成员 |
| `RemoveGroupMembers(members)` | 移除群成员 |
| `GetGroupMembers()` | 获取群成员列表 |
| `ManageGroup(name, notice)` | 管理群聊 |
| `MergeForward(targets)` | 合并转发 |

### Message 类属性和方法
| 属性 | 描述 |
|------|------|
| `attr` | 消息来源 (system/time/self/friend) |
| `type` | 消息类型 (text/image/file 等) |
| `sender` | 发送者 |
| `content` | 消息内容 |
| `id` | 消息 UI ID |
| `hash` | 消息哈希值 |

| 方法 | 描述 |
|------|------|
| `reply(text)` | 回复消息 |
| `quote(text)` | 引用回复 |
| `forward(targets)` | 转发消息 |
| `download()` | 下载媒体 |
| `delete()` | 删除消息 |

---

## 4. 文档完整性评估

### 已包含
- [x] 核心类文档 (WeChat, Chat, Message)
- [x] 完整 API 参考
- [x] 使用示例
- [x] 所有 Python 源代码
- [x] 消息类型定义

### 缺失/注意事项
- [ ] 官方文档网站 (docs.wxauto.org) 被 Cloudflare 保护，无法直接访问
- [ ] Plus 版本特有功能文档（开源版不可用）
- [ ] 云服务器部署指南（从 GitHub 获取的是简化版）

---

## 5. 用户审核检查点

请确认以下内容是否满足您的需求：

1. **文档完整性**: 9 个核心文档文件是否足够？
2. **源码完整性**: 28 个 Python 文件是否包含所有核心功能？
3. **API 覆盖**: 是否需要更多特定 API 的详细说明？
4. **示例代码**: 是否需要更多使用示例？

如有缺失，请指出需要补充的内容。
