# Windows Desktop App - Windows 桌面客户端

OpenClaw Windows 桌面客户端是基于 Electron 的跨平台桌面应用，为用户提供本地 AI 助手服务，支持自然语言交互、技能执行、系统监控和远程控制。

## 功能特性

### 核心功能

- **AI 对话交互** - 自然语言理解、多轮对话、上下文记忆
- **技能执行引擎** - 沙箱隔离、权限控制、安全执行
- **系统托盘** - 常驻后台、快捷唤醒、状态监控
- **设备配对** - 多设备管理、远程控制、安全认证
- **文件管理** - 智能整理、批量操作、搜索定位
- **系统监控** - CPU/内存/磁盘监控、进程管理
- **自动更新** - 增量更新、静默安装、版本回滚
- **审计日志** - 操作记录、安全审计、合规追踪

### 技术架构

- **框架**: Electron 28 + React 18 + TypeScript
- **构建工具**: electron-vite + Vite 5
- **进程通信**: IPC (Main ↔ Renderer)
- **状态管理**: React Hooks + Context
- **WebSocket**: 与 Gateway 实时通信
- **安全沙箱**: VM2 技能隔离执行
- **自动更新**: electron-updater

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 8+
- Windows 10/11

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

应用将自动启动，支持热重载。

### 构建应用

```bash
# 构建代码
pnpm build

# 打包应用（所有格式）
pnpm package

# 仅打包 Windows 版本
pnpm package:win

# 打包 NSIS 安装包（x64 + ia32）
pnpm package:nsis

# 打包 NSIS 安装包（仅 x64）
pnpm package:nsis:x64

# 打包便携版
pnpm package:portable

# 打包 ZIP 压缩包
pnpm package:zip

# 打包到目录（不压缩）
pnpm package:dir
```

构建产物输出到 `release/` 目录。

### 代码检查

```bash
pnpm lint
```

### 类型检查

```bash
pnpm typecheck
```

### 清理构建产物

```bash
pnpm clean
```

## 项目结构

```
apps/windows/
├── src/
│   ├── main/                    # 主进程代码
│   │   ├── index.ts            # 主进程入口
│   │   ├── gateway-client.ts   # Gateway WebSocket 客户端
│   │   ├── skill-runtime.ts    # 技能运行时
│   │   ├── skill-sandbox.ts    # 技能沙箱
│   │   ├── system-service.ts   # 系统服务（文件、进程等）
│   │   ├── tray-manager.ts     # 系统托盘管理
│   │   ├── device-pairing-service.ts  # 设备配对服务
│   │   ├── security-utils.ts   # 安全工具
│   │   └── updater-service.ts  # 自动更新服务
│   ├── preload/                # 预加载脚本
│   │   └── index.ts            # IPC 桥接
│   └── renderer/               # 渲染进程代码
│       ├── components/         # React 组件
│       ├── hooks/              # 自定义 Hooks
│       │   ├── useAuth.ts      # 认证
│       │   ├── useChatStream.ts # 对话流
│       │   ├── useDevicePairing.ts # 设备配对
│       │   ├── useFileManager.ts # 文件管理
│       │   ├── useSkills.ts    # 技能管理
│       │   ├── useSystemMonitor.ts # 系统监控
│       │   └── useUpdater.ts   # 更新管理
│       ├── utils/              # 工具函数
│       └── App.tsx             # 根组件
├── assets/                     # 资源文件
│   ├── icon.ico               # 应用图标
│   └── ...
├── build/                      # 构建资源
│   ├── license.txt            # 许可证文本
│   └── installer.nsh          # NSIS 安装脚本
├── out/                        # 编译输出
├── release/                    # 打包输出
├── electron-builder.json       # Electron Builder 配置
├── electron.vite.config.ts     # Electron Vite 配置
├── package.json                # 项目配置
└── tsconfig.json               # TypeScript 配置
```

## 核心模块说明

### 主进程 (Main Process)

- **gateway-client.ts** - 与后端 Gateway 建立 WebSocket 连接，处理消息路由
- **skill-runtime.ts** - 技能加载、执行、生命周期管理
- **skill-sandbox.ts** - 使用 VM2 隔离执行技能代码，防止恶意操作
- **system-service.ts** - 提供文件操作、进程管理、系统信息查询等系统级 API
- **tray-manager.ts** - 管理系统托盘图标、菜单、通知
- **device-pairing-service.ts** - 处理设备配对、验证码生成、安全认证
- **updater-service.ts** - 检查更新、下载安装包、应用更新

### 渲染进程 (Renderer Process)

- **useAuth** - 用户登录、注册、会话管理
- **useChatStream** - 实时对话流、消息发送接收
- **useDevicePairing** - 设备配对 UI 交互
- **useFileManager** - 文件浏览、搜索、操作
- **useSkills** - 技能商店、订阅管理、本地技能
- **useSystemMonitor** - 系统资源监控、进程管理
- **useUpdater** - 更新检查、下载进度、安装提示

### 进程通信 (IPC)

通过 `preload/index.ts` 暴露安全的 IPC 接口：

```typescript
// 渲染进程调用
window.electron.ipcRenderer.invoke('skill:execute', { skillId, params })

// 主进程处理
ipcMain.handle('skill:execute', async (event, { skillId, params }) => {
  return await skillRuntime.execute(skillId, params)
})
```

## 打包配置

### NSIS 安装包特性

- 支持自定义安装目录
- 创建桌面快捷方式
- 创建开始菜单快捷方式
- 多语言支持（中文、英文）
- 安装后自动启动
- 卸载时保留用户数据选项

### 便携版特性

- 无需安装，解压即用
- 数据存储在应用目录
- 适合 U 盘携带

### 自动更新

使用 electron-updater 实现自动更新：

- 检查 GitHub Releases 获取最新版本
- 增量下载更新包
- 后台静默安装
- 重启应用生效

配置更新服务器：

```json
{
  "publish": {
    "provider": "github",
    "owner": "openclaw",
    "repo": "openclaw"
  }
}
```

## 安全机制

### 技能沙箱

- 使用 VM2 隔离执行技能代码
- 限制文件系统访问权限
- 禁止网络请求（除非明确授权）
- 限制进程创建和系统调用

### 权限控制

- 敏感操作需要用户确认（删除文件、结束进程等）
- 技能执行前显示权限清单
- 审计日志记录所有操作

### 通信加密

- WebSocket 使用 TLS 加密
- 设备配对使用临时验证码
- 敏感数据本地加密存储

## 开发指南

### 添加新的系统服务

1. 在 `src/main/` 下创建服务文件
2. 在 `src/main/index.ts` 中注册 IPC 处理器
3. 在 `src/preload/index.ts` 中暴露接口
4. 在 `src/renderer/hooks/` 中创建对应的 Hook

### 添加新的技能 API

1. 在 `src/main/skill-runtime.ts` 中注册 API
2. 更新技能沙箱白名单
3. 编写技能示例和文档

### 调试技巧

- 主进程调试：使用 `--inspect` 参数启动
- 渲染进程调试：打开 DevTools (Ctrl+Shift+I)
- IPC 通信调试：在 preload 中添加日志
- 技能执行调试：查看 `~/.openclaw/logs/skills.log`

## 部署与分发

### 发布流程

1. 更新版本号 (`package.json`)
2. 构建应用 (`pnpm build`)
3. 打包应用 (`pnpm package:nsis`)
4. 创建 GitHub Release
5. 上传安装包到 Release
6. 客户端自动检测更新

### 签名配置

Windows 代码签名需要配置环境变量：

```bash
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your_password
```

## 相关文档

- [OpenClaw 主项目](../../README.md)
- [技能开发指南](../../docs/skills/)
- [API 文档](../../docs/api/)
- [部署指南](../../docs/deployment/)

## 许可证

MIT License
