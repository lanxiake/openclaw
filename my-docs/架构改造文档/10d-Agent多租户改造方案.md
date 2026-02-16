# 10d - Agent 多租户改造方案

> 版本: 1.0 | 创建日期: 2026-02-12 | 状态: 规划中
>
> 上级文档: [10-多租户架构改造总体方案.md](./10-多租户架构改造总体方案.md)
>
> 参考文档: [01-产品与架构设计.md](./01-产品与架构设计.md), [03-记忆与存储系统设计.md](./03-记忆与存储系统设计.md)

---

## 1. 现状分析

### 1.1 当前 Agent 运行时架构

```
用户消息 → Channel Handler → dispatchInboundMessage()
                                    ↓
                              resolveRoute() → agentId + sessionKey
                                    ↓
                              runEmbeddedPiAgent() → Pi RPC Agent
                                    ↓
                              subscribeEmbeddedPiSession() → 流式事件
                                    ↓
                              Tool 调用 → 设备控制 / 消息发送 / 浏览器操作
                                    ↓
                              deliverAgentCommandResult() → 回复消息
```

### 1.2 核心问题

| #   | 问题                          | 影响                           |
| --- | ----------------------------- | ------------------------------ |
| 1   | Session 无 userId 概念        | 无法区分不同用户的对话         |
| 2   | Session Key 基于 channel+peer | 多用户模式下 Key 不唯一        |
| 3   | 工具调用无设备权限校验        | 用户可能操作他人设备           |
| 4   | Agent 配置全局共享            | 无法为每个用户提供个性化助手   |
| 5   | 对话历史存文件系统            | 无用户隔离，不可扩展           |
| 6   | Auth Profile 全局单一         | 所有用户共享同一套 AI 模型凭据 |

### 1.3 关键代码位置

| 文件                                           | 用途               |
| ---------------------------------------------- | ------------------ |
| `src/routing/session-key.ts`                   | Session Key 编码   |
| `src/routing/resolve-route.ts`                 | 路由解析           |
| `src/config/sessions/store.ts`                 | Session 持久化     |
| `src/agents/pi-embedded-runner/run.ts`         | Agent 执行入口     |
| `src/agents/pi-embedded-subscribe.ts`          | 事件流订阅         |
| `src/agents/pi-embedded-subscribe.handlers.ts` | 工具调用处理       |
| `src/agents/identity.ts`                       | Agent 身份解析     |
| `src/agents/agent-scope.ts`                    | Agent 配置解析     |
| `src/auto-reply/dispatch.ts`                   | 消息分发入口       |
| `src/gateway/server-methods/chat.ts`           | WebSocket Chat RPC |

---

## 2. 改造方案

### 2.1 Session Key 增加 userId 维度

#### 现有格式

```
agent:{agentId}:{channel}:dm:{peerId}
agent:{agentId}:{channel}:{peerKind}:{id}
```

#### 新格式

```
user:{userId}:agent:{agentId}:{channel}:dm:{peerId}
user:{userId}:agent:{agentId}:{channel}:{peerKind}:{id}
```

**设计说明**：

- `userId` 作为 Session Key 的最高层级前缀
- 确保不同用户即使在同一 channel 与同一 peer 对话，也使用不同 Session
- 向后兼容：无 userId 的旧 Key 视为 "default" 用户（单用户模式）

#### 改造代码

```typescript
// src/routing/session-key.ts — 新增

/**
 * 构建带用户隔离的 Session Key
 *
 * @param userId - 用户 ID
 * @param agentId - Agent ID
 * @param channel - 消息渠道
 * @param peer - 对话对象
 */
export function buildUserSessionKey(params: {
  userId: string;
  agentId: string;
  channel: string;
  peer: string;
  chatType: "direct" | "group";
}): string {
  const { userId, agentId, channel, peer, chatType } = params;
  const peerPart = chatType === "direct" ? `dm:${peer}` : `group:${peer}`;
  return `user:${userId}:agent:${agentId}:${channel}:${peerPart}`;
}

/**
 * 从 Session Key 中提取 userId
 *
 * @returns userId 或 null（旧格式 Key 无 userId）
 */
export function extractUserIdFromSessionKey(sessionKey: string): string | null {
  const match = sessionKey.match(/^user:([^:]+):/);
  return match ? match[1] : null;
}
```

### 2.2 Session 持久化迁移

#### 现有方案

- 所有 Session 存储在全局文件 `~/.openclaw/sessions.json`
- 所有对话记录存在 `~/.openclaw/{sessionId}.jsonl`

#### 新方案

- Session 元数据 → PostgreSQL `conversations` 表
- 对话消息 → PostgreSQL `messages` 表
- 运行时 Session 缓存 → Redis（Phase 5，初期用内存 Map）

```typescript
/**
 * Session 存储接口抽象
 *
 * 初期使用内存 + PostgreSQL 实现，
 * Phase 5 引入 Redis 作为缓存层
 */
interface SessionStore {
  /** 获取 Session（先查缓存，miss 后查 DB） */
  get(sessionKey: string): Promise<SessionEntry | null>;

  /** 创建或更新 Session */
  set(sessionKey: string, entry: SessionEntry): Promise<void>;

  /** 删除 Session */
  delete(sessionKey: string): Promise<void>;

  /** 列出用户的所有 Session */
  listByUser(userId: string, options?: ListOptions): Promise<SessionEntry[]>;
}

/**
 * Session 条目增加 userId 字段
 */
interface SessionEntry {
  sessionId: string;
  userId: string; // 新增：所属用户
  agentId: string;
  channel?: string;
  chatType?: "direct" | "group";
  thinkingLevel?: string;
  modelOverride?: string;
  // ... 其他现有字段
}
```

### 2.3 Agent 运行时上下文注入

#### 新增 UserAgentContext

```typescript
// src/agents/user-context.ts — 新增

/**
 * 用户级 Agent 运行时上下文
 *
 * 在 Agent 执行的全生命周期中携带用户信息，
 * 用于工具权限校验、记忆读写、配额计费
 */
export interface UserAgentContext {
  /** 用户 ID */
  userId: string;

  /** 用户绑定的设备 ID 列表（工具权限校验用） */
  boundDeviceIds: string[];

  /** 用户的 AI 助手配置 */
  assistantConfig: AssistantConfig | null;

  /** 用户的当前配额状态 */
  quotaStatus: {
    tokensRemaining: number;
    storageRemaining: number;
  };

  /** 用户偏好 */
  preferences: {
    language?: string;
    timezone?: string;
    confirmationLevel?: string;
  };
}
```

#### 上下文传递链路

```
用户消息到达 Gateway
    ↓
extractUserContext(params) → { userId, deviceId }    [10a 方案]
    ↓
loadUserAgentContext(userId) → UserAgentContext        [新增]
    ↓
dispatchInboundMessage({ ..., userContext })           [注入上下文]
    ↓
runEmbeddedPiAgent({ ..., userContext })               [传递到 Agent]
    ↓
Tool 调用时校验 userContext.boundDeviceIds             [权限校验]
    ↓
AI 回复后写入 messages 表，userId 来自 userContext     [数据隔离]
```

#### 加载用户上下文

```typescript
// src/agents/user-context.ts

/**
 * 从数据库加载用户 Agent 上下文
 *
 * @param userId - 用户 ID
 * @returns 用户级 Agent 运行时上下文
 */
export async function loadUserAgentContext(userId: string): Promise<UserAgentContext> {
  // 并行查询用户相关数据
  const [devices, assistantConfig, quota] = await Promise.all([
    userDeviceRepo.findByUser(userId),
    assistantConfigRepo.findDefault(userId),
    usageQuotaRepo.findCurrent(userId, "tokens"),
  ]);

  return {
    userId,
    boundDeviceIds: devices.map((d) => d.deviceId),
    assistantConfig: assistantConfig ?? null,
    quotaStatus: {
      tokensRemaining: quota ? quota.limitValue - quota.usedValue : 0,
      storageRemaining: 0, // Phase 5 实现
    },
    preferences: {
      language: assistantConfig?.preferences?.language,
      timezone: assistantConfig?.preferences?.timezone,
      confirmationLevel: assistantConfig?.preferences?.confirmationLevel,
    },
  };
}
```

### 2.4 工具调用权限校验

#### 设备操作隔离

```typescript
// src/agents/tool-guard.ts — 新增

/**
 * 工具调用权限守卫
 *
 * 在执行设备操作类工具前，校验目标设备是否属于当前用户
 */
export function validateToolAccess(params: {
  toolName: string;
  toolInput: Record<string, unknown>;
  userContext: UserAgentContext;
}): { allowed: boolean; reason?: string } {
  const { toolName, toolInput, userContext } = params;

  // 设备操作类工具需要校验设备归属
  if (isDeviceOperationTool(toolName)) {
    const targetDeviceId = toolInput.deviceId as string;
    if (!targetDeviceId) {
      return { allowed: false, reason: "缺少目标设备 ID" };
    }
    if (!userContext.boundDeviceIds.includes(targetDeviceId)) {
      return { allowed: false, reason: "无权操作此设备" };
    }
  }

  // 文件操作类工具需要校验路径权限
  if (isFileOperationTool(toolName)) {
    const targetPath = toolInput.path as string;
    if (!isPathAllowed(targetPath, userContext)) {
      return { allowed: false, reason: "无权访问此路径" };
    }
  }

  return { allowed: true };
}

/**
 * 判断是否为设备操作类工具
 */
function isDeviceOperationTool(toolName: string): boolean {
  const deviceTools = [
    "exec", // 远程命令执行
    "process", // 进程管理
    "file_read", // 远程文件读取
    "file_write", // 远程文件写入
    "screenshot", // 截图
    "clipboard", // 剪贴板
  ];
  return deviceTools.includes(toolName);
}
```

### 2.5 系统提示个性化

#### 注入用户助手配置

```typescript
// src/agents/identity.ts — 改造

/**
 * 构建个性化系统提示
 *
 * 在原有 Agent 系统提示的基础上，注入用户的个性化配置
 */
export function buildPersonalizedSystemPrompt(params: {
  basePrompt: string;
  userContext: UserAgentContext;
}): string {
  const { basePrompt, userContext } = params;
  const config = userContext.assistantConfig;

  if (!config) return basePrompt;

  const personalityParts: string[] = [];

  // 语气风格
  if (config.personality?.tone) {
    personalityParts.push(`Communication style: ${config.personality.tone}`);
  }

  // 详细程度
  if (config.personality?.verbosity) {
    personalityParts.push(`Response verbosity: ${config.personality.verbosity}`);
  }

  // 自定义角色描述
  if (config.personality?.roleDescription) {
    personalityParts.push(`Role: ${config.personality.roleDescription}`);
  }

  // 语言偏好
  if (userContext.preferences.language) {
    personalityParts.push(`Preferred language: ${userContext.preferences.language}`);
  }

  // 自定义系统提示
  if (config.systemPrompt) {
    personalityParts.push(`\n${config.systemPrompt}`);
  }

  if (personalityParts.length === 0) return basePrompt;

  return `${basePrompt}\n\n## User Preferences\n${personalityParts.join("\n")}`;
}
```

### 2.6 对话记忆写入数据库

#### 现有方案

- 对话记录写入文件 `~/.openclaw/{sessionId}.jsonl`

#### 新方案

- 对话消息实时写入 PostgreSQL `messages` 表
- Token 消耗记录到 `usage_quotas` 表
- AI 提取的记忆写入 `user_memories` 表

```typescript
// src/agents/message-persistence.ts — 新增

/**
 * 消息持久化服务
 *
 * 在 Agent 事件流中捕获消息，写入数据库
 */
export class MessagePersistenceService {
  /**
   * 持久化用户消息
   */
  async persistUserMessage(params: {
    conversationId: string;
    userId: string;
    content: string;
    attachments?: Attachment[];
  }): Promise<string> {
    const messageId = generateUUID();
    await messageRepo.create({
      id: messageId,
      conversationId: params.conversationId,
      userId: params.userId,
      role: "user",
      content: params.content,
      contentType: "text",
      attachments: params.attachments ?? null,
      createdAt: new Date(),
    });
    return messageId;
  }

  /**
   * 持久化 AI 回复消息
   */
  async persistAssistantMessage(params: {
    conversationId: string;
    userId: string;
    content: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    tokenCount?: number;
    modelId?: string;
  }): Promise<string> {
    const messageId = generateUUID();
    await messageRepo.create({
      id: messageId,
      conversationId: params.conversationId,
      userId: params.userId,
      role: "assistant",
      content: params.content,
      contentType: "markdown",
      toolCalls: params.toolCalls ?? null,
      toolResults: params.toolResults ?? null,
      tokenCount: params.tokenCount ?? null,
      modelId: params.modelId ?? null,
      createdAt: new Date(),
    });

    // 更新对话的 lastMessageAt 和 messageCount
    await conversationRepo.updateMessageStats(params.conversationId);

    // 更新用户 Token 配额
    if (params.tokenCount) {
      await usageQuotaRepo.incrementUsage(params.userId, "tokens", params.tokenCount);
    }

    return messageId;
  }
}
```

### 2.7 配额计费

#### 计费点

| 计费点      | 触发时机          | 计费项              |
| ----------- | ----------------- | ------------------- |
| AI 模型调用 | Agent 回复消息    | tokens（输入+输出） |
| 文件上传    | 用户上传附件/文档 | storage（字节数）   |
| 设备绑定    | 用户添加新设备    | devices（数量）     |
| 技能创建    | 用户创建自建技能  | skills（数量）      |

#### 配额检查流程

```
用户发送消息
    ↓
Gateway 收到 chat.send
    ↓
loadUserAgentContext(userId) → quotaStatus
    ↓
if (quotaStatus.tokensRemaining <= 0) {
    respond(false, error: '月度 Token 配额已用尽')
    return
}
    ↓
runEmbeddedPiAgent()
    ↓
AI 回复后 → persistAssistantMessage() → incrementUsage()
```

---

## 3. 改造范围

### 3.1 需要修改的文件

| 文件                                           | 改造内容                      | 优先级 |
| ---------------------------------------------- | ----------------------------- | ------ |
| `src/routing/session-key.ts`                   | 新增 userId 维度 Key 构建函数 | P0     |
| `src/gateway/server-methods/chat.ts`           | 注入 UserAgentContext         | P0     |
| `src/auto-reply/dispatch.ts`                   | 传递 userContext 到 Agent     | P0     |
| `src/agents/pi-embedded-runner/run.ts`         | 接收并使用 userContext        | P0     |
| `src/agents/pi-embedded-subscribe.handlers.ts` | 工具调用前权限校验            | P0     |
| `src/agents/identity.ts`                       | 注入个性化系统提示            | P1     |
| `src/config/sessions/store.ts`                 | Session 持久化改用数据库      | P1     |

### 3.2 需要新增的文件

| 文件                                | 内容                        |
| ----------------------------------- | --------------------------- |
| `src/agents/user-context.ts`        | UserAgentContext 定义与加载 |
| `src/agents/tool-guard.ts`          | 工具调用权限守卫            |
| `src/agents/message-persistence.ts` | 消息持久化服务              |

---

## 4. 实施步骤

### Step 1: 新增 UserAgentContext

- 创建 `src/agents/user-context.ts`
- 定义 `UserAgentContext` 接口
- 实现 `loadUserAgentContext()` 函数
- 单元测试验证上下文加载

### Step 2: Session Key 改造

- 扩展 `src/routing/session-key.ts` 增加用户维度 Key 函数
- 向后兼容：旧格式 Key 解析为 userId = null
- 单元测试验证 Key 编码/解码

### Step 3: Chat RPC 注入上下文

- 修改 `chat.send` 处理器，调用 `extractUserContext()` + `loadUserAgentContext()`
- 通过 `dispatchInboundMessage()` 传递 userContext
- 集成测试验证用户上下文传递

### Step 4: 工具权限校验

- 创建 `src/agents/tool-guard.ts`
- 在 `pi-embedded-subscribe.handlers.ts` 工具调用前插入权限检查
- 集成测试验证设备操作隔离

### Step 5: 系统提示个性化

- 修改 `src/agents/identity.ts` 注入用户配置
- 测试不同用户配置生成不同系统提示

### Step 6: 消息持久化

- 创建 `src/agents/message-persistence.ts`
- 在 Agent 事件流中集成消息写入
- 集成测试验证消息入库

### Step 7: 配额计费

- 在 `chat.send` 前置配额检查
- 在消息持久化后更新配额使用量
- 集成测试验证配额扣减

---

## 5. 迁移兼容性

### 5.1 单用户模式兼容

改造后仍支持单用户模式（无用户认证场景）：

```typescript
/**
 * 获取用户上下文，兼容单用户模式
 *
 * 多用户模式：从 JWT Token 提取 userId
 * 单用户模式：使用默认 userId "default"
 */
function getOrDefaultUserContext(params: Record<string, unknown>): UserAgentContext {
  try {
    const ctx = extractUserContext(params);
    return loadUserAgentContext(ctx.userId);
  } catch {
    // 单用户模式回退
    return {
      userId: "default",
      boundDeviceIds: [], // 不限制设备
      assistantConfig: null,
      quotaStatus: { tokensRemaining: Infinity, storageRemaining: Infinity },
      preferences: {},
    };
  }
}
```

### 5.2 文件 → 数据库迁移工具

```typescript
/**
 * 将现有文件 Session 迁移到数据库
 *
 * 读取 ~/.openclaw/sessions.json 和 *.jsonl 文件，
 * 写入 conversations + messages 表
 */
async function migrateFileSessions(userId: string): Promise<void> {
  // 1. 读取 sessions.json
  const sessions = loadSessionStore();

  for (const [sessionKey, entry] of Object.entries(sessions)) {
    // 2. 创建 conversation 记录
    const conversationId = await conversationRepo.create({
      userId,
      title: entry.title ?? "Untitled",
      type: "chat",
      status: "active",
    });

    // 3. 读取 JSONL 对话记录
    const transcript = readTranscript(entry.sessionId);
    for (const message of transcript) {
      await messageRepo.create({
        conversationId,
        userId,
        role: message.role,
        content: message.content,
        createdAt: new Date(message.timestamp),
      });
    }
  }
}
```

---

## 6. 验收标准

| #   | 标准                                      | 验证方式 |
| --- | ----------------------------------------- | -------- |
| 1   | Session Key 包含 userId，不同用户会话独立 | 单元测试 |
| 2   | Agent 运行时携带 UserAgentContext         | 集成测试 |
| 3   | 用户 A 无法通过 Agent 操作用户 B 的设备   | 集成测试 |
| 4   | 系统提示根据用户配置个性化                | 集成测试 |
| 5   | 对话消息持久化到 PostgreSQL               | 集成测试 |
| 6   | Token 消耗正确计入用户配额                | 集成测试 |
| 7   | 单用户模式向后兼容                        | 回归测试 |
| 8   | 现有 Gateway 功能不受影响                 | 回归测试 |

---

_— 文档结束 —_
