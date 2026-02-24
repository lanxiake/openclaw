# 记忆系统全面迁移计划：文件系统 → 数据库（多用户支持）

## Context

### 问题

OpenClaw 的 Agent 记忆系统存在**架构断裂**：数据库层（schema、repository、RPC 方法）已完整实现，但 Agent 运行时仍从文件系统读取 `workspace-dev/*.md` 文件（USER.md、SOUL.md、IDENTITY.md 等）。这导致：

1. 记忆数据无法按用户隔离，不支持多租户
2. 用户无法通过对话或客户端修改自己的 Agent 性格/记忆
3. 管理员无法在 Admin Console 查看/管理用户记忆和默认配置
4. Agent 读写记忆无审计日志

### 目标

1. **所有 workspace .md 文件迁移到数据库**，包括 SOUL.md、IDENTITY.md、AGENTS.md、TOOLS.md、HEARTBEAT.md、USER.md
2. **新用户自动继承系统默认配置**（现有模板文件内容作为默认值）
3. **管理员可在 Admin Console 管理默认记忆定义**，并查看用户记忆详情
4. **记录所有记忆读写的审计日志**
5. **渐进式迁移**：数据库优先，文件系统作为 fallback

### 当前调用链（需要改造）

```
Agent 启动 (attempt.ts:195 / cli-runner.ts:74 / compact.ts:207)
  → resolveBootstrapContextForRun()          [bootstrap-files.ts:43]
    → loadWorkspaceBootstrapFiles()           [workspace.ts:237]  ← 从磁盘读取 .md 文件
    → filterBootstrapFilesForSession()        [workspace.ts:295]  ← 子agent只保留AGENTS.md+TOOLS.md
    → applyBootstrapHookOverrides()           [bootstrap-hooks.ts:7]
    → buildBootstrapContextFiles()            [pi-embedded-helpers/bootstrap.ts:164]
      → 返回 EmbeddedContextFile[] (path=文件name, content=内容)
  → getUserContext()                          [user-context-store.ts:24]
    → userContext.assistantConfig              ← 已从DB加载，但不含记忆数据
  → buildEmbeddedSystemPrompt()               [pi-embedded-runner/system-prompt.ts:10]
    → buildAgentSystemPrompt()                [system-prompt.ts:211]
      → contextFiles 注入 (L597-614)          ← SOUL.md/USER.md等作为Project Context
      → SOUL.md 特殊检测 (L599-603)           ← 有SOUL.md时注入性格指令
      → userPersonalization 注入 (L654-657)   ← 从assistantConfig注入个性化
```

---

## 实施阶段概览

| 阶段 | 名称                | 文档                                     | 依赖       |
| ---- | ------------------- | ---------------------------------------- | ---------- |
| 一   | DB Schema 扩展      | `Memory-Migration-01-DB-Schema.md`       | 无         |
| 二   | 系统默认模板初始化  | `Memory-Migration-02-Template-Seed.md`   | 阶段一     |
| 三   | 用户上下文扩展      | `Memory-Migration-03-User-Context.md`    | 阶段一     |
| 四   | Agent 启动链路改造  | `Memory-Migration-04-Agent-Bootstrap.md` | 阶段二、三 |
| 五   | Agent 记忆工具      | `Memory-Migration-05-Agent-Tools.md`     | 阶段四     |
| 六   | Admin REST API      | `Memory-Migration-06-Admin-API.md`       | 阶段一     |
| 七   | API Client 类型扩展 | `Memory-Migration-07-API-Client.md`      | 阶段六     |
| 八   | Admin Console UI    | `Memory-Migration-08-Admin-Console.md`   | 阶段七     |
| 九   | 数据迁移和清理      | `Memory-Migration-09-Data-Migration.md`  | 阶段四     |

### 依赖关系图

```
阶段一 (DB Schema)
  ↓
阶段二 (模板初始化) ─── 阶段三 (用户上下文扩展)  [可并行]
  ↓                        ↓
  └──────────┬─────────────┘
             ↓
阶段四 (Agent 启动链路改造) ← 核心里程碑
  ↓
阶段五 (Agent 记忆工具)
  ↓
阶段六 (Admin REST API) ─── 阶段七 (API Client)  [可并行]
  ↓                           ↓
  └──────────┬────────────────┘
             ↓
阶段八 (Admin Console UI)
  ↓
阶段九 (数据迁移)
```

---

## 关键复用的现有代码

| 模块                      | 路径                                                      | 复用内容                         |
| ------------------------- | --------------------------------------------------------- | -------------------------------- |
| profile-memory schema     | `src/db/schema/profile-memory.ts`                         | 4 个表定义                       |
| profile-memory repository | `src/db/repositories/profile-memory.ts`                   | 4 个 Repository 类               |
| system-config schema      | `src/db/schema/system-config.ts`                          | `CONFIG_GROUPS.MEMORY` 已定义    |
| Gateway memory service    | `src/gateway/memory-service.ts`                           | `getGatewayMemoryService()` 单例 |
| Gateway memory RPC        | `src/gateway/server-methods/memory.ts`                    | 26 个 RPC 方法                   |
| 模板目录解析              | `src/agents/workspace-templates.ts`                       | `resolveWorkspaceTemplateDir()`  |
| 文件前缀去除              | `src/agents/workspace.ts`                                 | `stripFrontMatter()`             |
| 用户上下文加载            | `src/agents/user-context.ts`                              | `loadUserAgentContext()`         |
| Admin API client          | `packages/api-client/src/admin/`                          | AdminApiClient 类                |
| Admin hooks 模式          | `apps/admin-console/src/hooks/useUsers.ts`                | React Query 封装模式             |
| Admin 页面模式            | `apps/admin-console/src/pages/config/AgentConfigPage.tsx` | 表单+保存+重置 UI 模式           |
| User Detail 页面          | `apps/admin-console/src/pages/users/UserDetailPage.tsx`   | 要改造为 Tabs 布局               |

---

## 端到端验证清单

1. **启动 Gateway** → 验证系统模板自动初始化到数据库
2. **发送消息** → 验证 Agent 系统提示中包含数据库 workspace 文件内容（而非磁盘文件）
3. **对话中说"记住我叫张三"** → 验证 Agent 使用 `profile_memory_save` 工具写入数据库
4. **Admin Console 用户详情** → 验证记忆 Tab 显示用户事实/偏好/模式
5. **Admin Console 系统配置** → 验证可编辑默认模板，新用户继承新默认值
6. **Admin Console 审计日志** → 验证显示 Agent 的记忆读写操作
7. **运行迁移命令** → 验证现有 workspace-dev/ 文件内容导入数据库
8. **回归测试**：
   ```bash
   pnpm lint && pnpm build && pnpm test
   ```
