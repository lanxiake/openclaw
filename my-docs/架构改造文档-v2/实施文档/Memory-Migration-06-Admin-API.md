# 阶段六：Admin REST API — 记忆管理和默认模板管理

## 目标

为 Admin Console 提供 REST API 端点，支持管理员管理用户记忆和系统默认模板。

## 文件改动

### 1. 新建 `apps/api-server/src/routes/admin/memory.ts`

用户记忆管理路由：

```
GET    /api/admin/users/:userId/memory/overview
       — 记忆概览统计（事实数、模式数、偏好状态、最近更新时间）

GET    /api/admin/users/:userId/memory/facts
       — 事实列表（分页、按 category 筛选、搜索）
       Query: { page?, limit?, category?, search? }

PUT    /api/admin/users/:userId/memory/facts/:id
       — 更新事实
       Body: { value?, confidence?, category? }

DELETE /api/admin/users/:userId/memory/facts/:id
       — 删除事实

GET    /api/admin/users/:userId/memory/preferences
       — 偏好设置

PUT    /api/admin/users/:userId/memory/preferences
       — 更新偏好
       Body: { language?, responseStyle?, ... }

GET    /api/admin/users/:userId/memory/patterns
       — 行为模式列表

DELETE /api/admin/users/:userId/memory/patterns/:id
       — 删除模式

GET    /api/admin/users/:userId/memory/workspace-files
       — workspace 文件列表（含是否自定义标记）

PUT    /api/admin/users/:userId/memory/workspace-files/:fileName
       — 更新用户 workspace 文件
       Body: { content: string }

DELETE /api/admin/users/:userId/memory/workspace-files/:fileName
       — 恢复为默认模板（删除用户自定义文件）

GET    /api/admin/users/:userId/memory/audit-logs
       — 审计日志（分页、过滤）
       Query: { page?, limit?, action?, targetType?, source?, startDate?, endDate? }

GET    /api/admin/users/:userId/memory/export
       — 导出完整画像（JSON 格式，包含所有记忆数据）
```

### 2. 新建 `apps/api-server/src/routes/admin/workspace-templates.ts`

系统默认模板管理路由：

```
GET    /api/admin/workspace-templates
       — 所有默认模板列表

GET    /api/admin/workspace-templates/:fileName
       — 单个模板内容

PUT    /api/admin/workspace-templates/:fileName
       — 更新默认模板
       Body: { content: string, description?: string }

POST   /api/admin/workspace-templates/:fileName/reset
       — 重置为出厂默认值（从模板文件重新读取）
```

### 3. 注册路由到 api-server

修改 `apps/api-server/src/server.ts`，注册新路由：

```typescript
import { memoryRoutes } from "./routes/admin/memory.js";
import { workspaceTemplateRoutes } from "./routes/admin/workspace-templates.js";

// 在 admin 路由组中注册
app.register(memoryRoutes, { prefix: "/api/admin" });
app.register(workspaceTemplateRoutes, { prefix: "/api/admin" });
```

### 响应格式

遵循现有 API 响应格式：

```typescript
// 成功
{
  success: true,
  data: { ... }
}

// 列表（带分页）
{
  success: true,
  data: [...],
  meta: { total: 100, page: 1, limit: 20 }
}

// 错误
{
  success: false,
  error: "User not found"
}
```

### 权限要求

所有路由需要 admin 认证（复用现有 admin auth middleware）。

## 验证

```bash
pnpm vitest run apps/api-server/src/routes/admin/memory.test.ts
pnpm vitest run apps/api-server/src/routes/admin/workspace-templates.test.ts
```

### 测试要点

**memory.ts：**

- GET overview：返回正确统计数据
- GET facts：分页、筛选、搜索正常
- PUT facts/:id：更新成功，审计日志记录
- DELETE facts/:id：删除成功
- GET workspace-files：列表包含 source 标记（user/template）
- PUT workspace-files/:fileName：创建/更新用户文件
- DELETE workspace-files/:fileName：恢复为默认模板
- GET audit-logs：分页和过滤正常
- GET export：包含所有记忆数据

**workspace-templates.ts：**

- GET：返回所有模板
- PUT：更新模板内容和 version
- POST reset：重新从文件读取并更新

**安全测试：**

- 未认证请求：401
- 非 admin 用户：403
- 无效 userId：404
- 无效 fileName：400
