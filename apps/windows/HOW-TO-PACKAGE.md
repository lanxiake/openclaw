# Windows 打包完整指南

## 🎯 快速开始（推荐方法）

### 方法 1：一键打包（最简单）⭐

1. **双击运行批处理文件**：
   ```
   scripts\package-as-admin.bat
   ```

2. **在 UAC 提示中点击"是"** 授予管理员权限

3. **等待打包完成**（约 3-5 分钟）

4. **查看结果**：
   - 安装包位于 `release/` 目录
   - 包含 NSIS、便携版、ZIP 三种格式

---

## 📋 前置要求

### 必需条件
- ✅ Node.js 20+
- ✅ pnpm 8+
- ✅ Windows 10/11
- ✅ **管理员权限**（重要！）
- ✅ 至少 1GB 可用磁盘空间

### 为什么需要管理员权限？

`electron-builder` 使用 `7-Zip` 解压 `rcedit` 工具时需要创建符号链接，Windows 默认要求管理员权限才能创建符号链接。

**错误提示**：
```
ERROR: Cannot create symbolic link : 客户端没有所需的特权
```

---

## 🚀 打包方法

### 方法 1：自动管理员批处理（推荐）

**特点**：自动请求管理员权限，无需手动操作

```bash
# 双击运行或命令行执行
scripts\package-as-admin.bat
```

### 方法 2：手动以管理员身份运行

**步骤**：

1. **以管理员身份打开 PowerShell**
   - 搜索 "PowerShell"
   - 右键 -> "以管理员身份运行"

2. **切换到项目目录**
   ```powershell
   cd d:\AI-workspace\openclaw\apps\windows
   ```

3. **执行打包命令**
   ```powershell
   pnpm package:win
   ```

### 方法 3：启用开发者模式（一劳永逸）

**优点**：以后不需要管理员权限
**缺点**：会降低系统安全性

**步骤**：

1. 打开 **设置** (Win + I)
2. 选择 **更新和安全** -> **开发者选项**
3. 启用 **开发者模式**
4. **重启计算机**
5. 以后可以直接运行 `pnpm package:win` 无需管理员权限

⚠️ **仅建议在开发机上启用开发者模式**

---

## 🛠️ 其他打包命令

所有命令都需要管理员权限（除非启用了开发者模式）：

```bash
# 仅构建代码（不打包）
pnpm build

# 打包所有格式
pnpm package

# 仅打包 NSIS 安装包
pnpm package:nsis

# 仅打包 NSIS x64 版本
pnpm package:nsis:x64

# 仅打包便携版
pnpm package:portable

# 仅打包 ZIP
pnpm package:zip

# 打包到目录（用于调试）
pnpm package:dir
```

---

## 🧹 清理命令

遇到问题时，先清理再重试：

```bash
# 快速清理（终止进程 + 删除旧文件）
pnpm clean

# 深度清理（包括缓存）
pnpm clean:deep

# 使用清理工具
scripts\fix-package-error.bat
```

---

## 📦 打包产物

成功后，在 `release/` 目录下会生成：

### NSIS 安装包
- `OpenClaw Assistant-Setup-0.1.0-x64.exe` - 64位安装包
- `OpenClaw Assistant-Setup-0.1.0-ia32.exe` - 32位安装包

**特点**：
- 标准 Windows 安装程序
- 支持自定义安装目录
- 创建桌面快捷方式
- 支持卸载

### 便携版
- `OpenClaw Assistant-0.1.0-portable.exe`

**特点**：
- 单文件可执行
- 无需安装，解压即用
- 适合 U 盘携带

### ZIP 压缩包
- `OpenClaw Assistant-0.1.0-x64.zip`

**特点**：
- 绿色版
- 解压后直接运行
- 适合服务器部署

---

## ❌ 常见问题排查

### 问题 1：符号链接创建失败

**错误**：
```
ERROR: Cannot create symbolic link : 客户端没有所需的特权
```

**解决**：
- ✅ 使用 `scripts\package-as-admin.bat`
- ✅ 或以管理员身份运行 PowerShell
- ✅ 或启用开发者模式

### 问题 2：rcedit 无法修改 exe

**错误**：
```
Fatal error: Unable to commit changes
```

**解决**：
```bash
# 1. 手动终止进程
taskkill /F /IM "OpenClaw Assistant.exe"
taskkill /F /IM electron.exe

# 2. 清理旧文件
pnpm clean

# 3. 重新打包
scripts\package-as-admin.bat
```

### 问题 3：下载速度慢

**解决**：配置国内镜像
```bash
npm config set registry https://registry.npmmirror.com
npm config set electron_mirror https://npmmirror.com/mirrors/electron/
npm config set electron_builder_binaries_mirror https://npmmirror.com/mirrors/electron-builder-binaries/
```

### 问题 4：Windows Defender 干扰

**临时方案**：
1. 打开 Windows 安全中心
2. 病毒和威胁防护 -> 管理设置
3. 关闭"实时保护"
4. 执行打包
5. **完成后重新启用**

**永久方案**：添加排除项
```powershell
# 以管理员身份运行
scripts\add-defender-exclusion.ps1

# 打包完成后可以移除排除项
scripts\add-defender-exclusion.ps1 -Remove
```

---

## 📊 打包流程说明

`scripts\package-windows.js` 自动执行以下步骤：

1. **清理环境**
   - 终止相关进程（electron.exe, OpenClaw Assistant.exe, rcedit-x64.exe）
   - 删除旧的 `release/` 和 `out/` 目录
   - 清理 `rcedit` 缓存

2. **构建项目**
   - 使用 `electron-vite` 编译 TypeScript
   - 生成 main、preload、renderer 代码

3. **打包应用**
   - 下载 Electron 运行时
   - 打包应用资源
   - 生成安装包

---

## 🔗 相关文档

- [README.md](./README.md) - 项目总览
- [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) - 详细故障排除
- [electron-builder 文档](https://www.electron.build/)

---

## 💡 最佳实践

1. **首次打包**：使用 `scripts\package-as-admin.bat`
2. **开发阶段**：启用开发者模式以避免每次都需要管理员权限
3. **CI/CD**：确保 CI 环境有符号链接权限或使用 GitHub Actions 的 `windows-latest` runner
4. **发布前**：禁用开发者模式，使用管理员权限打包最终版本

---

**最后更新**: 2026-02-14
