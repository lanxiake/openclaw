# 阶段九：数据迁移和清理

## 目标

将现有 workspace-dev/ 下的文件内容迁移到数据库，并调整工作区创建逻辑。

## 文件改动

### 1. 新建 `src/commands/memory-migrate.ts`

CLI 命令 `openclaw memory migrate`：

```typescript
/**
 * 内存迁移命令
 * 将现有 workspace-dev/ 下的 .md 文件内容迁移到数据库
 *
 * 使用方式:
 *   openclaw memory migrate              # 执行迁移
 *   openclaw memory migrate --dry-run    # 预览模式，不实际写入
 *   openclaw memory migrate --user-id X  # 指定用户 ID（否则使用默认用户）
 */
```

#### 迁移逻辑

```
1. 扫描 ~/.openclaw/workspace-dev/ 下的 .md 文件
   ├── SOUL.md
   ├── IDENTITY.md
   ├── AGENTS.md
   ├── TOOLS.md
   ├── USER.md
   └── HEARTBEAT.md

2. 对每个文件:
   a. 读取内容
   b. 使用 stripFrontMatter() 去除 YAML 前缀
   c. 写入 user_workspace_files 表
      - source = "migration"
      - userId = 指定的用户 ID 或默认用户

3. 特殊处理 USER.md:
   a. 解析内容提取结构化数据:
      - name → user_facts (category: "personal", key: "name")
      - timezone → user_facts (category: "personal", key: "timezone")
      - location → user_facts (category: "location", key: "primary_location")
      - 其他字段同理
   b. 写入 user_facts 表
      - source = "migration"
      - confidence = 1.0（迁移数据视为高置信度）

4. 幂等保证:
   - 检查 user_workspace_files 是否已有 source="migration" 的记录
   - 已存在则跳过
   - 使用 upsert 避免重复

5. 输出迁移报告:
   ┌────────────────────────────────────────┐
   │ 记忆迁移报告                            │
   ├────────────────────────────────────────┤
   │ 文件迁移:                               │
   │   SOUL.md      ✅ 已迁移 (1.2KB)       │
   │   IDENTITY.md  ✅ 已迁移 (0.8KB)       │
   │   AGENTS.md    ⏭️ 已跳过（数据库已有）  │
   │   TOOLS.md     ✅ 已迁移 (2.1KB)       │
   │   USER.md      ✅ 已迁移 (0.5KB)       │
   │   HEARTBEAT.md ⚠️ 文件不存在            │
   │                                        │
   │ 事实提取 (from USER.md):                │
   │   name: 张三     ✅ 已保存              │
   │   timezone: +8   ✅ 已保存              │
   │                                        │
   │ 总计: 5 文件迁移, 2 事实提取            │
   └────────────────────────────────────────┘
```

### 2. 修改 `src/agents/workspace.ts`

#### ensureAgentWorkspace() 调整

```typescript
// 变更前: 新工作区自动创建 USER.md 等文件
// 变更后: 新工作区不再自动创建这些文件（由数据库管理）

export async function ensureAgentWorkspace(workspaceDir: string): Promise<void> {
  // 确保目录存在
  await fs.mkdir(workspaceDir, { recursive: true });

  // 不再自动创建 USER.md 等文件
  // 这些文件现在由数据库 workspace_templates + user_workspace_files 管理

  // 如果已有 workspace 目录且包含 .md 文件，输出迁移提示
  const existingFiles = await glob("*.md", { cwd: workspaceDir });
  if (existingFiles.length > 0) {
    logger.info(
      "Workspace directory contains legacy .md files. " +
        "Run 'openclaw memory migrate' to migrate them to the database.",
    );
  }
}
```

### 3. 注册 CLI 命令

修改 CLI 命令注册文件，添加 `memory migrate` 子命令：

```typescript
program
  .command("memory")
  .description("Manage agent memory system")
  .command("migrate")
  .description("Migrate workspace files from filesystem to database")
  .option("--dry-run", "Preview changes without writing to database")
  .option("--user-id <id>", "Specify user ID for migration")
  .action(async (options) => {
    await migrateMemory(options);
  });
```

## 验证

### 自动测试

```bash
pnpm vitest run src/commands/memory-migrate.test.ts
```

### 手动验证

```bash
# 1. 预览模式
pnpm openclaw memory migrate --dry-run
# 应输出迁移计划，不实际写入

# 2. 执行迁移
pnpm openclaw memory migrate
# 应输出迁移报告

# 3. 重复执行（幂等）
pnpm openclaw memory migrate
# 应显示"已跳过"，不重复写入

# 4. 验证数据库
# 检查 user_workspace_files 表有迁移记录
# 检查 user_facts 表有从 USER.md 提取的事实
```

### 测试要点

- 正常迁移：所有文件成功写入数据库
- 幂等性：重复运行不产生重复数据
- dry-run：不写入数据库，只输出计划
- 文件不存在：跳过并标记警告
- USER.md 解析：正确提取 name/timezone 等字段
- 无工作区目录：优雅处理，提示用户

## 回归测试

完成所有阶段后，执行完整的回归测试：

```bash
pnpm lint && pnpm build && pnpm test
```

确保：

- 现有功能不受影响
- CLI 模式（无数据库）仍可正常工作
- Gateway 模式使用数据库数据
- Admin Console 所有现有功能正常
