# Windows 客户端测试脚本使用指南

本目录包含用于测试 Windows 客户端与 OpenClaw Gateway 集成的自动化脚本。

## 📋 脚本列表

### 1. `test-gateway-env.ps1` - 环境检查脚本

检查测试所需的环境是否就绪。

**用途**：

- 验证 Node.js 和 pnpm 版本
- 检查项目依赖是否安装
- 验证 TypeScript 编译状态
- 检查端口占用情况
- 验证配置文件

**使用方法**：

```powershell
.\scripts\test-gateway-env.ps1
```

### 2. `start-gateway-test.ps1` - 网关启动脚本

启动 OpenClaw Gateway 服务并验证其运行状态。

**参数**：

- `-Clean`: 清理旧环境（日志、PID 文件等）
- `-Port <number>`: 指定端口（默认：18789）
- `-Bind <mode>`: 绑定模式（默认：loopback）
- `-Verbose`: 启用详细日志

**使用方法**：

```powershell
# 基本启动
.\scripts\start-gateway-test.ps1

# 清理环境后启动
.\scripts\start-gateway-test.ps1 -Clean

# 使用自定义端口
.\scripts\start-gateway-test.ps1 -Port 18790

# 启用详细日志
.\scripts\start-gateway-test.ps1 -Verbose
```

### 3. `test-windows-client-integration.ps1` - 集成测试脚本

运行完整的集成测试套件。

**参数**：

- `-GatewayUrl <url>`: 网关 WebSocket URL（默认：ws://127.0.0.1:18789）
- `-SkipBuild`: 跳过构建测试
- `-Verbose`: 显示详细输出

**测试项目**：

1. 网关连接测试
2. 网关状态查询
3. 网关发现功能
4. CLI 命令测试
5. Windows 客户端构建
6. WebSocket 连接测试

**使用方法**：

```powershell
# 运行所有测试
.\scripts\test-windows-client-integration.ps1

# 跳过构建测试
.\scripts\test-windows-client-integration.ps1 -SkipBuild

# 使用自定义网关 URL
.\scripts\test-windows-client-integration.ps1 -GatewayUrl "ws://192.168.1.100:18789"

# 详细输出
.\scripts\test-windows-client-integration.ps1 -Verbose
```

### 4. `run-full-test.ps1` - 完整测试流程

自动化执行完整的测试流程，包括环境检查、网关启动、集成测试和报告生成。

**参数**：

- `-Clean`: 清理环境
- `-SkipEnvCheck`: 跳过环境检查
- `-SkipBuild`: 跳过构建测试
- `-Verbose`: 详细输出
- `-Port <number>`: 网关端口

**使用方法**：

```powershell
# 运行完整测试（推荐）
.\scripts\run-full-test.ps1

# 清理环境后运行
.\scripts\run-full-test.ps1 -Clean

# 快速测试（跳过环境检查和构建）
.\scripts\run-full-test.ps1 -SkipEnvCheck -SkipBuild

# 详细模式
.\scripts\run-full-test.ps1 -Clean -Verbose
```

## 🚀 快速开始

### 首次运行

```powershell
# 1. 检查环境
.\scripts\test-gateway-env.ps1

# 2. 运行完整测试
.\scripts\run-full-test.ps1 -Clean
```

### 日常测试

```powershell
# 快速测试（跳过环境检查）
.\scripts\run-full-test.ps1 -SkipEnvCheck
```

### 调试模式

```powershell
# 详细输出，便于排查问题
.\scripts\run-full-test.ps1 -Clean -Verbose
```

## 📊 测试报告

测试完成后会生成两种报告：

1. **集成测试报告**：`test-results-<timestamp>.json`
   - 包含每个测试项的详细结果
   - 测试通过率统计

2. **完整测试报告**：`test-report-<timestamp>.json`
   - 包含系统信息
   - 测试配置
   - 总耗时
   - 整体测试结果

**查看报告**：

```powershell
# 查看最新的测试报告
Get-Content (Get-ChildItem test-report-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

## 🔍 故障排查

### 问题 1：环境检查失败

**症状**：`test-gateway-env.ps1` 报错

**解决方案**：

```powershell
# 检查 Node.js 版本（需要 22+）
node --version

# 安装 pnpm
npm install -g pnpm

# 安装项目依赖
pnpm install

# 编译 TypeScript
pnpm build
```

### 问题 2：网关启动失败

**症状**：`start-gateway-test.ps1` 无法启动网关

**解决方案**：

```powershell
# 检查端口占用
netstat -ano | findstr ":18789"

# 停止占用端口的进程
Stop-Process -Id <PID> -Force

# 清理环境后重新启动
.\scripts\start-gateway-test.ps1 -Clean
```

### 问题 3：集成测试失败

**症状**：部分测试项失败

**解决方案**：

```powershell
# 查看网关日志
Get-Content logs/gateway.log -Tail 100

# 检查网关状态
pnpm openclaw gateway status

# 手动测试健康检查
pnpm openclaw gateway health

# 重新运行测试
.\scripts\test-windows-client-integration.ps1 -Verbose
```

### 问题 4：WebSocket 连接失败

**症状**：WebSocket 连接测试失败

**解决方案**：

```powershell
# 检查防火墙设置
# 确保允许 Node.js 访问网络

# 检查网关是否监听正确的地址
netstat -ano | findstr ":18789"

# 尝试使用不同的绑定模式
.\scripts\start-gateway-test.ps1 -Clean -Bind "lan"
```

## 📝 测试检查清单

### 前置条件

- [ ] Node.js 22+ 已安装
- [ ] pnpm 已安装
- [ ] 项目依赖已安装 (`pnpm install`)
- [ ] TypeScript 已编译 (`pnpm build`)
- [ ] 端口 18789 未被占用

### 网关测试

- [ ] 网关服务可以启动
- [ ] 网关监听在正确的端口
- [ ] 健康检查返回正常
- [ ] 可以通过 WebSocket 连接

### 客户端测试

- [ ] Windows 客户端可以构建
- [ ] 客户端可以启动
- [ ] 客户端可以连接到网关
- [ ] 客户端可以接收网关消息
- [ ] 客户端可以执行命令
- [ ] 客户端可以执行技能

### CLI 测试

- [ ] `openclaw gateway status` 正常
- [ ] `openclaw gateway health` 正常
- [ ] `openclaw gateway discover` 正常
- [ ] `openclaw gateway call` 正常

## 🔧 高级用法

### 自定义测试配置

创建自定义测试配置文件 `test-config.ps1`：

```powershell
# 自定义测试配置
$TestConfig = @{
    GatewayPort = 18789
    GatewayBind = "loopback"
    TestTimeout = 30000
    SkipSlowTests = $false
}

# 运行测试
.\scripts\run-full-test.ps1 -Port $TestConfig.GatewayPort
```

### 持续集成 (CI)

在 CI 环境中运行测试：

```powershell
# CI 模式：非交互式，详细输出
.\scripts\run-full-test.ps1 -Clean -Verbose -SkipBuild

# 检查退出码
if ($LASTEXITCODE -ne 0) {
    Write-Error "测试失败"
    exit 1
}
```

### 性能测试

添加性能测试脚本：

```powershell
# 测试网关响应时间
$iterations = 100
$times = @()

for ($i = 0; $i -lt $iterations; $i++) {
    $start = Get-Date
    pnpm openclaw gateway health --json | Out-Null
    $end = Get-Date
    $times += ($end - $start).TotalMilliseconds
}

$avgTime = ($times | Measure-Object -Average).Average
Write-Host "平均响应时间: $([math]::Round($avgTime, 2)) ms"
```

## 📚 相关文档

- [完整测试方案](../docs/testing/windows-client-gateway-test-plan.md)
- [Windows 客户端开发指南](../apps/windows/README.md)
- [OpenClaw Gateway 文档](../docs/gateway/)

## 🤝 贡献

如果您发现测试脚本的问题或有改进建议，请：

1. 提交 Issue 描述问题
2. 提交 Pull Request 修复问题
3. 更新相关文档

## 📄 许可证

与主项目相同的许可证。
