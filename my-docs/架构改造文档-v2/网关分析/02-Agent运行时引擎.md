# Agent 运行时引擎

> 文档版本：v1.0 | 更新日期：2026-02-22
>
> 本文档详细分析 OpenClaw Agent 运行时引擎的核心执行链路、模型选择、错误恢复和会话管理。

---

## 1. 核心执行链路

从消息入站到回复输出的完整调用栈：

```
消息入站
│
└→ getReplyFromConfig(ctx)               ← src/auto-reply/reply/get-reply.ts (200+ 行)
   │
   ├─ 配置加载 & 模型确定
   ├─ 工作区初始化 & 同步
   ├─ 消息理解（媒体 / 链接 / 权限）
   ├─ Session 状态管理
   ├─ 指令解析 & 应用
   │
   └→ runAgentTurnWithFallback()         ← agent-runner-execution.ts (581 行)
      │
      └→ runWithModelFallback()          ← model-fallback.ts (120+ 行)
         │
         └→ runEmbeddedPiAgent()         ← pi-embedded-runner/run.ts (740 行)
            │
            ├─ 模型解析 (resolveModel)
            ├─ Auth Profile 加载
            ├─ Profile 选择 & 轮转
            │
            └→ runEmbeddedAttempt()      ← run/attempt.ts (917 行)
               │
               ├─ Skills 加载
               ├─ Sandbox 初始化
               ├─ 系统提示构建
               ├─ 工具集构建 & 过滤
               ├─ Session 加载 / 创建
               ├─ streamSimple() 流式执行
               ├─ 工具调用 & 结果处理
               └─ 错误分类 & 恢复
```

---

## 2. 消息回复管道 (`get-reply.ts`)

### 2.1 处理步骤

```
getReplyFromConfig(ctx, opts, configOverride?)
│
├─ ① 配置加载
│     加载配置 → 解析 session key → 确定 agent ID
│
├─ ② 模型确定
│     resolveDefaultModel()
│     heartbeat 使用专用 heartbeat model
│     → { provider, model, aliasIndex }
│
├─ ③ 工作区初始化
│     resolveAgentWorkspaceDir()
│     ensureAgentWorkspace()
│     → 工作区目录和类型
│
├─ ④ 消息理解
│     finializeInboundContext()
│     ├─ applyMediaUnderstanding()      图片 / 音频 / 视频分析
│     ├─ applyLinkUnderstanding()       链接预览提取
│     └─ resolveCommandAuthorization()  权限检查
│
├─ ⑤ Session 状态管理
│     initSessionState()
│     ├─ 加载或创建 session
│     ├─ 追踪 previous session
│     └─ 初始化消息历史
│
├─ ⑥ 指令解析
│     resolveReplyDirectives()
│     parseReplyDirectives()
│     应用前置指令（model override 等）
│
├─ ⑦ 主回复生成
│     runPreparedReply() → runAgentTurnWithFallback()
│
└─ ⑧ 后置处理
      处理内联动作 → 应用回复标签 → 返回最终 payload
```

### 2.2 输入输出类型

```typescript
// 输入上下文
type MsgContext = {
  SessionKey: string;
  Content?: string;
  Images?: ImageData[];
  CommandAuthorized: boolean;
  // ... 消息元数据
};

// 执行配置
type GetReplyOptions = {
  isHeartbeat?: boolean;
  runId?: string;
  onReplyStart?: () => void;
  onToolResult?: (payload) => void;
  onAgentRunStart?: (runId) => void;
  onReasoningStream?: (payload) => void;
};

// 输出结果
type ReplyPayload = {
  text?: string;
  mediaUrls?: string[];
  audioAsVoice?: boolean;
  replyToId?: string;
  replyToTag?: boolean;
  replyToCurrent?: boolean;
};
```

---

## 3. Agent 执行引擎 (`runEmbeddedPiAgent`)

### 3.1 参数定义

**文件**: `src/agents/pi-embedded-runner/run/params.ts` (100 行)

```typescript
type RunEmbeddedPiAgentParams = {
  // ── 会话标识 ──
  sessionId: string;
  sessionKey?: string;

  // ── 消息上下文 ──
  messageChannel?: string; // "telegram" / "discord" / ...
  messageProvider?: string;
  messageTo?: string;
  messageThreadId?: string | number;
  groupId?: string | null;
  groupChannel?: string | null;

  // ── 工作区 ──
  sessionFile: string;
  workspaceDir: string;
  agentDir?: string;

  // ── 模型与认证 ──
  provider?: string; // "anthropic" / "openai" / ...
  model?: string; // "claude-opus-4-5" / "gpt-4o" / ...
  authProfileId?: string;
  authProfileIdSource?: "auto" | "user";
  config?: OpenClawConfig;

  // ── 工具与技能 ──
  skillsSnapshot?: SkillSnapshot;
  disableTools?: boolean;
  clientTools?: ClientToolDefinition[];

  // ── 执行控制 ──
  prompt: string; // 用户消息内容
  images?: ImageContent[];
  timeoutMs: number;
  runId: string;
  abortSignal?: AbortSignal;

  // ── 思考与推理 ──
  thinkLevel?: ThinkLevel;
  verboseLevel?: VerboseLevel;
  reasoningLevel?: ReasoningLevel;

  // ── 回调 ──
  onPartialReply?: (payload) => void | Promise<void>;
  onBlockReply?: (payload) => void | Promise<void>;
  onToolResult?: (payload) => void | Promise<void>;
  onAgentEvent?: (evt) => void;
};
```

### 3.2 执行状态时序

```
Time │ 状态              │ 主要操作
─────┼───────────────────┼──────────────────────────────────
  0  │ INIT              │ 加载参数、config、模型
  1  │ AUTH_LOAD          │ 加载 file store + DB store（三级优先）
  2  │ PROFILE_SELECT     │ 选择可用 auth profile
  3  │ ENV_SETUP          │ 初始化工作区、skills、sandbox
  4  │ SESSION_LOAD       │ 创建/加载 session
  5  │ SESSION_STREAM     │ 流式执行，处理工具调用
  6  │ RESULT_COLLECT     │ 收集消息和元数据
  7  │ ERROR_CLASSIFY     │ 分类错误（如果有）
  8  │ RETRY/FALLBACK     │ 决定重试或回退
  9  │ SESSION_PERSIST    │ 持久化 session
 10  │ SUCCESS/FAILURE    │ 返回结果
```

---

## 4. 单次尝试执行 (`runEmbeddedAttempt`)

**文件**: `src/agents/pi-embedded-runner/run/attempt.ts` (917 行)

### 4.1 执行步骤

```
runEmbeddedAttempt(params)
│
├─ ① 初始化
│     创建 AbortController（超时/取消）
│     预热 session 文件
│     获取 session 写锁（防并发）
│
├─ ② 环境配置
│     加载 skills（bundled + workspace）
│     应用 skill env overrides
│     加载 sandbox 上下文（Docker 隔离，如启用）
│     构建系统提示
│
├─ ③ 工具配置
│     创建 OpenClaw 工具集
│     根据 sandbox policy 过滤工具
│     应用 client tools（OpenResponses 集成）
│
├─ ④ Session 初始化
│     创建 AgentSession（来自 pi-coding-agent）
│     设置 SessionManager 和 SettingsManager
│     加载历史消息（DM 限制 20-30 条）
│
├─ ⑤ 流式执行
│     调用 pi-ai 的 streamSimple()
│     处理工具调用和结果
│     发出 onPartialReply / onBlockReply 回调
│
└─ ⑥ 结果处理
      收集助手消息 → 追踪工具元数据
      → 发出 onToolResult 回调 → 返回结果
```

### 4.2 块回复管道（Block Reply Pipeline）

块回复用于实时推送消息到多个频道（Telegram / Slack / Discord 等）。

```typescript
// 配置参数
{
  blockReplyPipeline: BlockReplyPipeline | null
  blockStreamingEnabled: boolean
  blockReplyChunking?: {
    minChars: number
    maxChars: number
    breakPreference: "paragraph" | "newline" | "sentence"
  }
  resolvedBlockStreamingBreak: "text_end" | "message_end"
}
```

**特性**: 流式处理响应、分块发送（避免超大消息）、内联操作（编辑/删除/反应）、跨频道一致性。

---

## 5. 模型选择机制

### 5.1 模型解析

**文件**: `src/agents/pi-embedded-runner/model.ts` (128 行)

```typescript
resolveModel(provider, modelId, agentDir?, cfg?)
  → { model?, error?, authStorage, modelRegistry }
```

**解析逻辑**:

1. `discoverModels()` — 从 `~/.openclaw/models.json` 读取注册模型
2. 回退到内联配置 (`cfg.models.providers`)
3. 别名规范化（如 `opus-4.5` → `claude-opus-4-5`）
4. 支持自定义模型定义（开源/小模型）

### 5.2 模型选择主逻辑

**文件**: `src/agents/model-selection.ts` (440 行)

```typescript
// 规范化 provider ID
normalizeProviderId("z.ai")         → "zai"
normalizeProviderId("qwen")         → "qwen-portal"

// 解析模型引用
parseModelRef("anthropic/claude-opus-4-5", "anthropic")
  → { provider: "anthropic", model: "claude-opus-4-5" }

// 构建别名索引
buildModelAliasIndex({ cfg, defaultProvider })
  → ModelAliasIndex  // 用于快速查找

// 解析允许的模型集合（访问控制）
buildAllowedModelSet({ cfg, catalog, defaultProvider })
  → { allowAny: boolean, allowedKeys: Set<string> }
```

### 5.3 模型回退系统

**文件**: `src/agents/model-fallback.ts` (120+ 行)

```typescript
// 配置示例
agents.defaults.model.fallbacks: [
  "anthropic/claude-opus-4-5",   // 首选
  "openai/gpt-4o",              // 回退 1
  "google/gemini-2.0-flash"     // 回退 2
]
```

**执行流程**:

1. 尝试主模型
2. 返回 `FailoverError` → 尝试 fallback 列表下一个
3. 轮转 provider + model，直到成功或列表耗尽

### 5.4 Context Window 管理

**文件**: `src/agents/context-window-guard.ts`

```typescript
// 常量
DEFAULT_CONTEXT_TOKENS              = 32_000   // 保守估计
CONTEXT_WINDOW_WARN_BELOW_TOKENS    = 15_000   // 警告阈值
CONTEXT_WINDOW_HARD_MIN_TOKENS      =  2_000   // 硬下限

// 核心函数
resolveContextWindowInfo(params)     → ContextWindowInfo
evaluateContextWindowGuard(params)   → { shouldWarn, shouldBlock, tokens, source }
```

---

## 6. 错误恢复策略

### 6.1 错误分类与处理

| 错误类型             | 检测方式                 | 恢复策略                                |
| -------------------- | ------------------------ | --------------------------------------- |
| **Context Overflow** | 正则 `"context window"`  | 自动压缩 session → 重试                 |
| **Auth Error**       | HTTP 401                 | 标记 profile 失败 → Profile 轮转 → 重试 |
| **Rate Limit**       | HTTP 429 + 超时          | 标记冷却期 → Profile 轮转               |
| **Timeout**          | 经过时间 > `timeoutMs`   | Profile 轮转 → 标记 timeout             |
| **Compaction Fail**  | `"summarization failed"` | 重置 session → 返回错误消息             |
| **Role Ordering**    | `"incorrect role"`       | 重置 session → 返回错误消息             |
| **Image Size**       | 解析 `"max=XXmb"`        | 返回用户友好消息，建议压缩              |
| **Image Dimension**  | `"max_dimension_px"`     | 标记 profile → 可能轮转                 |

### 6.2 冷却期计算（指数退避）

```
公式: min(60 分钟, 60 秒 × 5^(errorCount - 1))

错误次数 │ 冷却时间
─────────┼──────────
    1    │    60 秒
    2    │   300 秒   (5 分钟)
    3    │  1500 秒   (25 分钟)
    4    │  3600 秒   (60 分钟，上限)
```

---

## 7. Sandbox 隔离系统

**文件**: `src/agents/sandbox/context.ts`

### 7.1 作用域模式

| 模式      | 说明                      |
| --------- | ------------------------- |
| `shared`  | 所有 session 共用一个容器 |
| `agent`   | 每个 agent 独立容器       |
| `session` | 每个 session 独立容器     |

### 7.2 Docker 配置

```typescript
type SandboxDockerConfig = {
  image: string; // Docker 镜像
  containerPrefix: string; // 容器名前缀
  workdir: string; // 工作目录
  readOnlyRoot: boolean; // 只读根文件系统
  tmpfs: string[]; // 临时文件系统
  network: "none" | "bridge"; // 网络隔离级别
  capDrop: string[]; // 删除的 Linux Capabilities
  pidsLimit?: number; // 进程数限制
  memory?: string; // 内存限制
  cpus?: string; // CPU 限制
  seccompProfile?: string;
  apparmorProfile?: string;
};
```

---

## 8. Skills 系统

### 8.1 技能类型

| 来源      | 标识                      | 说明                             |
| --------- | ------------------------- | -------------------------------- |
| Bundled   | `openclaw-bundled`        | 内置技能                         |
| Workspace | `openclaw-workspace`      | 用户定义 (`~/.openclaw/skills/`) |
| Plugin    | `extension-id:skill-name` | 插件贡献                         |

### 8.2 技能元数据

```typescript
type OpenClawSkillMetadata = {
  always?: boolean; // 是否始终注入
  skillKey?: string; // 技能唯一键
  primaryEnv?: string; // 主要环境变量
  emoji?: string; // 显示图标
  os?: string[]; // 支持的操作系统
  requires?: {
    bins?: string[]; // 依赖的二进制
    anyBins?: string[]; // 至少需要一个
    env?: string[]; // 环境变量
    config?: string[]; // 配置项
  };
  install?: SkillInstallSpec[]; // 自动安装规则
};
```

---

## 9. 工作目录结构

```
~/.openclaw/
├─ auth.json                       AuthStorage (pi-ai 认证)
├─ models.json                     ModelRegistry (模型注册表)
├─ auth-profiles.json             AuthProfileStore (OpenClaw 认证 profile)
├─ config.yaml                     主配置文件
│
├─ workspace/
│  ├─ bootstrap.txt               启动脚本
│  ├─ skills/                     用户技能目录
│  └─ session/
│     └─ <session-id>.json        Session 快照
│
├─ sandbox/
│  ├─ shared/                     共享 sandbox 工作区
│  └─ <scope-key>/                Agent/Session 特定工作区
│
└─ plugins/                       用户安装的插件
```

---

## 10. 关键依赖项

```
@mariozechner/pi-ai
├─ streamSimple()                  流式执行
├─ Model<Api>                      模型定义
└─ AuthStorage                     认证存储

@mariozechner/pi-coding-agent
├─ createAgentSession()            Session 创建
├─ SessionManager                  Session 管理
├─ Skill                           技能定义
└─ DefaultResourceLoader           资源加载

@mariozechner/pi-agent-core
├─ AgentTool                       工具定义
└─ AgentMessage                    消息类型
```

---

## 11. 关键文件索引

| 文件路径                                         | 行数 | 核心职责                              |
| ------------------------------------------------ | ---- | ------------------------------------- |
| `src/agents/pi-embedded-runner/run.ts`           | 740  | Agent 执行入口 (`runEmbeddedPiAgent`) |
| `src/agents/pi-embedded-runner/run/attempt.ts`   | 917  | 单次尝试执行 (`runEmbeddedAttempt`)   |
| `src/agents/pi-embedded-runner/run/params.ts`    | 100  | 参数类型定义                          |
| `src/agents/pi-embedded-runner/model.ts`         | 128  | 模型解析 (`resolveModel`)             |
| `src/agents/pi-embedded-runner/system-prompt.ts` | 86   | 系统提示构建                          |
| `src/agents/model-selection.ts`                  | 440  | 模型选择、别名、规范化                |
| `src/agents/model-auth.ts`                       | 392  | 模型认证解析                          |
| `src/agents/model-fallback.ts`                   | 120+ | 模型回退系统                          |
| `src/agents/context-window-guard.ts`             | —    | Context Window 管理                   |
| `src/agents/sandbox/context.ts`                  | —    | Sandbox 隔离                          |
| `src/auto-reply/reply/get-reply.ts`              | 200+ | 消息回复入口                          |
| `src/auto-reply/reply/agent-runner-execution.ts` | 581  | Agent 回退执行                        |
| `src/auto-reply/reply/typing.ts`                 | —    | 打字信号控制                          |
