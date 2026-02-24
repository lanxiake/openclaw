# 阶段一：数据库 Schema 扩展 — workspace 文件表 + 审计日志表

## 目标

新增 `workspace_templates`（系统默认模板）和 `user_workspace_files`（用户自定义）两张表，以及 `memory_audit_logs` 审计日志表。

## 文件改动

### 1. 新建 `src/db/schema/workspace-files.ts`

```typescript
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * workspace_templates — 系统默认模板（管理员管理）
 * 存储 SOUL.md, IDENTITY.md, AGENTS.md, TOOLS.md, USER.md, HEARTBEAT.md 等默认模板内容
 */
export const workspaceTemplates = pgTable("workspace_templates", {
  id: text("id").primaryKey(),
  fileName: text("file_name").notNull(), // "SOUL.md", "IDENTITY.md" 等
  content: text("content").notNull(), // 模板内容
  description: text("description"), // 管理员备注
  isActive: boolean("is_active").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  updatedBy: text("updated_by"), // 管理员 ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * user_workspace_files — 用户自定义文件（覆盖模板）
 * 当用户或 Agent 修改了 SOUL.md 等文件内容时，存储在这里
 * 查询时先查此表，无结果则 fallback 到 workspace_templates
 */
export const userWorkspaceFiles = pgTable(
  "user_workspace_files",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    fileName: text("file_name").notNull(), // "SOUL.md", "IDENTITY.md" 等
    content: text("content").notNull(), // 用户自定义内容
    source: text("source", {
      enum: ["user_edit", "agent_edit", "admin_edit", "migration"],
    }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("user_workspace_files_user_file_idx").on(table.userId, table.fileName)],
);
```

### 2. 新建 `src/db/schema/memory-audit.ts`

```typescript
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * memory_audit_logs — 记忆操作审计日志
 * 记录 Agent、管理员、系统对用户记忆的所有读写操作
 */
export const memoryAuditLogs = pgTable("memory_audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(), // "read_profile", "update_soul", "add_fact" 等
  targetType: text("target_type").notNull(), // "workspace_file", "fact", "preference", "pattern"
  targetId: text("target_id"), // 被操作的记录 ID 或文件名
  source: text("source", { enum: ["agent", "admin", "api", "system"] }).notNull(),
  sessionId: text("session_id"),
  details: jsonb("details"), // 操作的额外详情（如变更前后值）
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 3. 修改 `src/db/schema/index.ts`

在现有导出中添加：

```typescript
export * from "./workspace-files.js";
export * from "./memory-audit.js";
```

### 4. 新建 `src/db/repositories/workspace-files.ts`

#### WorkspaceTemplateRepository

管理默认模板的 CRUD：

```typescript
class WorkspaceTemplateRepository {
  /** 根据文件名查找模板 */
  findByFileName(fileName: string): Promise<WorkspaceTemplate | null>;

  /** 获取所有活跃模板 */
  findAll(): Promise<WorkspaceTemplate[]>;

  /** 创建或更新模板（幂等） */
  upsert(fileName: string, content: string, updatedBy?: string): Promise<WorkspaceTemplate>;

  /** 删除模板 */
  delete(id: string): Promise<void>;

  /** 按版本查询历史 */
  findVersions(fileName: string): Promise<WorkspaceTemplate[]>;
}
```

#### UserWorkspaceFileRepository（TenantScoped）

管理用户自定义文件：

```typescript
class UserWorkspaceFileRepository {
  /** 根据文件名查找用户自定义文件 */
  findByFileName(fileName: string): Promise<UserWorkspaceFile | null>;

  /** 获取用户所有自定义文件 */
  findAll(): Promise<UserWorkspaceFile[]>;

  /** 创建或更新用户文件 */
  upsert(fileName: string, content: string, source: string): Promise<UserWorkspaceFile>;

  /** 删除用户自定义文件（恢复为默认模板） */
  delete(fileName: string): Promise<void>;

  /**
   * 获取有效文件内容（核心方法）
   * 优先返回用户自定义内容，无则返回系统默认模板
   */
  getEffectiveFile(
    fileName: string,
  ): Promise<{ content: string; source: "user" | "template" } | null>;
}
```

### 5. 新建 `src/db/repositories/memory-audit.ts`

```typescript
class MemoryAuditRepository {
  /**
   * 记录审计日志（fire-and-forget，不阻塞主流程）
   */
  log(entry: {
    userId: string;
    action: string;
    targetType: string;
    targetId?: string;
    source: "agent" | "admin" | "api" | "system";
    sessionId?: string;
    details?: Record<string, unknown>;
  }): Promise<void>;

  /**
   * 按用户查询审计日志，支持分页和过滤
   */
  findByUser(
    userId: string,
    options?: {
      action?: string;
      targetType?: string;
      source?: string;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<{ logs: MemoryAuditLog[]; total: number }>;
}

/**
 * 便捷工厂函数
 */
function logMemoryAccess(params: {
  db: Database;
  userId: string;
  action: string;
  targetType: string;
  targetId?: string;
  source: "agent" | "admin" | "api" | "system";
  sessionId?: string;
  details?: Record<string, unknown>;
}): void; // fire-and-forget，不返回 Promise
```

### 6. 生成 migration

```bash
pnpm db:generate
```

## 验证

### 单元测试

```bash
pnpm vitest run src/db/repositories/workspace-files.test.ts
pnpm vitest run src/db/repositories/memory-audit.test.ts
```

### 测试要点

**WorkspaceTemplateRepository：**

- `upsert` 幂等：相同内容不创建新记录
- `upsert` 更新：内容变化时 version 递增
- `findByFileName` 返回正确模板
- `findAll` 只返回 isActive=true 的记录

**UserWorkspaceFileRepository：**

- `upsert` 创建新用户文件
- `upsert` 更新已有文件
- `getEffectiveFile` 用户有自定义时返回用户版本
- `getEffectiveFile` 用户无自定义时 fallback 到模板
- `delete` 后 `getEffectiveFile` 回退到模板
- 用户隔离：不同 userId 的文件互不影响

**MemoryAuditRepository：**

- `log` 成功写入记录
- `findByUser` 分页正确
- `findByUser` 按 action/targetType/source 过滤
- `findByUser` 按日期范围过滤
