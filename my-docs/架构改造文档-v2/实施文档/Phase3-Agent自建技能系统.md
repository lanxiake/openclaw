# Phase 3 实施计划：Agent 自建技能系统

> 实施日期：2026-02-23
> 关联设计：`my-docs/架构改造文档-v2/技能系统设计/08-技能客户端侧执行与用户自建技能设计.md` §7
> 前置依赖：Phase 1（Gateway 路由 + ClientSkillDispatcher）+ Phase 2（多语言 Runner + IPC 接口 + 单文件包装）

## 目标

让 Agent 能够根据用户对话需求，自动创建技能代码并推送到客户端设备安装执行：

1. **Agent 工具 `skill_create`**：Agent 在对话中调用此工具生成技能
2. **技能打包 + SHA-256 校验**：将生成的代码打包为可安装的技能包
3. **pushSkillToDevice**：通过 `SKILL_EXECUTE_EVENT` 协议将技能包推送到客户端安装
4. **端到端测试**：验证从 Agent 调用到客户端安装执行的完整流程

---

## 文件变更总览

### 新建文件

| 文件路径                                      | 侧      | 用途                    |
| --------------------------------------------- | ------- | ----------------------- |
| `src/agents/tools/skill-create-tool.ts`       | Gateway | skill_create Agent 工具 |
| `src/agents/tools/skill-create-tool.test.ts`  | Gateway | 工具测试                |
| `src/assistant/skills/skill-packager.ts`      | Gateway | 技能打包 + SHA-256 校验 |
| `src/assistant/skills/skill-packager.test.ts` | Gateway | 打包测试                |
| `src/assistant/skills/skill-push.ts`          | Gateway | 推送技能到客户端设备    |
| `src/assistant/skills/skill-push.test.ts`     | Gateway | 推送测试                |

### 修改文件

| 文件路径                                         | 侧      | 修改内容                                       |
| ------------------------------------------------ | ------- | ---------------------------------------------- |
| `src/agents/openclaw-tools.ts`                   | Gateway | 注册 skill_create 工具                         |
| `src/gateway/server-methods/assistant-skills.ts` | Gateway | 新增 `assistant.skills.createAndPush` RPC 方法 |
| `apps/windows/src/main/skill-runtime.ts`         | Windows | 新增 `handleSkillInstallPush` 处理远程推送安装 |
| `apps/windows/src/preload/index.ts`              | Windows | skill.install 事件监听                         |

---

## 实施批次

### 批次 1：技能打包器 (skill-packager.ts)

**新建 `src/assistant/skills/skill-packager.ts`**

职责：将 Agent 生成的技能代码 + manifest 打包为可传输的格式。

```typescript
/**
 * 技能打包器
 *
 * 将技能代码和清单打包为 base64 编码的 tar.gz，附带 SHA-256 校验
 */

interface PackageInput {
  /** 技能清单 */
  manifest: {
    id: string;
    name: string;
    description?: string;
    version: string;
    author?: string;
    entry: string;
    runtime: "typescript" | "javascript" | "python" | "shell";
    permissions?: SkillPermissions;
    category?: string;
  };
  /** 技能代码（文件名 → 内容） */
  files: Record<string, string>;
}

interface PackageOutput {
  /** base64 编码的 tar.gz */
  packageBase64: string;
  /** 包的 SHA-256 哈希 */
  packageHash: string;
  /** 包大小（字节） */
  packageSize: number;
  /** 清单信息 */
  manifest: PackageInput["manifest"];
}

/** 打包技能文件 */
export async function packSkill(input: PackageInput): Promise<PackageOutput>;

/** 校验包完整性 */
export function verifyPackage(packageBase64: string, expectedHash: string): boolean;
```

关键实现：

- 写入临时目录 → `skill.json` + 代码文件
- 使用 Node.js `zlib.createGzip()` + `tar.create()` 打包（或 `archiver` 库）
- `crypto.createHash('sha256')` 计算 hash
- base64 编码整包用于 WebSocket 传输
- 包大小限制：10MB

**测试先行 `skill-packager.test.ts`（~8 个用例）：**

| 用例     | 说明                               |
| -------- | ---------------------------------- |
| PACK-001 | 打包 TypeScript 单文件技能         |
| PACK-002 | 打包 Python 单文件技能             |
| PACK-003 | 打包多文件技能（含 package.json）  |
| PACK-004 | SHA-256 哈希正确                   |
| PACK-005 | verifyPackage 正确验证             |
| PACK-006 | verifyPackage 哈希不匹配返回 false |
| PACK-007 | 缺少 manifest 字段时报错           |
| PACK-008 | 超过大小限制时报错                 |

**验证：**

```bash
pnpm vitest run src/assistant/skills/skill-packager.test.ts
```

---

### 批次 2：技能推送 (skill-push.ts)

**新建 `src/assistant/skills/skill-push.ts`**

职责：通过 `SKILL_INSTALL_EVENT` 事件将打包好的技能推送到客户端安装。

```typescript
/**
 * 技能推送服务
 *
 * 通过 WebSocket 事件将技能包推送到用户的客户端设备
 */

/** 推送安装事件名 */
export const SKILL_INSTALL_EVENT = "skill.install.request";

/** 推送安装请求 */
interface SkillInstallRequest {
  requestId: string;
  skillId: string;
  version: string;
  packageBase64: string;
  packageHash: string;
  manifest: SkillManifest;
}

/** 推送安装结果 */
interface SkillInstallResult {
  requestId: string;
  success: boolean;
  error?: string;
}

/**
 * 推送技能到用户设备
 *
 * 使用 sendToUserClients 方法发送安装事件
 * 等待客户端回传安装结果
 */
export async function pushSkillToDevice(opts: {
  userId: string;
  packageOutput: PackageOutput;
  sendToUserClients: SendToUserClientsFn;
  timeoutMs?: number;
}): Promise<{ success: boolean; error?: string }>;
```

关键实现：

- 复用 `ClientSkillDispatcher` 同样的 `sendToUserClients` 模式
- 等待结果用 Promise + timeout
- 超时 120s（技能可能需要安装依赖）

**Windows 侧变更 `skill-runtime.ts`：**

新增 `handleSkillInstallPush(request: SkillInstallRequest)` 方法：

1. 验证 SHA-256 校验
2. 解码 base64 包
3. 解压到临时目录
4. 调用 `this.skillStore.installFromDirectory(tempDir)` 安装
5. 重新加载外部技能
6. 回传安装结果

**测试先行 `skill-push.test.ts`（~6 个用例）：**

| 用例     | 说明                     |
| -------- | ------------------------ |
| PUSH-001 | 成功推送并等待结果       |
| PUSH-002 | 无客户端时返回失败       |
| PUSH-003 | 客户端安装失败时传递错误 |
| PUSH-004 | 推送超时返回超时错误     |
| PUSH-005 | requestId 正确匹配       |
| PUSH-006 | 多次推送互不干扰         |

**验证：**

```bash
pnpm vitest run src/assistant/skills/skill-push.test.ts
```

---

### 批次 3：Agent 工具 skill_create (skill-create-tool.ts)

**新建 `src/agents/tools/skill-create-tool.ts`**

遵循现有工具模式（参考 `nodes-tool.ts`, `cron-tool.ts`）：

- 扁平化 TypeBox Schema（无 anyOf/oneOf）
- `callGatewayTool()` 调用 Gateway RPC
- `jsonResult()` 返回结果

```typescript
const SKILL_CREATE_ACTIONS = [
  "create", // 创建技能并推送到设备
  "list", // 列出用户已安装的技能
  "detail", // 查看技能详情
  "execute", // 手动执行技能
] as const;

const SkillCreateToolSchema = Type.Object({
  action: stringEnum(SKILL_CREATE_ACTIONS),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
  // create action
  name: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  language: optionalStringEnum(["typescript", "python", "shell"]),
  code: Type.Optional(Type.String()),
  triggers: Type.Optional(
    Type.Array(
      Type.Object({
        type: stringEnum(["command", "schedule", "event"]),
        command: Type.Optional(Type.String()),
        cron: Type.Optional(Type.String()),
        event: Type.Optional(Type.String()),
      }),
    ),
  ),
  permissions: Type.Optional(
    Type.Object({
      fileSystem: Type.Optional(
        Type.Object({
          read: Type.Optional(Type.Array(Type.String())),
          write: Type.Optional(Type.Array(Type.String())),
        }),
      ),
      network: Type.Optional(
        Type.Object({
          allowedHosts: Type.Optional(Type.Array(Type.String())),
        }),
      ),
    }),
  ),
  // list/detail/execute action
  skillId: Type.Optional(Type.String()),
  params: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export function createSkillCreateTool(options?: {
  agentSessionKey?: string;
  config?: OpenClawConfig;
}): AnyAgentTool;
```

**action 分支逻辑：**

| action    | 调用的 Gateway RPC               | 说明               |
| --------- | -------------------------------- | ------------------ |
| `create`  | `assistant.skills.createAndPush` | 打包 + 推送 + 注册 |
| `list`    | `assistant.skills.list`          | 列出已安装技能     |
| `detail`  | `assistant.skills.get`           | 技能详情           |
| `execute` | `assistant.skills.execute`       | 执行技能           |

**注册到 Agent：修改 `src/agents/openclaw-tools.ts`**

在 L74-142 的 tools 数组中增加：

```typescript
import { createSkillCreateTool } from "./tools/skill-create-tool.js"

// L141 位置（createTodoWriteTool() 之前）
createSkillCreateTool({
  agentSessionKey: options?.agentSessionKey,
  config: options?.config,
}),
```

**测试先行 `skill-create-tool.test.ts`（~8 个用例）：**

| 用例   | 说明                                         |
| ------ | -------------------------------------------- |
| SC-001 | create action 参数验证：name 必填            |
| SC-002 | create action 参数验证：code 必填            |
| SC-003 | create action 参数验证：language 必填        |
| SC-004 | create action 调用正确的 Gateway RPC         |
| SC-005 | list action 调用 assistant.skills.list       |
| SC-006 | detail action 需要 skillId                   |
| SC-007 | execute action 调用 assistant.skills.execute |
| SC-008 | 未知 action 返回错误                         |

**验证：**

```bash
pnpm vitest run src/agents/tools/skill-create-tool.test.ts
```

---

### 批次 4：Gateway RPC 方法 (assistant.skills.createAndPush)

**修改 `src/gateway/server-methods/assistant-skills.ts`**

在 `assistantSkillHandlers` 对象中新增 RPC 方法：

```typescript
"assistant.skills.createAndPush": async ({ params, respond, context }) => {
  // 参数:
  //   name: string (必填)
  //   description: string
  //   language: "typescript" | "python" | "shell" (必填)
  //   code: string (必填)
  //   triggers: SkillTrigger[]
  //   permissions: SkillPermissions
  //   targetDeviceId?: string
  //
  // 流程:
  // 1. 参数验证
  // 2. 构建 manifest（runMode 强制 "local"）
  // 3. 调用 packSkill() 打包
  // 4. 调用 pushSkillToDevice() 推送到客户端
  // 5. 将技能元数据注册到 Gateway registry（不加载代码）
  // 6. 返回 { success, skillId, message }
}
```

**验证：** 编译检查

```bash
pnpm build
```

---

### 批次 5：Windows 客户端安装推送处理

**修改 `apps/windows/src/main/skill-runtime.ts`**

新增方法：

```typescript
/**
 * 处理来自 Gateway 的技能安装推送
 *
 * 解码 base64 包 → 校验 SHA-256 → 解压 → 安装 → 重新加载
 */
async handleSkillInstallPush(request: {
  requestId: string
  skillId: string
  version: string
  packageBase64: string
  packageHash: string
  manifest: SkillManifest
}): Promise<{ success: boolean; error?: string }>
```

实现步骤：

1. base64 → Buffer
2. SHA-256 校验
3. 写入临时目录
4. 调用 `installFromDirectory(tempDir)` 安装
5. 调用 `reloadExternalSkills()` 重新加载
6. 清理临时目录
7. 返回结果

**修改 Gateway 消息处理：注册 `skill.install.request` 事件监听器**

在 `apps/windows/src/main/index.ts` 的 Gateway 连接建立后注册事件监听。

**验证：**

```bash
cd apps/windows && npx vitest run src/main/skill-runtime-external.test.ts
```

---

## 依赖关系

```
批次 1 (skill-packager) ──> 批次 2 (skill-push) ──> 批次 4 (RPC 方法)
                                                          │
                                                    批次 3 (Agent 工具)
                                                          │
                                                    批次 5 (Windows 安装处理)
```

批次 1 → 2 → 4 是严格顺序。批次 3 在批次 1 之后可以并行。批次 5 依赖批次 2。

## 关键复用

| 已有组件                               | 路径                                       | 复用方式                                |
| -------------------------------------- | ------------------------------------------ | --------------------------------------- |
| `ClientSkillDispatcher`                | `src/assistant/skills/client-dispatch.ts`  | 推送模式复用 dispatch/handleResult 模式 |
| `SendToUserClientsFn`                  | `client-dispatch.ts:25`                    | 推送事件到客户端                        |
| `callGatewayTool`                      | `src/agents/tools/gateway.ts:29`           | Agent 工具调用 Gateway RPC              |
| `LocalSkillStore.installFromDirectory` | `apps/windows/src/main/skill-store.ts:123` | 客户端安装逻辑                          |
| `SkillManifest`                        | `skill-store.ts:22`                        | 类型定义                                |
| `wrapSingleFile` / `inferRuntime`      | `skill-wrapper.ts`                         | 单文件包装逻辑参考                      |
| `jsonResult`, `readStringParam`        | `common.ts`                                | Agent 工具工具函数                      |
| `stringEnum`, `optionalStringEnum`     | `typebox.js`                               | Schema 构建                             |

## 协议扩展

新增事件常量：

```typescript
// src/gateway/protocol/skill-execution.ts 追加
export const SKILL_INSTALL_EVENT = "skill.install.request";
export const SKILL_INSTALL_RESULT_METHOD = "assistant.skill.installResult";
```

## 全量验证

```bash
# Gateway 侧测试
pnpm vitest run src/assistant/skills/skill-packager.test.ts
pnpm vitest run src/assistant/skills/skill-push.test.ts
pnpm vitest run src/agents/tools/skill-create-tool.test.ts

# Windows 侧测试
cd apps/windows && npx vitest run src/main/

# TypeScript 编译检查
pnpm build

# 全量测试
pnpm test
```

---

## 进度跟踪

| 批次                 | 状态    | 测试数 | 备注                                   |
| -------------------- | ------- | ------ | -------------------------------------- |
| 1. skill-packager    | ✅ 完成 | 8      | 2026-02-23 打包 + SHA-256 全通过       |
| 2. skill-push        | ✅ 完成 | 6      | 2026-02-23 推送调度 全通过             |
| 3. skill-create-tool | ✅ 完成 | 9      | 2026-02-23 Agent 工具 全通过           |
| 4. Gateway RPC       | ✅ 完成 | —      | 2026-02-23 编译通过 + 方法注册         |
| 5. Windows 安装处理  | ✅ 完成 | —      | 2026-02-23 handleSkillInstallPush 实现 |

> Phase 3 全部完成：
>
> - Gateway 侧：37 个新增测试全绿（skill-packager 8 + skill-push 6 + skill-create-tool 9 + client-dispatch 14）
> - Windows 侧：240 个测试通过（14/15 文件，api-client.test.ts 4 个失败是已有问题）
> - 新增文件：skill-packager.ts, skill-push.ts, skill-create-tool.ts + 对应测试
> - 修改文件：openclaw-tools.ts, assistant-skills.ts, server-methods-list.ts, server-methods.ts, skill-runtime.ts, gateway-client.ts
