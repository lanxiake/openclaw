# Phase 4 实施计划：技能系统增强

> 实施日期：2026-02-24
> 关联设计：`my-docs/架构改造文档-v2/技能系统设计/08-技能客户端侧执行与用户自建技能设计.md` §11 Phase 4
> 前置依赖：Phase 1（Gateway 路由 + ClientSkillDispatcher）+ Phase 2（多语言 Runner）+ Phase 3（Agent 自建技能）

## 目标

在 Phase 1-3 的基础上完善技能系统的完整生命周期管理：

1. **技能执行日志持久化**：本地 JSONL 日志，支持查询、清理
2. **技能导出/分享**：定义 `.ocskill` 文件格式，支持导出和导入
3. **技能版本更新检测 + 热更新**：语义版本比较、Gateway 检查更新 RPC、客户端自动更新

> 注：Phase 4.3（macOS/iOS/Android SkillRunner）暂不在本期实施。

---

## 文件变更总览

### 批次 1 新建文件

| 文件路径                                               | 侧      | 用途           |
| ------------------------------------------------------ | ------- | -------------- |
| `apps/windows/src/main/skill-execution-logger.ts`      | Windows | 执行日志管理器 |
| `apps/windows/src/main/skill-execution-logger.test.ts` | Windows | 日志管理器测试 |

### 批次 2 新建文件

| 文件路径                                       | 侧      | 用途                 |
| ---------------------------------------------- | ------- | -------------------- |
| `apps/windows/src/main/skill-exporter.ts`      | Windows | 技能导出为 .ocskill  |
| `apps/windows/src/main/skill-exporter.test.ts` | Windows | 导出器测试           |
| `apps/windows/src/main/skill-importer.ts`      | Windows | 从 .ocskill 导入技能 |
| `apps/windows/src/main/skill-importer.test.ts` | Windows | 导入器测试           |

### 批次 3 新建文件

| 文件路径                                       | 侧      | 用途                 |
| ---------------------------------------------- | ------- | -------------------- |
| `apps/windows/src/main/skill-updater.ts`       | Windows | 客户端版本检查和更新 |
| `apps/windows/src/main/skill-updater.test.ts`  | Windows | 更新器测试           |
| `src/assistant/skills/version-checker.ts`      | Gateway | 版本比较和更新检测   |
| `src/assistant/skills/version-checker.test.ts` | Gateway | 版本检查测试         |

### 修改文件

| 文件路径                                         | 侧      | 修改内容                                                       |
| ------------------------------------------------ | ------- | -------------------------------------------------------------- |
| `apps/windows/src/main/skill-runtime.ts`         | Windows | 批次 1：执行后记录日志；批次 2：导出/导入委托方法              |
| `apps/windows/src/main/skill-store.ts`           | Windows | 批次 2：getSkillDirectory() 方法；批次 3：updateAvailable 字段 |
| `apps/windows/src/main/index.ts`                 | Windows | 批次 1-3：注册 IPC handlers                                    |
| `apps/windows/src/preload/index.ts`              | Windows | 批次 1-3：暴露 IPC 方法                                        |
| `src/gateway/server-methods/assistant-skills.ts` | Gateway | 批次 3：assistant.skills.checkUpdates RPC                      |
| `src/gateway/server-methods-list.ts`             | Gateway | 批次 3：注册新方法名                                           |
| `src/gateway/server-methods.ts`                  | Gateway | 批次 3：添加到权限集合                                         |

---

## 批次 1：技能执行日志持久化 (skill-execution-logger)

### 设计

使用 JSONL（每行一条 JSON 记录）格式存储在本地磁盘，按天分割文件：

```
~/.mtbot/logs/skills/
├── execution-2026-02-24.jsonl
├── execution-2026-02-23.jsonl
└── ...
```

单条日志记录结构：

```typescript
interface ExecutionLogEntry {
  /** 唯一 ID */
  id: string;
  /** 执行请求 ID */
  requestId: string;
  /** 技能 ID */
  skillId: string;
  /** 技能名称 */
  skillName: string;
  /** 运行时类型 */
  runtime: string;
  /** 执行参数（脱敏后） */
  params: Record<string, unknown>;
  /** 开始时间 ISO 8601 */
  startedAt: string;
  /** 执行耗时 ms */
  executionTimeMs: number;
  /** 是否成功 */
  success: boolean;
  /** 返回结果摘要（截断到 1KB） */
  resultSummary?: string;
  /** 错误信息 */
  error?: string;
  /** 退出码 */
  exitCode: number | null;
  /** stdout 截断到 4KB */
  stdout: string;
  /** stderr 截断到 4KB */
  stderr: string;
}
```

### 新建 `apps/windows/src/main/skill-execution-logger.ts`

```typescript
export class SkillExecutionLogger {
  private readonly logDir: string;

  constructor(logDir: string);

  /** 初始化日志目录 */
  async initialize(): Promise<void>;

  /** 记录一次执行 */
  async logExecution(entry: Omit<ExecutionLogEntry, "id">): Promise<string>;

  /** 查询日志 */
  async queryLogs(filter: {
    skillId?: string;
    dateFrom?: string; // YYYY-MM-DD
    dateTo?: string; // YYYY-MM-DD
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: ExecutionLogEntry[]; total: number }>;

  /** 清理指定天数之前的日志 */
  async clearOldLogs(daysBefore: number): Promise<number>;

  /** 获取日志统计 */
  async getStats(): Promise<{
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    totalLogFiles: number;
    totalLogSizeBytes: number;
  }>;
}
```

关键实现：

- `logExecution`：追加写入当天 JSONL 文件（`fs.appendFile`）
- `queryLogs`：逐文件读取 + 过滤 + 分页
- `clearOldLogs`：删除过期的 JSONL 文件
- stdout/stderr 截断到 4KB，resultSummary 截断到 1KB
- 文件名格式：`execution-YYYY-MM-DD.jsonl`

### 修改 `apps/windows/src/main/skill-runtime.ts`

在 `createExternalSkillDefinition` 中 runner 执行后添加日志记录：

```typescript
// 在 result 返回之后、throw 之前
await this.executionLogger
  ?.logExecution({
    requestId: context.requestId ?? crypto.randomUUID(),
    skillId: manifest.id,
    skillName: manifest.name,
    runtime: manifest.runtime,
    params: sanitizeParams(params),
    startedAt: new Date(Date.now() - result.executionTimeMs).toISOString(),
    executionTimeMs: result.executionTimeMs,
    success: result.success,
    resultSummary: truncate(JSON.stringify(result.result), 1024),
    error: result.error,
    exitCode: result.exitCode,
    stdout: truncate(result.stdout, 4096),
    stderr: truncate(result.stderr, 4096),
  })
  .catch((err) => log.warn("记录执行日志失败", { error: String(err) }));
```

### 测试先行 `skill-execution-logger.test.ts`（~10 个用例）

| 用例    | 说明                            |
| ------- | ------------------------------- |
| LOG-001 | 初始化创建日志目录              |
| LOG-002 | logExecution 写入 JSONL 文件    |
| LOG-003 | 多次写入追加到同一天文件        |
| LOG-004 | queryLogs 不带过滤返回全部      |
| LOG-005 | queryLogs 按 skillId 过滤       |
| LOG-006 | queryLogs 按日期范围过滤        |
| LOG-007 | queryLogs 按 success 过滤       |
| LOG-008 | queryLogs 分页 (limit + offset) |
| LOG-009 | clearOldLogs 删除过期文件       |
| LOG-010 | getStats 返回正确统计           |

**验证：**

```bash
cd apps/windows && npx vitest run src/main/skill-execution-logger.test.ts
```

---

## 批次 2：技能导出/分享 (.ocskill 文件格式)

### .ocskill 格式定义

`.ocskill` 文件是一个 tar.gz 归档，包含：

```
skill-name.ocskill (tar.gz)
├── ocskill.json          # 元数据 + 完整性校验
└── skill/                # 技能文件目录
    ├── skill.json        # 技能清单
    ├── index.ts          # 入口文件
    └── ...               # 其他文件
```

`ocskill.json` 结构：

```typescript
interface OcskillMeta {
  /** 格式版本 */
  format: "ocskill/1.0";
  /** 技能信息 */
  skill: {
    id: string;
    name: string;
    description?: string;
    version: string;
    author?: string;
    runtime: "typescript" | "javascript" | "python" | "shell";
  };
  /** 包校验 */
  integrity: {
    /** 技能目录内容的 SHA-256（不含 ocskill.json 本身） */
    hash: string;
    /** 技能目录内文件总数 */
    fileCount: number;
  };
  /** 导出元数据 */
  exported: {
    at: string; // ISO 8601
    platform: string; // 'windows' | 'macos' | 'linux'
    appVersion: string;
  };
}
```

### 新建 `apps/windows/src/main/skill-exporter.ts`

```typescript
export class SkillExporter {
  /**
   * 将本地安装的技能导出为 .ocskill 文件
   *
   * @param skillDir - 技能安装目录（包含 skill.json）
   * @param outputPath - 输出文件路径
   * @returns 导出结果
   */
  async exportSkill(
    skillDir: string,
    outputPath: string,
  ): Promise<{
    success: boolean;
    outputPath?: string;
    fileSize?: number;
    error?: string;
  }>;
}
```

流程：

1. 读取并验证 skill.json
2. 计算技能目录所有文件的 SHA-256
3. 生成 ocskill.json 元数据
4. 使用 `tar.create` 打包整个技能目录 + ocskill.json 为 .tgz
5. 重命名为 .ocskill

### 新建 `apps/windows/src/main/skill-importer.ts`

```typescript
export class SkillImporter {
  constructor(private readonly skillStore: LocalSkillStore)

  /**
   * 从 .ocskill 文件导入技能
   *
   * @param ocskillPath - .ocskill 文件路径
   * @returns 导入结果
   */
  async importSkill(ocskillPath: string): Promise<{
    success: boolean
    skillId?: string
    skillName?: string
    error?: string
  }>

  /**
   * 预览 .ocskill 文件内容（不安装）
   */
  async previewSkill(ocskillPath: string): Promise<{
    meta: OcskillMeta | null
    error?: string
  }>
}
```

导入流程：

1. 解压 .ocskill 到临时目录
2. 读取 ocskill.json，验证格式版本
3. 计算技能目录 SHA-256，与 integrity.hash 比对
4. 调用 `skillStore.installFromDirectory()` 安装
5. 清理临时目录

### 修改 `apps/windows/src/main/skill-runtime.ts`

新增 IPC 委托方法：

```typescript
/** 导出技能到文件 */
async exportSkill(skillId: string, outputPath: string): Promise<{...}>

/** 从 .ocskill 文件导入技能 */
async importSkill(ocskillPath: string): Promise<{...}>

/** 预览 .ocskill 文件 */
async previewOcskill(ocskillPath: string): Promise<{...}>
```

### 修改 `apps/windows/src/main/skill-store.ts`

新增方法：

```typescript
/** 获取技能安装目录路径 */
getSkillDirectory(skillId: string): string | null
```

### 测试先行

**`skill-exporter.test.ts`（~6 个用例）：**

| 用例    | 说明                            |
| ------- | ------------------------------- |
| EXP-001 | 导出 TypeScript 技能为 .ocskill |
| EXP-002 | 导出 Python 技能为 .ocskill     |
| EXP-003 | 导出文件包含正确的 ocskill.json |
| EXP-004 | 导出文件 SHA-256 校验正确       |
| EXP-005 | 技能目录不存在时返回错误        |
| EXP-006 | 缺少 skill.json 时返回错误      |

**`skill-importer.test.ts`（~7 个用例）：**

| 用例    | 说明                        |
| ------- | --------------------------- |
| IMP-001 | 从 .ocskill 成功导入        |
| IMP-002 | 导入后技能出现在 skillStore |
| IMP-003 | previewSkill 返回元数据     |
| IMP-004 | SHA-256 校验失败时拒绝导入  |
| IMP-005 | 格式版本不匹配时拒绝        |
| IMP-006 | 文件不存在时返回错误        |
| IMP-007 | 非 .ocskill 文件时返回错误  |

**验证：**

```bash
cd apps/windows && npx vitest run src/main/skill-exporter.test.ts src/main/skill-importer.test.ts
```

---

## 批次 3：技能版本更新检测 + 热更新

### Gateway 侧：版本检查服务

**新建 `src/assistant/skills/version-checker.ts`**

```typescript
/** 语义版本比较 */
export function compareVersions(a: string, b: string): number;

/** 检查是否有更新可用 */
export function isUpdateAvailable(installed: string, latest: string): boolean;

/** 批量检查多个技能的更新 */
export interface UpdateCheckResult {
  skillId: string;
  installedVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
}

export function checkUpdates(
  installed: Array<{ skillId: string; version: string }>,
  registry: Map<string, { latestVersion: string }>,
): UpdateCheckResult[];
```

### Gateway RPC：`assistant.skills.checkUpdates`

在 `assistant-skills.ts` 中新增：

```typescript
"assistant.skills.checkUpdates": async ({ params, respond, client }) => {
  // 参数：installedSkills: Array<{ skillId: string; version: string }>
  // 返回：updates: UpdateCheckResult[]
}
```

### Windows 侧：自动更新器

**新建 `apps/windows/src/main/skill-updater.ts`**

```typescript
export class SkillUpdater {
  constructor(
    private readonly skillStore: LocalSkillStore,
    private readonly checkInterval: number = 3600_000 // 默认 1 小时
  )

  /** 启动定期检查 */
  start(): void

  /** 停止定期检查 */
  stop(): void

  /** 手动触发检查 */
  async checkForUpdates(): Promise<UpdateCheckResult[]>

  /** 更新指定技能 */
  async updateSkill(skillId: string): Promise<{
    success: boolean
    oldVersion?: string
    newVersion?: string
    error?: string
  }>
}
```

### 修改 `apps/windows/src/main/skill-store.ts`

SkillIndexEntry 新增字段：

```typescript
/** 最新可用版本（从 Gateway 获取） */
latestVersion?: string
/** 是否有更新 */
updateAvailable?: boolean
```

### 测试先行

**`version-checker.test.ts`（~8 个用例）：**

| 用例    | 说明                                    |
| ------- | --------------------------------------- |
| VER-001 | compareVersions 正确比较 major          |
| VER-002 | compareVersions 正确比较 minor          |
| VER-003 | compareVersions 正确比较 patch          |
| VER-004 | compareVersions 处理非标准版本          |
| VER-005 | isUpdateAvailable 正确判断              |
| VER-006 | isUpdateAvailable 相同版本返回 false    |
| VER-007 | checkUpdates 批量检查                   |
| VER-008 | checkUpdates 跳过不在 registry 中的技能 |

**`skill-updater.test.ts`（~6 个用例）：**

| 用例    | 说明                               |
| ------- | ---------------------------------- |
| UPD-001 | checkForUpdates 返回有更新的技能   |
| UPD-002 | checkForUpdates 无更新时返回空     |
| UPD-003 | updateSkill 成功更新               |
| UPD-004 | updateSkill 已是最新版返回无需更新 |
| UPD-005 | start/stop 定时器正常工作          |
| UPD-006 | 更新失败不影响其他技能             |

**验证：**

```bash
pnpm vitest run src/assistant/skills/version-checker.test.ts
cd apps/windows && npx vitest run src/main/skill-updater.test.ts
```

---

## 依赖关系

```
批次 1 (执行日志) ──> 批次 2 (导出/分享) ──> 批次 3 (版本更新)
```

批次 1 最简单且独立，先行实施。批次 2 和 3 可在批次 1 完成后并行，但批次 3 涉及 Gateway 侧修改，建议在批次 2 之后。

## 关键复用

| 已有组件              | 路径                                     | 复用方式            |
| --------------------- | ---------------------------------------- | ------------------- |
| `LocalSkillStore`     | `apps/windows/src/main/skill-store.ts`   | 安装/卸载/索引管理  |
| `SkillManifest`       | `skill-store.ts:22`                      | 类型定义            |
| `RunnerResult`        | `ts-runner.ts:44`                        | 执行结果结构        |
| `ClientSkillRuntime`  | `skill-runtime.ts`                       | 执行入口、IPC 委托  |
| `skill-packager`      | `src/assistant/skills/skill-packager.ts` | tar.gz 打包逻辑复用 |
| `SkillPushDispatcher` | `src/assistant/skills/skill-push.ts`     | 更新推送复用        |

## 全量验证

```bash
# Windows 侧测试
cd apps/windows && npx vitest run src/main/skill-execution-logger.test.ts
cd apps/windows && npx vitest run src/main/skill-exporter.test.ts
cd apps/windows && npx vitest run src/main/skill-importer.test.ts
cd apps/windows && npx vitest run src/main/skill-updater.test.ts

# Gateway 侧测试
pnpm vitest run src/assistant/skills/version-checker.test.ts

# TypeScript 编译检查
pnpm build

# 全量测试
cd apps/windows && npx vitest run src/main/
```

---

## 进度跟踪

| 批次                         | 状态    | 测试数 | 备注                                                    |
| ---------------------------- | ------- | ------ | ------------------------------------------------------- |
| 1. skill-execution-logger    | ✅ 完成 | 10     | JSONL 日志 + 查询 + 清理 + 统计，已集成到 skill-runtime |
| 2. skill-exporter + importer | ✅ 完成 | 13     | .ocskill 格式定义 + 导出/导入 + SHA-256 校验            |
| 3. version-checker + updater | ✅ 完成 | 14     | 语义版本比较 + Gateway RPC + 定时自动检查               |

Phase 4 全部完成：37 个新增测试全绿，Gateway 编译通过，Windows 269/273 通过（4 个预有失败）
