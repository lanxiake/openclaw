# 阶段二：系统默认模板初始化 — 将现有模板文件导入数据库

## 目标

系统首次启动或 seed 时，将 `docs/reference/templates/*.md` 的内容作为默认模板写入 `workspace_templates` 表。

## 文件改动

### 1. 新建 `src/db/seed/workspace-templates.ts`

```typescript
/**
 * 将模板文件内容写入 workspace_templates 表
 *
 * 逻辑：
 * 1. 使用 resolveWorkspaceTemplateDir() 定位模板目录
 * 2. 读取所有 .md 文件
 * 3. 使用 stripFrontMatter() 去除 YAML 前缀
 * 4. 对每个文件调用 WorkspaceTemplateRepository.upsert()
 * 5. 幂等：已存在且内容相同则跳过
 */
export async function seedWorkspaceTemplates(db: Database): Promise<void>;
```

文件列表：

- SOUL.md
- IDENTITY.md
- AGENTS.md
- TOOLS.md
- USER.md
- HEARTBEAT.md

### 2. 修改 `src/db/seed/index.ts` 或 Gateway 启动流程

在 seed/启动时调用模板初始化：

```typescript
import { seedWorkspaceTemplates } from "./workspace-templates.js";

// 在 seed 函数中调用
await seedWorkspaceTemplates(db);
```

### 关键复用

| 函数                                   | 来源                                | 用途           |
| -------------------------------------- | ----------------------------------- | -------------- |
| `resolveWorkspaceTemplateDir()`        | `src/agents/workspace-templates.ts` | 定位模板目录   |
| `stripFrontMatter()`                   | `src/agents/workspace.ts`           | 去除 YAML 前缀 |
| `WorkspaceTemplateRepository.upsert()` | 阶段一新建                          | 写入数据库     |

## 验证

```bash
pnpm db:seed
# 验证 workspace_templates 表有 6 条记录
```

### 测试要点

- 首次运行：创建 6 条模板记录
- 重复运行：不创建重复记录（幂等）
- 内容变更：模板文件修改后重新 seed，数据库更新且 version 递增
- 缺少文件：某模板文件不存在时跳过，不报错
