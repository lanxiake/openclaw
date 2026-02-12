# Windows 客户端与网关集成测试方案

## 测试目标

验证 Windows 客户端能够：

1. 成功连接到 OpenClaw Gateway
2. 接收来自网关的消息和事件
3. 执行网关下发的命令
4. 执行网关下发的技能（Skills）
5. 正确处理 CLI 命令

## 当前问题分析

### 1. 网关服务启动问题

- **问题**：使用 `pnpm openclaw gateway start` 启动后，服务注册成功但实际未运行
- **原因**：Windows 计划任务可能配置有误或权限不足
- **解决方案**：使用前台运行模式进行测试

### 2. 日志文件编码问题

- **问题**：`logs/gateway.log` 和 `logs/.pids/gateway.pid` 文件使用 UTF-16 编码
- **影响**：难以直接读取和调试
- **解决方案**：使用 PowerShell 或专门的编码转换工具读取

### 3. TypeScript 编译错误

- **问题**：
  - `src/db/migrations/relations.ts` 缺少 `.js` 扩展名
  - `src/db/repositories/admins.ts` 类型不匹配
- **状态**：已修复

## 完整测试流程

### 阶段 1：环境准备

#### 1.1 清理环境

```bash
# 停止所有网关进程
pnpm openclaw gateway stop

# 清理旧的日志和 PID 文件
rm -rf logs/gateway.log logs/.pids/gateway.pid
```

#### 1.2 验证编译

```bash
# 确保 TypeScript 编译通过
pnpm build

# 验证编译结果
ls dist/
```

### 阶段 2：网关服务测试

#### 2.1 启动网关（前台模式）

```bash
# 在单独的终端窗口运行
pnpm openclaw gateway run --bind loopback --port 18789 --force --verbose
```

**预期输出**：

- `[gateway] listening on ws://127.0.0.1:18789`
- `[gateway] agent model: ...`
- 无错误信息

#### 2.2 验证网关运行

```bash
# 在另一个终端窗口运行
netstat -ano | findstr ":18789"
```

**预期输出**：

```
TCP    127.0.0.1:18789        0.0.0.0:0              LISTENING       <PID>
```

#### 2.3 测试网关健康检查

```bash
pnpm openclaw gateway health --json
```

**预期输出**：

```json
{
  "ok": true,
  "durationMs": <number>,
  "channels": { ... }
}
```

### 阶段 3：Windows 客户端构建

#### 3.1 安装依赖

```bash
cd apps/windows
pnpm install
```

#### 3.2 构建客户端

```bash
# 开发模式构建
pnpm dev

# 或生产模式构建
pnpm build
```

### 阶段 4：集成测试

#### 4.1 启动 Windows 客户端

```bash
cd apps/windows
pnpm dev
```

**预期行为**：

- 应用启动并显示托盘图标
- 自动尝试连接到 `ws://127.0.0.1:18789`
- 连接成功后托盘图标状态更新

#### 4.2 测试消息接收

**测试方法**：

1. 打开网关日志监控：`tail -f logs/gateway.log`
2. 在 Windows 客户端界面发送测试消息
3. 观察网关日志中的消息接收记录

**预期结果**：

- 网关日志显示收到客户端消息
- 客户端显示网关响应

#### 4.3 测试命令执行

**测试方法**：

1. 通过网关 API 发送命令执行请求
2. 观察 Windows 客户端是否收到并执行命令

**测试命令示例**：

```typescript
// 通过网关发送命令
{
  "type": "event",
  "event": "command.execute.request",
  "payload": {
    "requestId": "test-001",
    "command": "echo Hello from Gateway",
    "timeoutMs": 5000,
    "requireConfirm": false
  }
}
```

#### 4.4 测试技能执行

**测试方法**：

1. 注册测试技能
2. 通过网关触发技能执行
3. 验证技能执行结果

**测试技能示例**：

```typescript
{
  "type": "event",
  "event": "skill.execute",
  "payload": {
    "requestId": "skill-test-001",
    "skillId": "test-skill",
    "skillName": "测试技能",
    "params": { "message": "Hello" },
    "requireConfirm": false,
    "timeoutMs": 10000,
    "runMode": "local"
  }
}
```

#### 4.5 测试 CLI 命令

**测试命令列表**：

```bash
# 1. 查看连接状态
pnpm openclaw gateway status

# 2. 查看健康状态
pnpm openclaw gateway health

# 3. 发现网关
pnpm openclaw gateway discover

# 4. 调用网关方法
pnpm openclaw gateway call health

# 5. 查看使用成本
pnpm openclaw gateway usage-cost --days 7
```

## 自动化测试脚本

### 脚本 1：环境检查脚本

文件：`scripts/test-gateway-env.ps1`

```powershell
# 检查网关环境
Write-Host "=== OpenClaw Gateway 环境检查 ===" -ForegroundColor Cyan

# 1. 检查 Node.js 版本
Write-Host "`n[1/5] 检查 Node.js 版本..." -ForegroundColor Yellow
node --version

# 2. 检查 pnpm 版本
Write-Host "`n[2/5] 检查 pnpm 版本..." -ForegroundColor Yellow
pnpm --version

# 3. 检查编译状态
Write-Host "`n[3/5] 检查 TypeScript 编译..." -ForegroundColor Yellow
pnpm build

# 4. 检查端口占用
Write-Host "`n[4/5] 检查端口 18789..." -ForegroundColor Yellow
$port = netstat -ano | Select-String ":18789"
if ($port) {
    Write-Host "端口 18789 已被占用：" -ForegroundColor Red
    Write-Host $port
} else {
    Write-Host "端口 18789 空闲" -ForegroundColor Green
}

# 5. 检查配置文件
Write-Host "`n[5/5] 检查配置文件..." -ForegroundColor Yellow
$configPath = "$env:USERPROFILE\.openclaw\openclaw.json"
if (Test-Path $configPath) {
    Write-Host "配置文件存在: $configPath" -ForegroundColor Green
} else {
    Write-Host "配置文件不存在: $configPath" -ForegroundColor Red
}

Write-Host "`n=== 环境检查完成 ===" -ForegroundColor Cyan
```

### 脚本 2：网关启动脚本

文件：`scripts/start-gateway-test.ps1`

```powershell
# 启动网关测试环境
param(
    [switch]$Clean = $false
)

Write-Host "=== 启动 OpenClaw Gateway 测试环境 ===" -ForegroundColor Cyan

# 清理环境
if ($Clean) {
    Write-Host "`n清理旧环境..." -ForegroundColor Yellow
    pnpm openclaw gateway stop
    Start-Sleep -Seconds 2

    if (Test-Path "logs/gateway.log") {
        Remove-Item "logs/gateway.log" -Force
    }
    if (Test-Path "logs/.pids/gateway.pid") {
        Remove-Item "logs/.pids/gateway.pid" -Force
    }
}

# 启动网关
Write-Host "`n启动网关服务..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "pnpm openclaw gateway run --bind loopback --port 18789 --force --verbose"

# 等待启动
Write-Host "`n等待网关启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 验证启动
Write-Host "`n验证网关状态..." -ForegroundColor Yellow
$port = netstat -ano | Select-String ":18789"
if ($port) {
    Write-Host "✓ 网关已成功启动" -ForegroundColor Green
    Write-Host $port
} else {
    Write-Host "✗ 网关启动失败" -ForegroundColor Red
    exit 1
}

# 健康检查
Write-Host "`n执行健康检查..." -ForegroundColor Yellow
pnpm openclaw gateway health --json

Write-Host "`n=== 网关启动完成 ===" -ForegroundColor Cyan
```

### 脚本 3：集成测试脚本

文件：`scripts/test-windows-client-integration.ps1`

```powershell
# Windows 客户端集成测试
Write-Host "=== Windows 客户端集成测试 ===" -ForegroundColor Cyan

$testResults = @()

# 测试 1：网关连接测试
Write-Host "`n[测试 1/5] 网关连接测试..." -ForegroundColor Yellow
try {
    $health = pnpm openclaw gateway health --json | ConvertFrom-Json
    if ($health.ok) {
        Write-Host "✓ 网关连接成功" -ForegroundColor Green
        $testResults += @{Test="网关连接"; Result="通过"}
    } else {
        Write-Host "✗ 网关连接失败" -ForegroundColor Red
        $testResults += @{Test="网关连接"; Result="失败"}
    }
} catch {
    Write-Host "✗ 网关连接异常: $_" -ForegroundColor Red
    $testResults += @{Test="网关连接"; Result="异常"}
}

# 测试 2：消息发送测试
Write-Host "`n[测试 2/5] 消息发送测试..." -ForegroundColor Yellow
# TODO: 实现消息发送测试逻辑

# 测试 3：命令执行测试
Write-Host "`n[测试 3/5] 命令执行测试..." -ForegroundColor Yellow
# TODO: 实现命令执行测试逻辑

# 测试 4：技能执行测试
Write-Host "`n[测试 4/5] 技能执行测试..." -ForegroundColor Yellow
# TODO: 实现技能执行测试逻辑

# 测试 5：CLI 命令测试
Write-Host "`n[测试 5/5] CLI 命令测试..." -ForegroundColor Yellow
$cliCommands = @(
    "gateway status",
    "gateway health",
    "gateway discover"
)

foreach ($cmd in $cliCommands) {
    Write-Host "  测试命令: openclaw $cmd" -ForegroundColor Gray
    try {
        $output = Invoke-Expression "pnpm openclaw $cmd --json" 2>&1
        Write-Host "  ✓ 命令执行成功" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ 命令执行失败: $_" -ForegroundColor Red
    }
}

# 输出测试结果
Write-Host "`n=== 测试结果汇总 ===" -ForegroundColor Cyan
$testResults | Format-Table -AutoSize

Write-Host "`n=== 集成测试完成 ===" -ForegroundColor Cyan
```

## 测试检查清单

### 前置条件

- [ ] Node.js 22+ 已安装
- [ ] pnpm 已安装
- [ ] 项目依赖已安装 (`pnpm install`)
- [ ] TypeScript 编译通过 (`pnpm build`)
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

## 常见问题排查

### 问题 1：网关启动失败

**排查步骤**：

1. 检查端口是否被占用：`netstat -ano | findstr ":18789"`
2. 检查日志文件：查看 `logs/gateway.log`
3. 检查配置文件：`~/.openclaw/openclaw.json`
4. 尝试使用不同端口：`--port 18790`

### 问题 2：客户端无法连接

**排查步骤**：

1. 确认网关正在运行
2. 检查防火墙设置
3. 验证 WebSocket URL 配置
4. 查看客户端日志

### 问题 3：命令执行失败

**排查步骤**：

1. 检查命令格式是否正确
2. 验证权限设置
3. 查看错误日志
4. 确认超时设置

## 后续优化建议

1. **自动化测试**：
   - 编写单元测试覆盖核心功能
   - 添加 E2E 测试验证完整流程
   - 集成 CI/CD 自动运行测试

2. **监控和日志**：
   - 统一日志格式和编码
   - 添加结构化日志输出
   - 实现日志轮转和归档

3. **错误处理**：
   - 完善错误码定义
   - 添加详细的错误信息
   - 实现优雅的错误恢复

4. **性能优化**：
   - 监控连接延迟
   - 优化消息传输效率
   - 实现连接池管理

5. **文档完善**：
   - 补充 API 文档
   - 添加使用示例
   - 编写故障排查指南
