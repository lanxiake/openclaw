# 10f - 前端 API 迁移方案

> 版本: 1.0 | 创建日期: 2026-02-12 | 状态: 规划中
>
> 上级文档: [10-多租户架构改造总体方案.md](./10-多租户架构改造总体方案.md)
>
> 参考文档: [10c-AppServer设计方案.md](./10c-AppServer设计方案.md)

---

## 1. 现状分析

### 1.1 前端应用清单

| 应用           | 目录                  | 框架             | 当前 API 方式               |
| -------------- | --------------------- | ---------------- | --------------------------- |
| web-admin      | `apps/web-admin/`     | React + Vite     | Gateway WebSocket           |
| admin-console  | `apps/admin-console/` | React + Vite     | Gateway WebSocket           |
| Windows 客户端 | `apps/windows/`       | Electron + React | Gateway WebSocket (via IPC) |

### 1.2 现有通信架构

```
web-admin / admin-console (浏览器)
    ↓ WebSocket
    ↓ ws://localhost:18789
    ↓ OpenClaw Protocol v3 (JSON-RPC)
    ↓
Gateway
    ├── 处理 CRUD RPC (admin.users.list, admin.plans.create, ...)
    └── 处理实时 RPC (chat.send, agent, nodes.*, ...)

Windows 客户端 (Electron)
    ↓ IPC Bridge
    ↓ Main 进程 GatewayClient
    ↓ WebSocket ws://localhost:18789
    ↓
Gateway
```

### 1.3 当前代码关键文件

| 应用          | 文件                            | 用途                  |
| ------------- | ------------------------------- | --------------------- |
| web-admin     | `src/lib/gateway-client.ts`     | WebSocket 客户端      |
| web-admin     | `src/lib/api.ts`                | HTTP 客户端（已存在） |
| web-admin     | `src/lib/constants.ts`          | Gateway URL 配置      |
| web-admin     | `src/hooks/use*.ts`             | React Query Hooks     |
| admin-console | `src/lib/gateway-client.ts`     | WebSocket 客户端      |
| admin-console | `src/lib/constants.ts`          | Gateway URL 配置      |
| admin-console | `src/hooks/use*.ts`             | React Query Hooks     |
| windows       | `src/main/gateway-client.ts`    | Node.js WebSocket     |
| windows       | `src/preload/index.ts`          | IPC API 暴露          |
| windows       | `src/renderer/hooks/useAuth.ts` | 认证 Hook             |

### 1.4 问题

| #   | 问题                               | 影响               |
| --- | ---------------------------------- | ------------------ |
| 1   | 所有 CRUD 操作走 WebSocket         | 无法利用 HTTP 缓存 |
| 2   | 每个应用维护独立 GatewayClient     | 代码重复           |
| 3   | WebSocket 不友好的浏览器开发者工具 | 调试困难           |
| 4   | Gateway 承载所有流量               | 性能瓶颈           |
| 5   | 认证 Token 在 RPC params 中传递    | 不符合 HTTP 标准   |

---

## 2. 目标架构

### 2.1 迁移后通信架构

```
web-admin / admin-console (浏览器)
    ├── HTTP REST → App Server (:3000)     ← CRUD 操作
    │   POST /api/admin/auth/login
    │   GET  /api/admin/users
    │   PUT  /api/admin/plans/:id
    │   ...
    │
    └── WebSocket → Gateway (:18789)       ← 实时操作（仅需要时）
        chat.send, agent, nodes.*, ...

Windows 客户端 (Electron)
    ├── HTTP REST → App Server (:3000)     ← CRUD 操作
    │   POST /api/auth/login
    │   GET  /api/users/me
    │   ...
    │
    └── WebSocket → Gateway (:18789)       ← 实时对话 + 设备控制
        chat.send, skill.execute, ...
```

### 2.2 职责分离

| 操作类型 | 走向              | 示例                     |
| -------- | ----------------- | ------------------------ |
| 认证     | HTTP → App Server | 登录、注册、Token 刷新   |
| 数据查询 | HTTP → App Server | 用户列表、订阅信息、配置 |
| 数据修改 | HTTP → App Server | 创建计划、编辑用户、上传 |
| 文件操作 | HTTP → App Server | 上传附件、下载文件       |
| 实时对话 | WS → Gateway      | AI 对话、流式响应        |
| 设备控制 | WS → Gateway      | 技能执行、命令下发       |
| 实时状态 | WS → Gateway      | 设备心跳、在线状态       |
| 事件订阅 | WS → Gateway      | 通知推送                 |

---

## 3. 共享 HTTP 客户端设计

### 3.1 创建共享包

新建共享 HTTP 客户端包，供所有前端应用引用：

```
packages/api-client/
├── src/
│   ├── index.ts                 # 导出入口
│   ├── client.ts                # HTTP 客户端核心
│   ├── auth.ts                  # 认证 Token 管理
│   ├── types.ts                 # API 请求/响应类型
│   ├── endpoints/
│   │   ├── auth.ts              # /api/auth/* 端点
│   │   ├── users.ts             # /api/users/* 端点
│   │   ├── conversations.ts     # /api/conversations/* 端点
│   │   ├── memories.ts          # /api/memories/* 端点
│   │   ├── files.ts             # /api/files/* 端点
│   │   ├── skills.ts            # /api/skills/* 端点
│   │   ├── store.ts             # /api/store/* 端点
│   │   ├── assistant-config.ts  # /api/assistant-configs/* 端点
│   │   └── admin/
│   │       ├── auth.ts          # /api/admin/auth/* 端点
│   │       ├── users.ts         # /api/admin/users/* 端点
│   │       ├── subscriptions.ts # /api/admin/subscriptions/* 端点
│   │       ├── plans.ts         # /api/admin/plans/* 端点
│   │       ├── skills.ts        # /api/admin/skills/* 端点
│   │       ├── audit.ts         # /api/admin/audit-logs 端点
│   │       ├── config.ts        # /api/admin/config 端点
│   │       ├── monitor.ts       # /api/admin/monitor/* 端点
│   │       ├── dashboard.ts     # /api/admin/dashboard 端点
│   │       └── analytics.ts     # /api/admin/analytics 端点
│   └── errors.ts                # 错误处理
├── package.json
└── tsconfig.json
```

### 3.2 HTTP 客户端核心

```typescript
// packages/api-client/src/client.ts

/**
 * OpenClaw API 客户端
 *
 * 封装 fetch，提供统一的请求/响应处理、
 * 自动 Token 刷新、错误处理
 */
export class ApiClient {
  private baseUrl: string;
  private tokenProvider: TokenProvider;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.tokenProvider = options.tokenProvider;
  }

  /**
   * 发送 GET 请求
   */
  async get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path, undefined, options);
  }

  /**
   * 发送 POST 请求
   */
  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, body, options);
  }

  /**
   * 发送 PUT 请求
   */
  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", path, body, options);
  }

  /**
   * 发送 DELETE 请求
   */
  async delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path, undefined, options);
  }

  /**
   * 核心请求方法
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const token = await this.tokenProvider.getAccessToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });

    // 401 时自动刷新 Token 并重试
    if (response.status === 401 && !options?.skipRetry) {
      const refreshed = await this.tokenProvider.refreshToken();
      if (refreshed) {
        return this.request<T>(method, path, body, { ...options, skipRetry: true });
      }
      // 刷新失败，触发登出
      this.tokenProvider.onAuthExpired?.();
      throw new AuthExpiredError("Session expired");
    }

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data.error ?? "Unknown error", data.code);
    }

    return data as ApiResponse<T>;
  }

  /**
   * 上传文件（multipart/form-data）
   */
  async upload<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const token = await this.tokenProvider.getAccessToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    // 不设置 Content-Type，让浏览器自动设置 multipart boundary

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(response.status, data.error ?? "Upload failed");
    }
    return data as ApiResponse<T>;
  }
}
```

### 3.3 Token 管理

```typescript
// packages/api-client/src/auth.ts

/**
 * Token 提供者接口
 *
 * 不同平台（浏览器/Electron）有不同的 Token 存储方式
 */
export interface TokenProvider {
  /** 获取当前 Access Token */
  getAccessToken(): Promise<string | null>;

  /** 刷新 Token */
  refreshToken(): Promise<boolean>;

  /** Token 过期回调（通常触发登出） */
  onAuthExpired?: () => void;
}

/**
 * 浏览器 Token 提供者
 *
 * 使用 localStorage 存储 Token
 */
export class BrowserTokenProvider implements TokenProvider {
  constructor(
    private readonly storagePrefix: string,
    private readonly refreshEndpoint: string,
    private readonly baseUrl: string,
  ) {}

  async getAccessToken(): Promise<string | null> {
    return localStorage.getItem(`${this.storagePrefix}_access_token`);
  }

  async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem(`${this.storagePrefix}_refresh_token`);
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}${this.refreshEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      localStorage.setItem(`${this.storagePrefix}_access_token`, data.data.accessToken);
      if (data.data.refreshToken) {
        localStorage.setItem(`${this.storagePrefix}_refresh_token`, data.data.refreshToken);
      }
      return true;
    } catch {
      return false;
    }
  }

  onAuthExpired = (): void => {
    localStorage.removeItem(`${this.storagePrefix}_access_token`);
    localStorage.removeItem(`${this.storagePrefix}_refresh_token`);
    window.location.href = "/login";
  };
}
```

### 3.4 端点封装示例

```typescript
// packages/api-client/src/endpoints/admin/users.ts

/**
 * 管理员用户管理 API
 */
export class AdminUsersApi {
  constructor(private readonly client: ApiClient) {}

  /**
   * 获取用户列表
   */
  async list(params?: {
    search?: string;
    status?: "active" | "inactive" | "all";
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<UserListData>> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.status) query.set("status", params.status);
    if (params?.page) query.set("page", params.page.toString());
    if (params?.pageSize) query.set("pageSize", params.pageSize.toString());

    const qs = query.toString();
    return this.client.get(`/api/admin/users${qs ? `?${qs}` : ""}`);
  }

  /**
   * 获取用户详情
   */
  async get(userId: string): Promise<ApiResponse<UserDetail>> {
    return this.client.get(`/api/admin/users/${userId}`);
  }

  /**
   * 停用用户
   */
  async suspend(userId: string, reason?: string): Promise<ApiResponse<void>> {
    return this.client.post(`/api/admin/users/${userId}/suspend`, { reason });
  }

  /**
   * 激活用户
   */
  async activate(userId: string): Promise<ApiResponse<void>> {
    return this.client.post(`/api/admin/users/${userId}/activate`);
  }
}
```

---

## 4. 各应用迁移方案

### 4.1 admin-console 迁移

admin-console 全部是管理后台 CRUD 操作，**可以 100% 迁移到 HTTP REST**。

#### 修改清单

| 文件                            | 改造内容                                                      |
| ------------------------------- | ------------------------------------------------------------- |
| `src/lib/constants.ts`          | 新增 `API_BASE_URL` 配置                                      |
| `src/lib/api-client.ts`         | 新建，引用 `@openclaw/api-client`                             |
| `src/hooks/useUsers.ts`         | `gateway.call('admin.users.list')` → `adminUsersApi.list()`   |
| `src/hooks/useConfig.ts`        | `gateway.call('admin.config.*')` → `adminConfigApi.*()`       |
| `src/hooks/useAuditLogs.ts`     | `gateway.call('admin.audit.*')` → `adminAuditApi.*()`         |
| `src/hooks/useDashboard.ts`     | `gateway.call('admin.dashboard.*')` → `adminDashboardApi.*()` |
| `src/hooks/useSkills.ts`        | `gateway.call('admin.skills.*')` → `adminSkillsApi.*()`       |
| `src/hooks/useSubscriptions.ts` | `gateway.call('admin.subscriptions.*')` → 对应 API            |
| `src/hooks/useMonitor.ts`       | `gateway.call('admin.monitor.*')` → `adminMonitorApi.*()`     |
| `src/stores/authStore.ts`       | 登录/登出改用 HTTP API                                        |
| `src/lib/gateway-client.ts`     | 迁移完成后移除                                                |

#### 迁移前后对比

```typescript
// 迁移前：WebSocket RPC
export function useUserList(query: UserListQuery = {}) {
  return useQuery({
    queryKey: ["admin", "users", "list", query],
    queryFn: async () => {
      const response = await gateway.call<UserListResponse>("admin.users.list", {
        ...query,
        accessToken: getAdminToken(),
      });
      return response;
    },
  });
}

// 迁移后：HTTP REST
export function useUserList(query: UserListQuery = {}) {
  return useQuery({
    queryKey: ["admin", "users", "list", query],
    queryFn: () => adminUsersApi.list(query),
  });
}
```

### 4.2 web-admin 迁移

web-admin 兼有管理功能和用户功能，需要**部分迁移**。

#### CRUD 操作 → HTTP REST

| Hook           | 迁移到                    |
| -------------- | ------------------------- |
| 用户管理 Hooks | `adminUsersApi.*`         |
| 订阅管理 Hooks | `adminSubscriptionsApi.*` |
| 技能管理 Hooks | `adminSkillsApi.*`        |
| 系统配置 Hooks | `adminConfigApi.*`        |
| 审计日志 Hooks | `adminAuditApi.*`         |

#### 保留 WebSocket

| 功能         | 保留原因                   |
| ------------ | -------------------------- |
| 实时对话界面 | 流式 AI 响应需要 WebSocket |
| 设备状态监控 | 实时心跳和状态更新         |
| 事件通知     | 推送通知                   |

### 4.3 Windows 客户端迁移

Windows 客户端需要**混合迁移**：

#### HTTP REST（通过 Main 进程）

| 功能          | 迁移方式                             |
| ------------- | ------------------------------------ |
| 用户登录/注册 | Main 进程 HTTP 请求 → IPC → Renderer |
| 用户信息查询  | 同上                                 |
| 对话历史列表  | 同上                                 |
| 记忆管理      | 同上                                 |
| 文件上传/下载 | Main 进程 HTTP + 本地文件系统        |

#### 保留 WebSocket

| 功能     | 保留原因       |
| -------- | -------------- |
| AI 对话  | 流式响应       |
| 技能执行 | 实时下发到设备 |
| 设备状态 | 心跳和连接管理 |
| 命令执行 | 远程命令交互   |

#### Preload 脚本更新

```typescript
// apps/windows/src/preload/index.ts — 更新

contextBridge.exposeInMainWorld("electronAPI", {
  // 保留 WebSocket 接口（实时操作）
  gateway: {
    call: <T>(method: string, params?: unknown) =>
      ipcRenderer.invoke("gateway:call", { method, params }),
    subscribe: (event: string, callback: (...args: unknown[]) => void) =>
      ipcRenderer.on(`gateway:event:${event}`, (_e, ...args) => callback(...args)),
  },

  // 新增 HTTP API 接口（CRUD 操作）
  api: {
    get: <T>(path: string) => ipcRenderer.invoke("api:get", path),
    post: <T>(path: string, body?: unknown) => ipcRenderer.invoke("api:post", { path, body }),
    put: <T>(path: string, body?: unknown) => ipcRenderer.invoke("api:put", { path, body }),
    delete: <T>(path: string) => ipcRenderer.invoke("api:delete", path),
    upload: <T>(path: string, filePath: string) =>
      ipcRenderer.invoke("api:upload", { path, filePath }),
  },
});
```

---

## 5. 迁移顺序

### Phase 6a: 共享 API 客户端

1. 创建 `packages/api-client/` workspace 包
2. 实现 `ApiClient` 核心 + `TokenProvider` 接口
3. 实现 `BrowserTokenProvider`（web-admin / admin-console 用）
4. 实现所有 API 端点封装（admin/_, auth/_, users/\*, ...）
5. 单元测试

### Phase 6b: admin-console 迁移

1. `package.json` 引入 `@openclaw/api-client`
2. 新建 `src/lib/api-client.ts` 初始化客户端实例
3. 逐个 Hook 文件迁移：`gateway.call()` → `api.*.*()` 调用
4. 认证流程迁移（登录/登出/Token 刷新）
5. 移除 `gateway-client.ts` 和 WebSocket 依赖
6. 全面回归测试

### Phase 6c: web-admin 迁移

1. `package.json` 引入 `@openclaw/api-client`
2. CRUD Hook 迁移（与 admin-console 类似）
3. 保留 WebSocket 客户端（用于实时对话和设备状态）
4. 回归测试

### Phase 6d: Windows 客户端迁移

1. Main 进程新增 HTTP 客户端 + IPC Handler
2. Preload 脚本增加 `api` 接口
3. Renderer Hook 迁移 CRUD 调用到 HTTP
4. 保留 WebSocket 用于实时功能
5. 回归测试

### Phase 6e: Gateway RPC 清理

1. 确认所有前端已完成迁移
2. Gateway 中已迁移的 RPC 方法标记 deprecated 日志
3. 观察一段时间确认无调用后移除代码

---

## 6. 环境变量配置

### admin-console

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3000    # App Server 地址

# .env.production
VITE_API_BASE_URL=https://api.openclaw.example.com
```

### web-admin

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3000    # App Server（CRUD）
VITE_GATEWAY_WS_URL=ws://localhost:18789   # Gateway（实时）

# .env.production
VITE_API_BASE_URL=https://api.openclaw.example.com
VITE_GATEWAY_WS_URL=wss://ws.openclaw.example.com
```

### Windows 客户端

```bash
# 启动配置
API_BASE_URL=http://localhost:3000
GATEWAY_WS_URL=ws://localhost:18789
```

---

## 7. 验收标准

| #   | 标准                                             | 验证方式 |
| --- | ------------------------------------------------ | -------- |
| 1   | `@openclaw/api-client` 包可独立构建和测试        | 单元测试 |
| 2   | admin-console 全部使用 HTTP REST API             | E2E 测试 |
| 3   | web-admin CRUD 操作使用 HTTP，对话使用 WebSocket | E2E 测试 |
| 4   | Windows 客户端 CRUD + 实时功能均正常             | 手动测试 |
| 5   | Token 自动刷新和过期登出正常                     | E2E 测试 |
| 6   | 浏览器开发者工具可见 HTTP 请求（便于调试）       | 手动验证 |
| 7   | Gateway 移除迁移后的 RPC 方法，不影响功能        | 回归测试 |

---

_— 文档结束 —_
