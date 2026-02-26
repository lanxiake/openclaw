# 阶段四：Agent 启动链路改造 — 数据库优先，文件 fallback

## 目标

修改 `resolveBootstrapContextForRun()` 链路，当用户上下文中有数据库 workspace 文件时，使用数据库数据替代磁盘文件。

## 核心改造逻辑

### 当前链路

```
loadWorkspaceBootstrapFiles(dir) → 从磁盘读 → WorkspaceBootstrapFile[]
```

### 改造后

```
getUserContext()?.workspaceFiles  → 有数据库数据？
  ├─ 有：将 Map<string, string> 转为 WorkspaceBootstrapFile[] （跳过磁盘读取）
  └─ 无：fallback 到 loadWorkspaceBootstrapFiles(dir) （保持现有逻辑）
```

## 文件改动

### 1. 修改 `src/agents/bootstrap-files.ts`

#### 新增 buildBootstrapFilesFromDatabase()

```typescript
/**
 * 将数据库中的 workspace 文件转换为 WorkspaceBootstrapFile 格式
 * 使得下游代码无需感知数据来源（文件系统 vs 数据库）
 */
function buildBootstrapFilesFromDatabase(
  workspaceFiles: Map<string, string>,
): WorkspaceBootstrapFile[] {
  const standardFiles: WorkspaceBootstrapFileName[] = [
    "AGENTS.md",
    "SOUL.md",
    "TOOLS.md",
    "IDENTITY.md",
    "USER.md",
    "HEARTBEAT.md",
  ];
  return standardFiles.map((name) => ({
    name,
    path: `[database]/${name}`, // 标记来源为数据库
    content: workspaceFiles.get(name),
    missing: !workspaceFiles.has(name),
  }));
}
```

#### 修改 resolveBootstrapFilesForRun()

```typescript
export async function resolveBootstrapFilesForRun(params: {
  workspaceDir: string;
  config?: MtBotConfig;
  sessionKey?: string;
  sessionId?: string;
  agentId?: string;
}): Promise<WorkspaceBootstrapFile[]> {
  const sessionKey = params.sessionKey ?? params.sessionId;

  // 数据库优先：从用户上下文获取 workspace 文件
  const userContext = getUserContext();
  let bootstrapFiles: WorkspaceBootstrapFile[];

  if (userContext?.workspaceFiles && userContext.workspaceFiles.size > 0) {
    logger.debug("Loading workspace files from database");
    bootstrapFiles = buildBootstrapFilesFromDatabase(userContext.workspaceFiles);
  } else {
    // Fallback：从文件系统加载（向后兼容，CLI 模式等）
    logger.debug("Loading workspace files from filesystem (fallback)");
    bootstrapFiles = await loadWorkspaceBootstrapFiles(params.workspaceDir);
  }

  const filtered = filterBootstrapFilesForSession(bootstrapFiles, sessionKey);
  return applyBootstrapHookOverrides({ files: filtered, ...params });
}
```

### 2. 修改 `src/agents/system-prompt.ts`

#### 新增 buildProfileMemorySection()

```typescript
/**
 * 构建 Profile Memory 注入到系统提示的内容
 * 包含用户事实、偏好、已确认的行为模式
 */
function buildProfileMemorySection(profileMemory?: UserAgentContext["profileMemory"]): string[] {
  if (!profileMemory) return [];

  const lines: string[] = ["## User Memory (from database)"];

  // 注入用户事实 (top 20, 按 confidence 降序)
  if (profileMemory.facts.length > 0) {
    lines.push("### Known Facts");
    const sorted = [...profileMemory.facts].sort((a, b) => b.confidence - a.confidence);
    for (const fact of sorted.slice(0, 20)) {
      lines.push(`- [${fact.category}] ${fact.key}: ${fact.value}`);
    }
  }

  // 注入用户偏好
  if (profileMemory.preferences) {
    lines.push("### Preferences");
    lines.push(`- Language: ${profileMemory.preferences.language}`);
    lines.push(`- Response style: ${profileMemory.preferences.responseStyle}`);
    // ... 其他偏好字段
  }

  // 注入已确认的行为模式
  const confirmed = profileMemory.patterns.filter((p) => p.confirmed);
  if (confirmed.length > 0) {
    lines.push("### Confirmed Behavior Patterns");
    for (const p of confirmed) {
      lines.push(`- [${p.type}] ${p.pattern}`);
    }
  }

  lines.push("");
  return lines;
}
```

#### 修改 buildAgentSystemPrompt()

在 contextFiles 之后、userPersonalization 之前注入 profileMemory section：

```typescript
// 新增参数
export function buildAgentSystemPrompt(params: {
  // ... 现有参数 ...
  profileMemory?: UserAgentContext["profileMemory"]; // 新增
}): string {
  // ...
  // 在 contextFiles 注入之后
  const memorySection = buildProfileMemorySection(params.profileMemory);
  lines.push(...memorySection);
  // 在 userPersonalization 之前
  // ...
}
```

### 3. 修改 `src/agents/pi-embedded-runner/system-prompt.ts`

`buildEmbeddedSystemPrompt()` 参数增加 `profileMemory`，透传给 `buildAgentSystemPrompt()`：

```typescript
export function buildEmbeddedSystemPrompt(params: {
  // ... 现有参数 ...
  profileMemory?: UserAgentContext["profileMemory"]; // 新增
}): string {
  return buildAgentSystemPrompt({
    // ... 现有传参 ...
    profileMemory: params.profileMemory, // 新增透传
  });
}
```

### 4. 修改 `src/agents/pi-embedded-runner/run/attempt.ts`

在 L349-351 区域扩展：

```typescript
const userContext = getUserContext();
const userPersonalization = userContext?.assistantConfig;
const profileMemory = userContext?.profileMemory; // 新增

// 传递给 buildEmbeddedSystemPrompt()
const systemPrompt = buildEmbeddedSystemPrompt({
  // ... 现有参数 ...
  profileMemory, // 新增
});
```

### 5. 修改 `src/agents/pi-embedded-runner/compact.ts`

同样的改造，compact 时也使用数据库数据：

```typescript
const userContext = getUserContext();
const profileMemory = userContext?.profileMemory;

const systemPrompt = buildEmbeddedSystemPrompt({
  // ... 现有参数 ...
  profileMemory,
});
```

### 6. 修改 `src/agents/cli-runner.ts`

CLI runner 也需要同样的改造（如果有用户上下文的话）。

## 验证

```bash
pnpm vitest run src/agents/bootstrap-files.test.ts
pnpm vitest run src/agents/system-prompt.test.ts
```

### 测试要点

**bootstrap-files.ts：**

- 有数据库 workspace 文件时：使用数据库数据，不读磁盘
- 无数据库数据时：fallback 到文件系统读取
- buildBootstrapFilesFromDatabase：正确映射 Map → WorkspaceBootstrapFile[]
- 子 agent 过滤：数据库来源的文件也正确过滤（只保留 AGENTS.md + TOOLS.md）

**system-prompt.ts：**

- profileMemory 存在时：系统提示包含 User Memory section
- profileMemory 为空时：不注入额外内容
- facts 按 confidence 降序排列，最多 20 条
- 只注入 confirmed 的行为模式

### 集成验证

```bash
# 启动 Gateway，发送消息，验证 Agent 系统提示包含数据库数据
pnpm gateway:dev
# 在日志中搜索 "Loading workspace files from database"
```
