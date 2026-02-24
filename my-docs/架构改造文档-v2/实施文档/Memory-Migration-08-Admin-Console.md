# 阶段八：Admin Console — 用户记忆 Tab + 默认模板管理页

## 目标

1. 在用户详情页增加"记忆"Tab
2. 在系统配置中增加"默认记忆模板"管理页

## 文件改动

### 1. 新建 `apps/admin-console/src/hooks/useMemory.ts`

React Query hooks：

```typescript
// ========== 用户记忆 ==========
export function useUserMemoryOverview(userId: string);
export function useUserMemoryFacts(userId: string, params?: UserMemoryFactListParams);
export function useUpdateMemoryFact();
export function useDeleteMemoryFact();
export function useUserMemoryPreferences(userId: string);
export function useUpdateMemoryPreferences();
export function useUserMemoryPatterns(userId: string);
export function useDeleteMemoryPattern();
export function useUserWorkspaceFiles(userId: string);
export function useUpdateUserWorkspaceFile();
export function useDeleteUserWorkspaceFile();
export function useUserMemoryAuditLogs(userId: string, params?: MemoryAuditLogListParams);
export function useExportUserMemory();

// ========== 系统模板 ==========
export function useWorkspaceTemplates();
export function useWorkspaceTemplate(fileName: string);
export function useUpdateWorkspaceTemplate();
export function useResetWorkspaceTemplate();
```

### 2. 修改 `apps/admin-console/src/pages/users/UserDetailPage.tsx`

改造为 Tabs 布局：

```
┌─────────────────────────────────────────────┐
│  用户详情: user@example.com                  │
├──────────┬──────────────────────────────────┤
│ Tab: 基本信息 │ Tab: 记忆管理                │
├──────────┴──────────────────────────────────┤
│                                             │
│  [当前 Tab 的内容]                           │
│                                             │
└─────────────────────────────────────────────┘
```

- **Tab 1: 基本信息** — 现有 4 个卡片（用户信息、设备、配额、配置）
- **Tab 2: 记忆管理** — 新增，包含子 Tab

### 3. 记忆管理 Tab 子组件

记忆管理 Tab 内部分为子 Tab：

```
┌─────────────────────────────────────────────┐
│ 概览 │ 事实 │ 文件 │ 偏好 │ 模式 │ 日志    │
├─────────────────────────────────────────────┤
│                                             │
│  [子 Tab 内容]                               │
│                                             │
└─────────────────────────────────────────────┘
```

#### 子组件提取

**`apps/admin-console/src/pages/users/components/MemoryOverview.tsx`** — 概览统计

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 事实数    │ │ 模式数    │ │ 偏好状态  │ │ 最近更新  │
│    42    │ │     8    │ │   已设置  │ │ 2h 前    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

**`apps/admin-console/src/pages/users/components/FactsTable.tsx`** — 事实表格

```
┌──────────────────────────────────────────────────┐
│ [搜索框]  [类别筛选 ▼]            [新增事实] [刷新] │
├──────┬──────────┬──────┬─────────┬───────┬───────┤
│ 类别  │ Key      │ Value │ 置信度  │ 来源   │ 操作  │
├──────┼──────────┼──────┼─────────┼───────┼───────┤
│ 个人  │ name     │ 张三  │ 0.95   │ agent │ ✏️ 🗑 │
│ 位置  │ timezone │ +8   │ 0.80   │ agent │ ✏️ 🗑 │
├──────┴──────────┴──────┴─────────┴───────┴───────┤
│                 分页: < 1 2 3 >                    │
└──────────────────────────────────────────────────┘
```

**`apps/admin-console/src/pages/users/components/WorkspaceFilesEditor.tsx`** — Markdown 文件编辑器

```
┌──────────────────────────────────────────────────┐
│ SOUL.md [自定义]  IDENTITY.md [默认]  ...          │
├──────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────┐ │
│ │ [编辑模式]           │ │ [预览模式]           │ │
│ │                      │ │                      │ │
│ │ # Soul Definition    │ │ Soul Definition      │ │
│ │ You are a warm...    │ │ You are a warm...    │ │
│ │                      │ │                      │ │
│ └──────────────────────┘ └──────────────────────┘ │
│ [保存] [恢复默认]                                   │
└──────────────────────────────────────────────────┘
```

**`apps/admin-console/src/pages/users/components/PreferencesForm.tsx`** — 偏好表单

```
┌──────────────────────────────────────────────────┐
│ 语言偏好:      [中文 ▼]                            │
│ 回复风格:      [简洁 ▼]                            │
│ 技术水平:      [高级 ▼]                            │
│ 其他设置:      ...                                 │
│                                                    │
│ [保存修改] [重置]                                   │
└──────────────────────────────────────────────────┘
```

**`apps/admin-console/src/pages/users/components/PatternsCard.tsx`** — 行为模式卡片

```
┌──────────────────────────────────────────────────┐
│ [交互习惯] 用户偏好在早上 9-11 点使用                │
│ 置信度: ████████░░ 80%  | 状态: ✅ 已确认           │
│ 证据: 最近30天登录记录分析                           │
│                                        [删除]     │
├──────────────────────────────────────────────────┤
│ [沟通风格] 用户倾向使用中文交流                       │
│ 置信度: █████████░ 90%  | 状态: ✅ 已确认           │
│ 证据: 对话语言分析                                  │
│                                        [删除]     │
└──────────────────────────────────────────────────┘
```

**`apps/admin-console/src/pages/users/components/MemoryAuditLog.tsx`** — 审计日志时间线

```
┌──────────────────────────────────────────────────┐
│ [过滤: 全部 ▼] [来源: 全部 ▼] [日期范围]            │
├──────────────────────────────────────────────────┤
│ ● 14:30  agent   save_fact     name → "张三"      │
│ ● 14:28  agent   search_facts  query: "name"      │
│ ● 13:15  admin   update_soul   SOUL.md 已修改      │
│ ● 12:00  system  read_profile  Agent 启动加载      │
│ ...                                                │
│                 分页: < 1 2 3 >                    │
└──────────────────────────────────────────────────┘
```

### 4. 新建 `apps/admin-console/src/pages/config/MemoryTemplatesPage.tsx`

默认记忆模板管理页面：

```
┌──────────────────────────────────────────────────┐
│ 系统配置 > 默认记忆模板                              │
├──────────────────────────────────────────────────┤
│ ┌────────────┐                                    │
│ │ SOUL.md    │ ← 选中                              │
│ │ IDENTITY.md│                                    │
│ │ AGENTS.md  │                                    │
│ │ TOOLS.md   │                                    │
│ │ USER.md    │                                    │
│ │ HEARTBEAT  │                                    │
│ └────────────┘                                    │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ # SOUL.md (v3, 管理员 admin@example.com 更新) │  │
│ │                                              │  │
│ │ [Markdown 编辑区]                             │  │
│ │                                              │  │
│ │ 描述: 定义 Agent 的核心性格和行为准则           │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ [保存] [重置为出厂默认值]                            │
│                                                    │
│ ℹ️ 修改默认模板后，新用户将使用新默认值。             │
│    已有用户的自定义内容不受影响。                      │
└──────────────────────────────────────────────────┘
```

### 5. 修改 `apps/admin-console/src/routes/index.tsx`

增加路由：

```typescript
const MemoryTemplatesPage = lazy(() => import('@/pages/config/MemoryTemplatesPage'));

// 在 config children 中增加：
{ path: 'memory-templates', element: withSuspense(MemoryTemplatesPage) },
```

### 6. 修改 `apps/admin-console/src/pages/config/ConfigPage.tsx`

在配置导航中增加"记忆模板"入口。

### 7. 修改 `apps/admin-console/src/components/layout/Sidebar.tsx`

在侧边栏配置区域增加"记忆模板"导航项。

## UI 技术栈

- **组件库**: shadcn/ui（Card, Tabs, Table, Badge, Dialog, Textarea, Select）
- **Markdown 编辑**: Textarea + 预览模式切换（不引入重型 Markdown 编辑器）
- **参考代码风格**: `AgentConfigPage.tsx`（表单+保存+重置模式）
- **数据获取**: React Query + API Client hooks

## 验证

```bash
cd apps/admin-console && pnpm dev
```

### 手动验证清单

1. 打开用户列表 → 点击用户 → 看到"基本信息"和"记忆管理"两个 Tab
2. 切换到"记忆管理" Tab → 看到概览统计卡片
3. 切换到"事实"子 Tab → 看到事实表格，支持搜索/筛选/分页
4. 编辑事实 → 保存成功，表格刷新
5. 切换到"文件"子 Tab → 看到 workspace 文件列表
6. 编辑 SOUL.md → 保存成功，标记变为"自定义"
7. 点击"恢复默认" → 确认后恢复，标记变为"默认"
8. 打开系统配置 → 记忆模板 → 看到 6 个模板文件
9. 编辑模板 → 保存成功，version 递增
10. 重置模板 → 确认后恢复为出厂默认值
