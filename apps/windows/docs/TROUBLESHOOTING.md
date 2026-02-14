# Windows 打包常见问题排查

## 问题 1: 符号链接创建失败（最常见）⚠️

### 错误信息
```
⚯ cannot execute  cause=exit status 2
errorOut=ERROR: Cannot create symbolic link : 客户端没有所需的特权
command='..\7zip-bin\...\7za.exe' x -bd '...\winCodeSign\...7z' ...
```

### 根本原因
**缺少管理员权限！**

`electron-builder` 使用 `7-Zip` 解压 `rcedit` 工具时需要创建符号链接，Windows 默认需要管理员权限才能创建符号链接。

### 解决方案（按优先级排序）

#### 方案 1：使用自动管理员批处理（推荐）⭐
```bash
# 双击运行，会自动请求管理员权限
scripts\package-as-admin.bat
```
此脚本会：
- 自动检测是否有管理员权限
- 如果没有，自动弹出 UAC 提示请求权限
- 以管理员身份执行完整打包流程

#### 方案 2：手动以管理员身份运行
1. 右键点击 **PowerShell** 或 **命令提示符**
2. 选择 **"以管理员身份运行"**
3. 执行打包命令：
   ```bash
   cd d:\AI-workspace\openclaw\apps\windows
   pnpm package:win
   ```

#### 方案 3：启用开发者模式（一次性设置）
Windows 10/11 开发者模式允许普通用户创建符号链接：

1. 打开 **设置** -> **更新和安全** -> **开发者选项**
2. 启用 **开发者模式**
3. **重启计算机**
4. 之后就可以以普通用户身份执行 `pnpm package:win`

⚠️ **注意**：开发者模式会降低系统安全性，仅建议在开发机上启用。

---

## 问题 2: rcedit-x64.exe 无法提交更改

### 错误信息
```
⨯ cannot execute  cause=exit status 1
errorOut=Fatal error: Unable to commit changes
command='...\rcedit-x64.exe' '...\OpenClaw Assistant.exe' ...
```

### 根本原因
- **文件被占用**: `OpenClaw Assistant.exe` 或 `electron.exe` 正在运行
- **权限问题**: 当前用户没有足够权限修改文件
- **杀毒软件**: Windows Defender 或其他杀毒软件正在扫描/锁定文件

### 解决方案（按优先级排序）

#### 方案 1: 使用自动清理打包（推荐）⭐
```bash
pnpm package:win
```
新版打包命令已集成自动清理功能，会自动：
- 终止相关进程
- 清理旧文件
- 重新构建并打包

#### 方案 2: 运行快速修复工具
```bash
# 双击运行或在命令行执行
scripts\fix-package-error.bat
```
然后重新打包：
```bash
pnpm package:win
```

#### 方案 3: 手动清理
```bash
# 1. 手动终止进程
taskkill /F /IM "OpenClaw Assistant.exe"
taskkill /F /IM electron.exe
taskkill /F /IM rcedit-x64.exe

# 2. 清理旧文件
pnpm clean

# 3. 重新打包
pnpm package:win
```

#### 方案 4: 以管理员身份运行
1. 右键点击 PowerShell 或命令提示符
2. 选择"以管理员身份运行"
3. 执行打包命令：
   ```bash
   cd d:\AI-workspace\openclaw\apps\windows
   pnpm package:win
   ```

#### 方案 5: 临时禁用杀毒软件
1. 打开 Windows 安全中心
2. 病毒和威胁防护 → 管理设置
3. 关闭"实时保护"
4. 执行打包
5. **完成后记得重新启用！**

#### 方案 6: 添加杀毒软件排除项
将以下目录添加到 Windows Defender 排除列表：
```
D:\AI-workspace\openclaw\apps\windows\release
D:\AI-workspace\openclaw\apps\windows\out
%LOCALAPPDATA%\electron-builder\Cache
```

## 问题 2: 打包速度慢或下载失败

### 解决方案：配置国内镜像
```bash
# npm 镜像
npm config set registry https://registry.npmmirror.com

# Electron 镜像
npm config set electron_mirror https://npmmirror.com/mirrors/electron/

# Electron Builder 镜像
npm config set electron_builder_binaries_mirror https://npmmirror.com/mirrors/electron-builder-binaries/
```

## 问题 3: 打包后文件过大

### 解决方案
1. **生产构建**（已默认启用）
2. **启用最大压缩**：编辑 `electron-builder.json`
   ```json
   {
     "compression": "maximum"
   }
   ```
3. **分析体积**：
   ```bash
   pnpm package:dir
   # 查看 release/win-unpacked 目录大小
   ```

## 问题 4: 打包后应用无法启动

### 排查步骤
1. **检查日志**：
   ```
   %APPDATA%\openclaw-assistant\logs
   ```

2. **调试模式运行**：
   ```bash
   pnpm package:dir
   .\release\win-unpacked\"OpenClaw Assistant.exe" --inspect
   ```

3. **检查依赖**：
   - 安装 VC++ Redistributable
   - 检查 .NET Framework

4. **以管理员运行**：
   右键 exe → 以管理员身份运行

## 常用命令速查

```bash
# 清理
pnpm clean              # 清理输出目录和进程
pnpm clean:deep         # 深度清理（包括缓存）
node scripts/clean-build.js  # 手动清理脚本

# 打包
pnpm package:win        # 完整打包（自动清理）
pnpm package:nsis       # 仅 NSIS 安装包
pnpm package:portable   # 仅便携版
pnpm package:zip        # 仅 ZIP
pnpm package:dir        # 打包到目录（调试用）

# 开发
pnpm dev                # 开发模式
pnpm build              # 仅构建代码
pnpm lint               # 代码检查
pnpm typecheck          # 类型检查
```

## 环境要求

- ✅ Node.js 20+
- ✅ pnpm 8+
- ✅ Windows 10/11
- ✅ 至少 1GB 可用磁盘空间
- ✅ 稳定的网络连接（首次打包）

## 技术支持

如果以上方案都无法解决问题，请提供以下信息：

1. 完整的错误日志
2. 操作系统版本
3. Node.js 和 pnpm 版本
4. 已尝试的解决方案
5. 是否使用了杀毒软件

---

**最后更新**: 2026-02-14
