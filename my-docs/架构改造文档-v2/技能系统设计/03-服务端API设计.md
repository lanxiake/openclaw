# Phase 1: 服务端 API 设计

## 1. Admin REST API 扩展

文件: `apps/api-server/src/routes/admin/skills.ts`

### 现有端点（不改动）

```
GET    /api/admin/skills              ✅ 技能列表
GET    /api/admin/skills/stats        ✅ 统计数据
GET    /api/admin/skills/featured     ✅ 推荐列表
GET    /api/admin/skills/categories   ✅ 分类列表
GET    /api/admin/skills/:id          ✅ 技能详情
POST   /api/admin/skills/:id/review   ✅ 审核
POST   /api/admin/skills/:id/publish  ✅ 发布
POST   /api/admin/skills/:id/unpublish ✅ 下架
POST   /api/admin/skills/:id/featured ✅ 推荐设置
```

### 新增端点

| 方法   | 端点                                   | 权限          | 用途         |
| ------ | -------------------------------------- | ------------- | ------------ |
| POST   | `/api/admin/skills`                    | `skills.edit` | 创建系统技能 |
| PUT    | `/api/admin/skills/:id`                | `skills.edit` | 编辑系统技能 |
| DELETE | `/api/admin/skills/:id`                | `skills.edit` | 删除系统技能 |
| POST   | `/api/admin/skills/:id/upload-package` | `skills.edit` | 上传技能包   |

### POST /api/admin/skills — 创建系统技能

请求体:

```typescript
{
  name: string;              // 必填
  description?: string;
  readme?: string;
  version?: string;          // 默认 "1.0.0"
  categoryId?: string;
  tags?: string[];
  subscriptionLevel?: "free" | "pro" | "team" | "enterprise";  // 默认 "free"
  iconUrl?: string;
  config?: Record<string, unknown>;
}
```

处理逻辑:

1. 从 admin session 获取 `adminId`
2. 调用 `skill-service.createSkill()` 并设置 `sourceType="system"`, `isSystem=true`, `createdByAdminId=adminId`
3. 返回创建的技能 ID

### PUT /api/admin/skills/:id — 编辑

请求体: 同创建，所有字段可选。

处理逻辑:

1. 确认技能存在且 `isSystem=true`
2. 调用 `skill-service.updateSkill()`

### DELETE /api/admin/skills/:id — 删除

处理逻辑:

1. 确认技能存在且 `isSystem=true`
2. 检查是否有用户安装（有则拒绝或下架）
3. 调用 `skill-service.deleteSkill()`

### POST /api/admin/skills/:id/upload-package — 上传技能包

请求: `multipart/form-data`，字段 `package` 为文件

处理逻辑:

1. 接收文件 (限制大小 50MB)
2. 计算 SHA-256 哈希
3. 上传到 MinIO: `skills/{skillId}/{version}/{filename}`
4. 更新 `skill_store_items`: `wasmPackageKey`, `wasmPackageHash`, `wasmPackageSize`
5. 返回上传信息

## 2. Store REST API 实现

文件: `apps/api-server/src/routes/store/index.ts`

### 现有端点（实现真实逻辑替换 stub）

#### POST /api/store/skills/:id/install — 安装技能

当前状态: stub（`Sprint 11 实现`注释）

实现逻辑:

```
1. 获取当前用户 (认证)
2. 查询 skill_store_items 确认:
   - 技能存在
   - status = "published"
3. 检查 user_installed_skills 是否已安装
   - 已安装 → 返回 { success: true, message: "已安装" }
4. 插入 user_installed_skills 记录:
   - userId, skillItemId, installedVersion, isEnabled=true
5. 更新 skill_store_items.downloadCount++
6. 返回 { success: true, skill: {...}, downloadUrl: "/api/store/skills/:id/download" }
```

#### DELETE /api/store/skills/:id/install — 卸载技能

当前状态: stub

实现逻辑:

```
1. 获取当前用户
2. 删除 user_installed_skills 中对应记录
3. 返回 { success: true }
```

### 新增端点

#### GET /api/store/skills/:id/download — 下载技能包

```
1. 验证用户认证
2. 查询 user_installed_skills 确认已安装
3. 查询 skill_store_items 获取 wasmPackageKey
4. 从 MinIO 读取文件
5. 设置响应头:
   - Content-Type: application/octet-stream
   - Content-Disposition: attachment; filename="..."
   - X-Package-Hash: {SHA-256}
6. 流式返回文件内容
```

#### GET /api/store/skills/installed — 获取已安装技能列表

```
1. 获取当前用户
2. 查询 user_installed_skills JOIN skill_store_items
3. 返回已安装技能列表
```

## 3. skill-service.ts 扩展

在 `src/assistant/skills/skill-service.ts` 中新增:

```typescript
/** 上传技能包到 MinIO */
async function uploadSkillPackage(
  skillId: string,
  version: string,
  fileBuffer: Buffer,
  filename: string,
): Promise<{ key: string; hash: string; size: number }>;

/** 获取用户已安装的技能列表 */
async function getUserInstalledSkills(userId: string): Promise<UserInstalledSkillWithDetail[]>;

/** 安装技能 (写 DB 记录) */
async function installSkillForUser(
  userId: string,
  skillItemId: string,
): Promise<{ success: boolean; message: string }>;

/** 卸载技能 (删 DB 记录) */
async function uninstallSkillForUser(
  userId: string,
  skillItemId: string,
): Promise<{ success: boolean }>;
```

## 4. MinIO 集成

使用项目中已有的 MinIO/对象存储客户端（如有），或新建轻量封装:

```typescript
// src/assistant/skills/package-storage.ts

/** 上传技能包到对象存储 */
export async function uploadPackage(key: string, data: Buffer): Promise<void>;

/** 下载技能包 */
export async function downloadPackage(key: string): Promise<Buffer>;

/** 删除技能包 */
export async function deletePackage(key: string): Promise<void>;

/** 生成存储键 */
export function makePackageKey(skillId: string, version: string, filename: string): string {
  return `skills/${skillId}/${version}/${filename}`;
}
```
