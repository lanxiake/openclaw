# Phase 2: Admin Console 页面变更

## 1. 新增 SkillEditPage.tsx

文件: `apps/admin-console/src/pages/skills/SkillEditPage.tsx`

### 功能

- 路由: `/skills/new` (创建) 和 `/skills/:id/edit` (编辑)
- 表单字段:
  - 名称 (必填)
  - 描述
  - 详细说明 (Markdown, textarea)
  - 版本号
  - 分类 (下拉选择)
  - 标签 (多选/输入)
  - 订阅级别 (下拉: free/pro/team/enterprise)
  - 图标 URL
- 文件上传区域:
  - 拖拽上传 .wasm/.zip 文件
  - 显示文件大小、SHA-256 哈希
  - 上传进度条
- 底部操作:
  - 保存草稿
  - 保存并发布

### 交互流程

```
创建模式:
1. 填写表单 → POST /api/admin/skills → 获得 skillId
2. 上传文件 → POST /api/admin/skills/:id/upload-package
3. 可选: 发布 → POST /api/admin/skills/:id/publish

编辑模式:
1. 加载已有数据 → GET /api/admin/skills/:id
2. 修改表单 → PUT /api/admin/skills/:id
3. 可选: 重新上传文件
```

## 2. 修改 SkillsPage.tsx

### 新增功能

- 表头增加"新建技能"按钮，跳转到 `/skills/new`
- 列表操作列增加:
  - "编辑" → 跳转到 `/skills/:id/edit`
  - "删除" → 确认弹窗 → `DELETE /api/admin/skills/:id`
- 列表新增"类型"列，显示"系统"/"用户" 标签

## 3. hooks/useSkills.ts 补充

将现有 stub 实现替换为真实 API 调用:

```typescript
/** 创建系统技能 */
useCreateSkill(); // POST /api/admin/skills

/** 更新技能 */
useUpdateSkill(); // PUT /api/admin/skills/:id

/** 删除技能 */
useDeleteSkill(); // DELETE /api/admin/skills/:id

/** 上传技能包 */
useUploadPackage(); // POST /api/admin/skills/:id/upload-package
```

## 4. 路由注册

在 `apps/admin-console/src/routes/index.tsx` 中:

```typescript
{ path: "/skills/new", element: <SkillEditPage /> },
{ path: "/skills/:id/edit", element: <SkillEditPage /> },
```

## 5. API Client 扩展

在 `packages/api-client/src/admin/client.ts` 中新增方法:

```typescript
/** 创建系统技能 */
createSkill(data: CreateSkillRequest): Promise<{ id: string }>

/** 更新技能 */
updateSkill(id: string, data: UpdateSkillRequest): Promise<void>

/** 删除技能 */
deleteSkill(id: string): Promise<void>

/** 上传技能包 */
uploadSkillPackage(id: string, file: File): Promise<UploadResult>
```
