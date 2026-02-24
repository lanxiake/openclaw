# 阶段五：Agent 记忆工具 — 让 Agent 读写数据库记忆

## 目标

新增 Agent 工具，让 Agent 在对话中可以读写用户的 profile memory 和 workspace 文件。

## 文件改动

### 1. 新建 `src/agents/tools/profile-memory-tool.ts`

4 个新工具（通过 `getUserContext()` 获取 userId）：

#### profile_memory_search — 搜索用户事实

```typescript
/**
 * 搜索用户已知事实
 * Agent 可用此工具查询数据库中存储的用户信息
 */
{
  name: "profile_memory_search",
  description: "Search known facts about the current user from persistent memory database",
  parameters: {
    query: { type: "string", description: "Search query" },
    category: { type: "string", enum: [...FactCategories], optional: true },
  },
  handler: async ({ query, category }) => {
    // 使用 UserFactRepository 查询
    // 记录审计日志 (action: "search_facts", source: "agent")
    // 返回匹配的事实列表
  }
}
```

#### profile_memory_save — 保存用户事实

```typescript
/**
 * 保存从对话中学到的用户事实
 * Agent 发现新信息时调用此工具记录到数据库
 */
{
  name: "profile_memory_save",
  description: "Save a new fact learned about the user to persistent memory",
  parameters: {
    category: { type: "string", enum: [...FactCategories] },
    key: { type: "string", description: "Fact key (e.g., 'name', 'timezone')" },
    value: { type: "string", description: "Fact value" },
    confidence: { type: "number", optional: true, default: 0.8 },
    source: { type: "string", optional: true, default: "conversation" },
  },
  handler: async ({ category, key, value, confidence, source }) => {
    // 使用 UserFactRepository.create() 写入
    // 记录审计日志 (action: "save_fact", source: "agent")
    // 返回创建结果
  }
}
```

#### profile_memory_update — 更新已有事实

```typescript
/**
 * 更新已有的用户事实
 * 当用户纠正信息或 Agent 获得更准确信息时使用
 */
{
  name: "profile_memory_update",
  description: "Update an existing user fact in persistent memory",
  parameters: {
    factId: { type: "string", description: "ID of the fact to update" },
    value: { type: "string", optional: true },
    confidence: { type: "number", optional: true },
  },
  handler: async ({ factId, value, confidence }) => {
    // 使用 UserFactRepository.update() 更新
    // 记录审计日志 (action: "update_fact", source: "agent")
    // 返回更新结果
  }
}
```

#### workspace_file_update — 更新 workspace 文件内容

```typescript
/**
 * 更新用户的 workspace 文件内容（SOUL.md 等）
 * 当用户请求修改 Agent 性格/身份时使用
 */
{
  name: "workspace_file_update",
  description: "Update a workspace file (e.g., SOUL.md, IDENTITY.md) for the current user",
  parameters: {
    fileName: {
      type: "string",
      enum: ["SOUL.md", "IDENTITY.md", "AGENTS.md", "TOOLS.md", "USER.md", "HEARTBEAT.md"],
    },
    content: { type: "string", description: "New file content" },
  },
  handler: async ({ fileName, content }) => {
    // 使用 UserWorkspaceFileRepository.upsert() 写入
    // 记录审计日志 (action: "update_workspace_file", source: "agent")
    // 返回更新结果
  }
}
```

### 2. 修改 `src/agents/system-prompt.ts` — buildMemorySection()

更新提示文本，引导 Agent 使用新工具：

```markdown
## Memory Recall

You have access to the user's persistent memory stored in a database.

- Use `profile_memory_search` to check known facts about the user
- Use `profile_memory_save` to remember new facts learned from conversation
- Use `profile_memory_update` to correct or update existing facts
- Use `workspace_file_update` to modify personality/identity settings (SOUL.md, etc.)
- Always check existing facts before saving duplicates
- Save facts with appropriate confidence levels (0.5-1.0)
```

### 3. 注册新工具到 Agent 工具列表

搜索 `createMemorySearchTool` 的注册位置并跟随注册新工具。

注册位置预计在 `src/agents/tools/` 目录的工具注册文件中。

## 验证

```bash
pnpm vitest run src/agents/tools/profile-memory-tool.test.ts
```

### 测试要点

**profile_memory_search：**

- 无参数搜索：返回所有事实
- 按 category 过滤：只返回匹配类别
- 按 query 搜索：模糊匹配 key/value
- 无结果时：返回空数组
- 审计日志：每次搜索记录一条 read 日志

**profile_memory_save：**

- 正常保存：写入数据库成功
- 重复 key：更新而非创建新记录
- 审计日志：记录 save_fact

**profile_memory_update：**

- factId 存在：更新成功
- factId 不存在：返回错误
- 部分更新：只更新提供的字段

**workspace_file_update：**

- 首次写入：创建用户自定义文件
- 再次写入：更新已有文件
- 无效文件名：拒绝写入
- 审计日志：记录 update_workspace_file

### 集成验证

```bash
# 启动 Gateway，发送消息测试工具调用
# 对话中说"记住我叫张三" → Agent 应调用 profile_memory_save
# 对话中说"我叫什么名字" → Agent 应调用 profile_memory_search
# 对话中说"修改你的性格为更幽默" → Agent 应调用 workspace_file_update
```
