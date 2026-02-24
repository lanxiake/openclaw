# 阶段三：用户上下文扩展 — 加载数据库中的 workspace 文件和 profile memory

## 目标

`loadUserAgentContext()` 并行加载用户的 workspace 文件 + profile memory 数据。

## 文件改动

### 1. 修改 `src/agents/user-context.ts`

#### 扩展 UserAgentContext 接口

```typescript
export interface UserAgentContext {
  // ... 现有字段 ...

  /** 用户 workspace 文件（从数据库加载，替代文件系统） */
  workspaceFiles?: Map<string, string>; // fileName → content

  /** 用户画像数据 */
  profileMemory?: {
    facts: UserFact[];
    preferences: UserPreferences;
    patterns: BehaviorPattern[];
  };
}
```

#### 新增加载函数

```typescript
/**
 * 从数据库加载用户的有效 workspace 文件
 * 对每个标准文件名调用 UserWorkspaceFileRepository.getEffectiveFile()
 */
async function loadUserWorkspaceFiles(userId: string): Promise<Map<string, string>>;

/**
 * 从数据库加载用户的 profile memory 数据
 * 使用 profile-memory repository 并行加载 facts/preferences/patterns
 */
async function loadProfileMemory(userId: string): Promise<UserAgentContext["profileMemory"]>;
```

#### 修改 loadUserAgentContext()

在现有的 `Promise.all` 中增加两个新加载：

```typescript
const [assistantConfig, devices, quotas, workspaceFiles, profileMemory] = await Promise.all([
  loadAssistantConfig(normalizedUserId),
  loadUserDevices(normalizedUserId),
  loadUserQuotas(normalizedUserId),
  loadUserWorkspaceFiles(normalizedUserId), // 新增
  loadProfileMemory(normalizedUserId), // 新增
]);
```

### 关键复用

| 模块                               | 来源                                    | 用途                    |
| ---------------------------------- | --------------------------------------- | ----------------------- |
| `UserWorkspaceFileRepository`      | 阶段一新建                              | 获取有效 workspace 文件 |
| `getUserFactRepository()`          | `src/db/repositories/profile-memory.ts` | 加载用户事实            |
| `getUserPreferencesV2Repository()` | `src/db/repositories/profile-memory.ts` | 加载用户偏好            |
| `getBehaviorPatternRepository()`   | `src/db/repositories/profile-memory.ts` | 加载行为模式            |

### 错误处理策略

- 数据库不可用时：`workspaceFiles` 和 `profileMemory` 设为 `undefined`（不阻塞 Agent 启动）
- 单个加载失败：catch 并 log warning，继续其他加载
- 这些字段为 optional，下游代码需判断是否存在

## 验证

```bash
pnpm vitest run src/agents/user-context.test.ts
```

### 测试要点

- 用户有自定义 workspace 文件时：`workspaceFiles` 包含自定义内容
- 用户无自定义时：`workspaceFiles` 包含系统默认模板内容
- 用户有 profile memory 数据时：正确加载 facts/preferences/patterns
- 用户无 profile memory 数据时：返回空数组/默认值
- 数据库连接失败时：不抛异常，字段为 undefined
- 加载性能：5 个并行查询不应阻塞（<500ms）
