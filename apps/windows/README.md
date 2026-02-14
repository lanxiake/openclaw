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

## 快速测试

### 1. 启动 Gateway

在项目根目录：

```bash
cd d:\AI-workspace\openclaw
pnpm gateway:watch
```

等待看到 `Gateway listening on ws://127.0.0.1:18789`

### 2. 测试开发版本

在新的终端窗口：

```bash
cd d:\AI-workspace\openclaw\apps\windows
pnpm dev
```

应用会：
1. ✅ 启动并显示主窗口
2. ✅ 创建系统托盘图标
3. ✅ 自动连接到 Gateway
4. ✅ 显示连接状态

**查看日志**：
- 主窗口日志：终端输出
- 文件日志：`%APPDATA%\openclaw-assistant-windows\logs\`

### 3. 测试打包版本

先构建：

```bash
pnpm build
```

运行打包版：

```bash
# 运行 out 目录中的版本
pnpm preview

# 或直接运行 electron
electron .
```

### 4. 常见问题

**问题 1：Gateway 连接失败**

错误日志：
```
Error occurred in handler for 'gateway:call': Not connected to Gateway
```

**解决**：
1. 确认 Gateway 正在运行：`http://127.0.0.1:18789/health`
2. 检查防火墙是否阻止了连接
3. 查看 Gateway 日志是否有错误

**问题 2：自动更新 404 错误**

错误日志：
```
Cannot find latest.yml in the latest release artifacts
```

**解决**：
这是正常现象，开发阶段已禁用自动更新。如果仍然出现，说明打包版本使用了旧代码，请重新构建。

## 环境要求

- Node.js 20+
- pnpm 8+
- Windows 10/11

### 安装依赖

```bash
pnpm install
```

### 开发模式

**前置条件**：确保 Gateway 服务已启动

```bash
# 在项目根目录启动 Gateway
pnpm gateway:watch
```

**启动 Windows 应用**：

```bash
pnpm dev
```

应用将自动启动，支持热重载。默认连接到 `ws://127.0.0.1:18789`。

### 构建应用

**重要：Windows 打包需要管理员权限！**

原因：`electron-builder` 使用的 `7-Zip` 需要创建符号链接权限来解压 `rcedit` 工具。

```bash
# 方法 1：使用自动管理员批处理（推荐）
# 双击运行，会自动请求管理员权限
scripts\package-as-admin.bat

# 方法 2：以管理员身份打开 PowerShell，然后执行
pnpm package:win

# 其他打包命令（需要管理员权限）
pnpm build              # 仅构建代码
pnpm package            # 所有格式
pnpm package:nsis      # NSIS 安装包 (x64 + ia32)
pnpm package:nsis:x64  # NSIS 安装包 (仅 x64)
pnpm package:portable  # 便携版
pnpm package:zip       # ZIP 压缩包
pnpm package:dir       # 打包到目录（调试用）
```

构建产物输出到 `release/` 目录。

**快速修复工具**：如果打包遇到问题，可以运行：

```bash
# Windows 批处理脚本（双击或命令行运行）
scripts\fix-package-error.bat

# 或使用 Node.js 脚本
node scripts/clean-build.js
```

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
# 清理输出目录和终止相关进程
pnpm clean

# 深度清理（包括缓存）
pnpm clean:deep
```

## 故障排除

### 打包错误："rcedit-x64.exe: Fatal error: Unable to commit changes"

**问题原因**：
- exe 文件被占用或正在运行
- 权限不足
- 杀毒软件干扰

**解决方案**：

1. **自动清理**（推荐）
   ```bash
   # 使用集成了清理功能的打包命令
   pnpm package:win
   ```

2. **手动清理**
   ```bash
   # 手动终止进程
   taskkill /F /IM "OpenClaw Assistant.exe"
   taskkill /F /IM electron.exe
   
   # 清理旧文件
   pnpm clean
   
   # 重新打包
   pnpm package:win
   ```

3. **以管理员权限运行**
   - 右键点击 PowerShell/命令提示符
   - 选择"以管理员身份运行"
   - 再次执行打包命令

4. **临时禁用杀毒软件**
   - Windows Defender：设置 -> 更新和安全 -> Windows 安全中心 -> 病毒和威胁防护 -> 管理设置 -> 实时保护（关闭）
   - 完成打包后记得重新启用

5. **手动删除锁定目录**
   ```bash
   # 删除输出目录
   rmdir /s /q release
   rmdir /s /q out
   
   # 重新打包
   pnpm package:win
   ```

### 打包慢或下载失败

**使用国内镜像加速**：

```bash
# 设置 npm 镜像
npm config set registry https://registry.npmmirror.com

# 设置 Electron 镜像
npm config set electron_mirror https://npmmirror.com/mirrors/electron/

# 设置 Electron Builder 镜像
npm config set electron_builder_binaries_mirror https://npmmirror.com/mirrors/electron-builder-binaries/
```

### 打包后文件过大

**优化体积**：

1. 使用生产模式构建
2. 启用压缩：在 `electron-builder.json` 中设置 `"compression": "maximum"`
3. 移除开发依赖：`npm prune --production`

### 其他常见问题

**Q: 打包后的应用无法启动？**
A: 
- 检查是否缺少 VC++ 运行库
- 查看应用日志：`%APPDATA%\openclaw-assistant\logs`
- 尝试以管理员权限运行

**Q: 如何调试打包后的应用？**
A:
```bash
# 先打包到目录（不压缩）
pnpm package:dir

# 运行未打包的版本
.\release\win-unpacked\"OpenClaw Assistant.exe" --inspect
```

**Q: 如何跳过代码签名？**
A:
```bash
# 设置环境变量
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"
pnpm package:win
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
