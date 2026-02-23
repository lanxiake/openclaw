# Phase 2 实施计划：多语言 Runner + IPC 接口 + 单文件包装

> 实施日期：2026-02-23
> 关联设计：`my-docs/架构改造文档-v2/技能系统设计/08-技能客户端侧执行与用户自建技能设计.md`
> 前置依赖：Phase 1 已完成（Gateway 路由 + ClientSkillDispatcher + LocalSkillStore + TypeScriptRunner）

## 目标

扩展客户端技能运行时，打通以下链路：

1. 支持 Python / Shell 多语言技能执行
2. 提供本地技能管理 IPC 接口（安装/卸载/执行/启用禁用）
3. 支持单文件脚本自动包装为技能
4. Preload 层暴露完整的 skills 命名空间 API

---

## 文件变更总览

### 新建文件

| 文件路径                                      | 侧     | 用途               |
| --------------------------------------------- | ------ | ------------------ |
| `apps/windows/src/main/python-runner.ts`      | 客户端 | PythonRunner 实现  |
| `apps/windows/src/main/python-runner.test.ts` | 客户端 | PythonRunner 测试  |
| `apps/windows/src/main/shell-runner.ts`       | 客户端 | ShellRunner 实现   |
| `apps/windows/src/main/shell-runner.test.ts`  | 客户端 | ShellRunner 测试   |
| `apps/windows/src/main/skill-wrapper.ts`      | 客户端 | 单文件脚本自动包装 |
| `apps/windows/src/main/skill-wrapper.test.ts` | 客户端 | 包装逻辑测试       |

### 修改文件

| 文件路径                                               | 侧     | 修改内容                                                   |
| ------------------------------------------------------ | ------ | ---------------------------------------------------------- |
| `apps/windows/src/main/skill-store.ts`                 | 客户端 | runtime 类型扩展加入 `'shell'`，validateManifest 更新      |
| `apps/windows/src/main/skill-runtime.ts`               | 客户端 | 新增 pyRunner/shellRunner，selectRunner 分发，5 个委托方法 |
| `apps/windows/src/main/skill-runtime-external.test.ts` | 客户端 | 新增 Python/Shell/不支持 runtime 测试用例                  |
| `apps/windows/src/main/index.ts`                       | 客户端 | setupIpcHandlers 新增 6 个 skills: 前缀处理器              |
| `apps/windows/src/preload/index.ts`                    | 前端   | ElectronAPI 新增 skills 命名空间接口 + 实现                |

### 无 Gateway/API Server 侧变更

本次实施仅涉及 Windows 客户端侧（main + preload），不修改 Gateway 或 API Server。

---

## 实施批次

### 批次 1：PythonRunner

**新建 `apps/windows/src/main/python-runner.ts`**

- 复用 `ts-runner.ts` 导出的 `RunnerOptions`、`RunnerResult`、`extractResult`、`RESULT_PREFIX`
- `detectPython(skillDir?)` 方法：
  - 优先 `.venv/Scripts/python.exe`(Win) 或 `.venv/bin/python`(Unix)
  - → `python3` → `python`（验证版本 ≥3）→ `py -3`(Win)
  - 缓存检测结果
- `execute(opts: RunnerOptions)` 方法：
  - spawn python 子进程
  - `SKILL_PARAMS` 环境变量传参
  - `PYTHONIOENCODING=utf-8`，`PYTHONUNBUFFERED=1`
  - 超时：SIGTERM → 2s → SIGKILL
  - AbortSignal 外部取消

**测试先行 `python-runner.test.ts`（~8 个用例）：**

- PY-001 detectPython 返回有效路径
- PY-002 执行脚本提取 `__SKILL_RESULT__:` 结果
- PY-003 SKILL_PARAMS 传参
- PY-004 非零退出码返回失败
- PY-005 超时终止
- PY-006 AbortSignal 取消
- PY-007 文件不存在返回错误
- PY-008 extractResult 复用验证

> 注意：Python 不可用时测试用 `it.skipIf(!hasPython)` 跳过

**验证：**

```bash
pnpm vitest run apps/windows/src/main/python-runner.test.ts
```

---

### 批次 2：ShellRunner

**新建 `apps/windows/src/main/shell-runner.ts`**

- 复用 `RunnerOptions`、`RunnerResult`、`extractResult`
- `resolveShell(entryPath)` 根据扩展名 + 平台选择 shell：
  - Win `.ps1` → `powershell.exe -ExecutionPolicy Bypass -File`
  - Win `.bat/.cmd` → `cmd.exe /c`
  - Win `.sh` → `bash`（Git Bash / WSL）
  - Unix → `/bin/bash`
- `SKILL_PARAMS` 环境变量传参
- 与 TypeScriptRunner 相同的超时和取消模式

**测试先行 `shell-runner.test.ts`（~7 个用例）：**

- SH-001 执行 .sh 脚本（Unix / Git Bash）
- SH-002 执行 .ps1 脚本（Win）
- SH-003 执行 .bat 脚本（Win）
- SH-004 SKILL_PARAMS 传参
- SH-005 超时终止
- SH-006 AbortSignal 取消
- SH-007 不支持的扩展名返回错误

> 注意：平台不适用的测试用 `it.skipIf(process.platform !== ...)` 跳过

**验证：**

```bash
pnpm vitest run apps/windows/src/main/shell-runner.test.ts
```

---

### 批次 3：skill-store + skill-runtime 扩展

**修改 `skill-store.ts`：**

- L36: `runtime` 类型扩展加入 `| 'shell'`
- L389: `validateManifest` 验证逻辑加入 `'shell'`

**修改 `skill-runtime.ts`：**

- import `PythonRunner`、`ShellRunner`
- 新增字段 `pyRunner: PythonRunner | null`、`shellRunner: ShellRunner | null`
- `initialize()` 中初始化新 Runner
- 新增 `selectRunner(runtime)` 方法：ts/js→tsRunner, python→pyRunner, shell→shellRunner
- 修改 `createExternalSkillDefinition()` 使用 `selectRunner` 分发
- 新增 5 个委托方法供 IPC 调用：
  - `installFromDirectory(sourceDir)` — 安装后自动 reloadExternalSkills
  - `uninstallLocal(skillId)` — 卸载后自动 unregisterSkill
  - `listLocalInstalled()` — 委托 skillStore.listInstalled
  - `getSkillDetail(skillId)` — 返回 manifest + indexEntry
  - `setLocalEnabled(skillId, enabled)` — 启用/禁用后 reload

**扩展测试 `skill-runtime-external.test.ts`（+3 个用例）：**

- EXT-007 加载 Python runtime 技能
- EXT-008 加载 Shell runtime 技能
- EXT-009 不支持的 runtime 类型不加载

**验证：**

```bash
pnpm vitest run apps/windows/src/main/skill-store.test.ts
pnpm vitest run apps/windows/src/main/skill-runtime-external.test.ts
```

---

### 批次 4：IPC 接口

**修改 `apps/windows/src/main/index.ts`（setupIpcHandlers 区域）：**

新增 6 个 `skills:` 前缀 IPC 处理器：

| IPC Channel                   | 功能               | 参数验证                          |
| ----------------------------- | ------------------ | --------------------------------- |
| `skills:listLocalInstalled`   | 列出本地已安装技能 | 无参数                            |
| `skills:installFromDirectory` | 从目录安装         | sourceDir: string 非空            |
| `skills:uninstallLocal`       | 卸载本地技能       | skillId: string 非空              |
| `skills:executeLocal`         | 本地执行技能       | { skillId, params, timeoutMs? }   |
| `skills:setEnabled`           | 启用/禁用          | skillId: string, enabled: boolean |
| `skills:getSkillDetail`       | 获取技能详情       | skillId: string 非空              |

**修改 `apps/windows/src/preload/index.ts`：**

ElectronAPI 接口新增 `skills` 命名空间：

```typescript
skills: {
  listLocalInstalled: () => Promise<SkillIndexEntry[]>;
  installFromDirectory: (sourceDir: string) => Promise<{ success; skillId?; error? }>;
  uninstallLocal: (skillId: string) => Promise<{ success; error? }>;
  executeLocal: (params: { skillId; params; timeoutMs? }) => Promise<SkillExecuteResult>;
  setEnabled: (skillId: string, enabled: boolean) => Promise<boolean>;
  getSkillDetail: (skillId: string) => Promise<{ manifest; indexEntry }>;
}
```

实现对象中对应添加 `ipcRenderer.invoke(...)` 调用。

**验证：** TypeScript 编译检查

```bash
cd apps/windows && npx tsc --noEmit
```

---

### 批次 5：单文件脚本自动包装

**新建 `apps/windows/src/main/skill-wrapper.ts`**

- `inferRuntime(filePath)` — 从扩展名推断 runtime：
  - `.ts/.tsx` → typescript, `.js/.mjs` → javascript, `.py` → python, `.sh/.ps1/.bat/.cmd` → shell
- `wrapSingleFile(opts: WrapOptions)` — 生成 skill.json：
  - 创建临时目录，复制脚本，生成 manifest
  - id 从文件名 + 时间戳生成
  - 返回 `{ success, skillDir, manifest }`

**新增 IPC（在 `index.ts` 中）：**

- `skills:installFromScript` — 调用 wrapSingleFile + installFromDirectory

**新增 Preload 方法：**

- `skills.installFromScript(filePath, meta?)` — 暴露给渲染进程

**测试先行 `skill-wrapper.test.ts`（~7 个用例）：**

- WRAP-001~003 inferRuntime 各扩展名
- WRAP-004 未知扩展名返回 null
- WRAP-005 成功生成 skill.json
- WRAP-006 文件不存在返回错误
- WRAP-007 manifest 字段正确

**验证：**

```bash
pnpm vitest run apps/windows/src/main/skill-wrapper.test.ts
```

---

## 依赖关系

```
批次 1 (PythonRunner)  ──┐
                          ├──> 批次 3 (store + runtime) ──> 批次 4 (IPC)
批次 2 (ShellRunner)   ──┘                                      │
                                                                 │
                          批次 5 (skill-wrapper) ────────────────┘
```

批次 1 和 2 可并行；批次 5 可与批次 4 并行。

## 关键复用

| 已有组件                               | 路径               | 行号       | 复用方式                              |
| -------------------------------------- | ------------------ | ---------- | ------------------------------------- |
| `RunnerOptions` / `RunnerResult`       | `ts-runner.ts`     | L26-59     | PythonRunner、ShellRunner 直接 import |
| `extractResult` / `RESULT_PREFIX`      | `ts-runner.ts`     | L244, L267 | 所有 Runner 共享结果提取              |
| `LocalSkillStore.installFromDirectory` | `skill-store.ts`   | L123       | IPC 安装链终点                        |
| `ClientSkillRuntime.executeSkill`      | `skill-runtime.ts` | L406       | IPC 执行链终点                        |
| `SkillManifest` / `SkillIndexEntry`    | `skill-store.ts`   | L22, L55   | 类型定义共享                          |

## 全量验证

```bash
# 所有 main 进程测试
pnpm vitest run apps/windows/src/main/

# TypeScript 编译检查
cd apps/windows && npx tsc --noEmit
```

---

## 进度跟踪

| 批次                    | 状态    | 测试数 | 备注                      |
| ----------------------- | ------- | ------ | ------------------------- |
| 1. PythonRunner         | ✅ 完成 | 8      | 2026-02-23 全部通过       |
| 2. ShellRunner          | ✅ 完成 | 7      | 2026-02-23 全部通过       |
| 3. store + runtime 扩展 | ✅ 完成 | +3     | 2026-02-23 全部通过       |
| 4. IPC 接口             | ✅ 完成 | —      | 2026-02-23 TypeCheck 通过 |
| 5. 单文件包装           | ✅ 完成 | 7      | 2026-02-23 全部通过       |

> Phase 2 全部完成：14 个测试文件通过，240 个测试用例全绿。后续进入 Phase 3。
