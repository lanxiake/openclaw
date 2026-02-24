# 阶段七：API Client 类型扩展

## 目标

在 `packages/api-client` 中添加记忆管理相关的类型定义和 API 方法。

## 文件改动

### 1. 修改 `packages/api-client/src/admin/types.ts`

新增类型定义：

```typescript
// ========== 记忆概览 ==========

export interface UserMemoryOverview {
  factsCount: number;
  patternsCount: number;
  hasPreferences: boolean;
  workspaceFilesCount: number;
  customWorkspaceFilesCount: number;
  lastUpdatedAt: string | null;
}

// ========== 用户事实 ==========

export interface UserMemoryFact {
  id: string;
  userId: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserMemoryFactListParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

export interface UpdateUserMemoryFactParams {
  value?: string;
  confidence?: number;
  category?: string;
}

// ========== 用户偏好 ==========

export interface UserMemoryPreferences {
  id: string;
  userId: string;
  language: string;
  responseStyle: string;
  // ... 其他偏好字段
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserMemoryPreferencesParams {
  language?: string;
  responseStyle?: string;
  // ... 其他可更新字段
}

// ========== 行为模式 ==========

export interface UserMemoryPattern {
  id: string;
  userId: string;
  type: string;
  pattern: string;
  confidence: number;
  confirmed: boolean;
  evidence: string[];
  createdAt: string;
  updatedAt: string;
}

// ========== Workspace 文件 ==========

export interface UserWorkspaceFile {
  fileName: string;
  content: string;
  source: "user" | "template"; // user=用户自定义, template=系统默认
  updatedAt: string;
}

export interface UpdateUserWorkspaceFileParams {
  content: string;
}

// ========== 系统模板 ==========

export interface WorkspaceTemplate {
  id: string;
  fileName: string;
  content: string;
  description: string | null;
  isActive: boolean;
  version: number;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWorkspaceTemplateParams {
  content: string;
  description?: string;
}

// ========== 审计日志 ==========

export interface MemoryAuditLog {
  id: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  source: string;
  sessionId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface MemoryAuditLogListParams {
  page?: number;
  limit?: number;
  action?: string;
  targetType?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
}

// ========== 导出 ==========

export interface UserMemoryExport {
  userId: string;
  exportedAt: string;
  facts: UserMemoryFact[];
  preferences: UserMemoryPreferences | null;
  patterns: UserMemoryPattern[];
  workspaceFiles: UserWorkspaceFile[];
  auditLogs: MemoryAuditLog[];
}
```

### 2. 修改 `packages/api-client/src/admin/client.ts`

新增方法：

```typescript
class AdminApiClient {
  // ========== 用户记忆管理 ==========

  /** 获取用户记忆概览 */
  async getUserMemoryOverview(userId: string): Promise<UserMemoryOverview>;

  /** 获取用户事实列表 */
  async getUserMemoryFacts(
    userId: string,
    params?: UserMemoryFactListParams,
  ): Promise<PaginatedResponse<UserMemoryFact>>;

  /** 更新用户事实 */
  async updateUserMemoryFact(
    userId: string,
    factId: string,
    params: UpdateUserMemoryFactParams,
  ): Promise<UserMemoryFact>;

  /** 删除用户事实 */
  async deleteUserMemoryFact(userId: string, factId: string): Promise<void>;

  /** 获取用户偏好 */
  async getUserMemoryPreferences(userId: string): Promise<UserMemoryPreferences | null>;

  /** 更新用户偏好 */
  async updateUserMemoryPreferences(
    userId: string,
    params: UpdateUserMemoryPreferencesParams,
  ): Promise<UserMemoryPreferences>;

  /** 获取用户行为模式 */
  async getUserMemoryPatterns(userId: string): Promise<UserMemoryPattern[]>;

  /** 删除用户行为模式 */
  async deleteUserMemoryPattern(userId: string, patternId: string): Promise<void>;

  /** 获取用户 workspace 文件列表 */
  async getUserWorkspaceFiles(userId: string): Promise<UserWorkspaceFile[]>;

  /** 更新用户 workspace 文件 */
  async updateUserWorkspaceFile(
    userId: string,
    fileName: string,
    params: UpdateUserWorkspaceFileParams,
  ): Promise<UserWorkspaceFile>;

  /** 删除用户 workspace 文件（恢复为默认） */
  async deleteUserWorkspaceFile(userId: string, fileName: string): Promise<void>;

  /** 获取用户审计日志 */
  async getUserMemoryAuditLogs(
    userId: string,
    params?: MemoryAuditLogListParams,
  ): Promise<PaginatedResponse<MemoryAuditLog>>;

  /** 导出用户完整画像 */
  async exportUserMemory(userId: string): Promise<UserMemoryExport>;

  // ========== 系统模板管理 ==========

  /** 获取所有系统模板 */
  async getWorkspaceTemplates(): Promise<WorkspaceTemplate[]>;

  /** 获取单个系统模板 */
  async getWorkspaceTemplate(fileName: string): Promise<WorkspaceTemplate>;

  /** 更新系统模板 */
  async updateWorkspaceTemplate(
    fileName: string,
    params: UpdateWorkspaceTemplateParams,
  ): Promise<WorkspaceTemplate>;

  /** 重置系统模板为出厂默认值 */
  async resetWorkspaceTemplate(fileName: string): Promise<WorkspaceTemplate>;
}
```

## 验证

```bash
cd packages/api-client && pnpm build
```

### 验证要点

- TypeScript 编译通过
- 类型导出正确
- API 方法签名与阶段六的路由匹配
