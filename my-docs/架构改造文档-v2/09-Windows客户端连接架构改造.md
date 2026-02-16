# Windows 客户端连接架构改造详细设计

> 版本: 1.1 | 创建日期: 2026-02-16 | 状态: 代码实施完成

---

## 修订记录

| 版本 | 日期       | 修订内容                       |
| ---- | ---------- | ------------------------------ |
| 1.1  | 2026-02-16 | 代码实施完成，更新实施步骤进度 |
| 1.0  | 2026-02-16 | 初始版本                       |

---

## 1. 背景

当前 Windows 客户端的认证和设备配对全部通过 Gateway WebSocket RPC 实现。按照新架构要求：

- **认证业务**（登录、注册、Token 刷新）应走 API Server HTTP 接口
- **设备配对**应走 API Server HTTP 接口
- **实时通信**（聊天、消息收发）保留在 Gateway WebSocket

## 2. 当前架构问题

```
当前流程（全部走 Gateway）：
┌─────────────────────────────────────────────────────────────┐
│ 启动 → 主进程 initGatewayClient() → 连接 Gateway            │
│                                                             │
│ 渲染进程 → useAuth.login() → gateway.call('auth.login')    │
│         → 登录成功 → 自动连接 Gateway（带 token）           │
│                                                             │
│ 问题：Gateway 未启动时，登录功能完全不可用                   │
└─────────────────────────────────────────────────────────────┘
```

## 3. 目标架构

```
新流程（认证走 API Server，实时通信走 Gateway）：
┌─────────────────────────────────────────────────────────────┐
│ 启动 → 主进程不连接 Gateway，等待用户登录                    │
│                                                             │
│ 渲染进程 → useAuth.login() → HTTP POST /api/auth/login     │
│         → 登录成功 → 检查设备绑定状态                        │
│         → 设备未绑定 → HTTP POST /api/devices/pair-request  │
│         → 设备已绑定 → 连接 Gateway（带 accessToken）        │
│                                                             │
│ 优势：Gateway 离线时，用户仍可登录和管理账户                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 改造范围

### 4.1 认证接口（Gateway RPC → API Server HTTP）

| 当前实现                            | 改造后                     | 状态     |
| ----------------------------------- | -------------------------- | -------- |
| `gateway.call('auth.login')`        | `POST /api/auth/login`     | API 已有 |
| `gateway.call('auth.register')`     | `POST /api/auth/register`  | API 已有 |
| `gateway.call('auth.refreshToken')` | `POST /api/auth/refresh`   | API 已有 |
| `gateway.call('auth.logout')`       | `POST /api/auth/logout`    | API 已有 |
| `gateway.call('auth.sendCode')`     | `POST /api/auth/send-code` | API 已有 |

### 4.2 设备配对接口（Gateway RPC → API Server HTTP）

| 当前实现                                  | 改造后                                    | 状态     |
| ----------------------------------------- | ----------------------------------------- | -------- |
| `gateway.call('device.requestPairing')`   | `POST /api/devices/pair-request`          | API 已有 |
| `gateway.call('device.pairWithCode')`     | 需新增或复用 pair-request                 | 待确认   |
| `gateway.call('device.getPairingStatus')` | `GET /api/devices/pair-status/:requestId` | 需新增   |

### 4.3 用户自服务接口（新增调用）

| 接口                        | 用途             | 状态     |
| --------------------------- | ---------------- | -------- |
| `GET /api/users/me`         | 获取当前用户信息 | API 已有 |
| `GET /api/users/me/devices` | 获取用户设备列表 | API 已有 |
| `PUT /api/users/me`         | 更新用户信息     | API 已有 |

### 4.4 保留在 Gateway（不改动）

- `chat.sendMessage` / `chat.listHistory` — 实时聊天
- `assistant.confirm.*` — 操作确认
- `skill.*` — 技能执行
- 所有实时事件推送

---

## 5. 详细设计

### 5.1 Phase 1: 新增 API Server HTTP 客户端

**新建文件：** `apps/windows/src/main/api-client.ts`

```typescript
/**
 * API Server HTTP 客户端
 *
 * 用于调用 API Server 的 REST 接口
 * 支持认证、设备配对、用户自服务等业务
 */

export interface ApiClientConfig {
  baseUrl: string; // 默认 http://localhost:3000
  timeout: number; // 默认 30000ms
}

export class ApiClient {
  private config: ApiClientConfig;
  private accessToken: string | null = null;

  constructor(config: Partial<ApiClientConfig> = {});

  setAccessToken(token: string | null): void;
  getAccessToken(): string | null;

  // 认证接口
  async login(params: LoginParams): Promise<AuthResponse>;
  async register(params: RegisterParams): Promise<AuthResponse>;
  async refreshToken(refreshToken: string): Promise<AuthResponse>;
  async logout(refreshToken: string): Promise<void>;
  async sendVerificationCode(params: SendCodeParams): Promise<SendCodeResponse>;

  // 设备配对接口
  async requestDevicePairing(params: PairRequestParams): Promise<PairRequestResponse>;
  async checkPairingStatus(requestId: string): Promise<PairingStatusResponse>;

  // 用户自服务接口
  async getCurrentUser(): Promise<UserResponse>;
  async getUserDevices(): Promise<DevicesResponse>;
  async updateUser(params: UpdateUserParams): Promise<UserResponse>;

  // 通用请求方法
  private async request<T>(method: string, path: string, body?: unknown): Promise<T>;
}
```

### 5.2 Phase 2: 新增 Preload API 桥接

**修改文件：** `apps/windows/src/preload/index.ts`

新增 `api` 命名空间：

```typescript
export interface ElectronAPI {
  // ... 现有 gateway, file, system 等

  // 新增：API Server HTTP 调用
  api: {
    // 认证
    login: (params: LoginParams) => Promise<AuthResponse>;
    register: (params: RegisterParams) => Promise<AuthResponse>;
    refreshToken: (refreshToken: string) => Promise<AuthResponse>;
    logout: (refreshToken: string) => Promise<void>;
    sendCode: (params: SendCodeParams) => Promise<SendCodeResponse>;

    // 设备配对
    requestPairing: (params: PairRequestParams) => Promise<PairRequestResponse>;
    checkPairingStatus: (requestId: string) => Promise<PairingStatusResponse>;

    // 用户
    getCurrentUser: () => Promise<UserResponse>;
    getUserDevices: () => Promise<DevicesResponse>;
    updateUser: (params: UpdateUserParams) => Promise<UserResponse>;

    // 配置
    setBaseUrl: (url: string) => Promise<void>;
    getBaseUrl: () => Promise<string>;
  };
}
```

### 5.3 Phase 3: 主进程 IPC 处理器

**修改文件：** `apps/windows/src/main/index.ts`

新增 API 相关 IPC 处理器：

```typescript
// API Server 客户端实例
let apiClient: ApiClient | null = null;

async function initApiClient(): Promise<void> {
  log.info("初始化 API Server 客户端");
  apiClient = new ApiClient({
    baseUrl: "http://localhost:3000",
  });
}

function setupApiIpcHandlers(): void {
  // 认证
  ipcMain.handle("api:login", async (_event, params) => {
    return apiClient!.login(params);
  });

  ipcMain.handle("api:register", async (_event, params) => {
    return apiClient!.register(params);
  });

  // ... 其他处理器
}
```

### 5.4 Phase 4: 修改主进程启动流程

**修改文件：** `apps/windows/src/main/index.ts`

```typescript
async function initialize(): Promise<void> {
  // ... 现有初始化

  // 新增：初始化 API 客户端（不需要网络连接）
  await initApiClient();
  setupApiIpcHandlers();

  // 修改：不再自动连接 Gateway，等待用户登录后再连接
  // await initGatewayClient()  // 移除自动连接
  initGatewayClientLazy(); // 改为懒初始化
}
```

### 5.5 Phase 5: 修改渲染进程 useAuth Hook

**修改文件：** `apps/windows/src/renderer/hooks/useAuth.ts`

```typescript
const login = useCallback(async (params: LoginParams) => {
  // 改为调用 API Server HTTP 接口
  const response = await window.electronAPI.api.login(params);
  // ...
}, []);
```

### 5.6 Phase 6: 修改 App.tsx 连接流程

**修改文件：** `apps/windows/src/renderer/App.tsx`

```typescript
useEffect(() => {
  if (isAuthenticated && accessToken && !isConnected) {
    // 新增：检查设备绑定状态
    checkDeviceBindingAndConnect();
  }
}, [isAuthenticated, accessToken, isConnected]);
```

---

## 6. 文件清单

| 操作 | 文件路径                                            | 说明                       |
| ---- | --------------------------------------------------- | -------------------------- |
| 新建 | `apps/windows/src/main/api-client.ts`               | API Server HTTP 客户端     |
| 修改 | `apps/windows/src/main/index.ts`                    | 主进程启动流程、IPC 处理器 |
| 修改 | `apps/windows/src/preload/index.ts`                 | 新增 api 命名空间          |
| 修改 | `apps/windows/src/renderer/hooks/useAuth.ts`        | 改用 API Server 接口       |
| 修改 | `apps/windows/src/renderer/App.tsx`                 | 设备绑定检查流程           |
| 修改 | `apps/windows/src/renderer/components/AuthView.tsx` | 登录/注册表单调用          |

---

## 7. 实施步骤

### Step 1: 创建 API 客户端基础设施 ✅ 已完成

1. ✅ 新建 `api-client.ts` — 完整的 API Server HTTP 客户端
2. ✅ 实现基础 HTTP 请求方法 — 支持超时、错误处理、自动 Authorization header
3. ✅ 实现认证接口（login, register, refresh, logout, sendCode）
4. ✅ 实现设备配对接口（requestPairing, checkPairingStatus）
5. ✅ 实现用户自服务接口（getCurrentUser, getUserDevices, updateUser）
6. ✅ 编写单元测试 — 21 个测试用例全部通过

### Step 2: 集成到主进程 ✅ 已完成

1. ✅ 修改 `index.ts` 添加 `initApiClient()` 初始化
2. ✅ 添加 `setupApiIpcHandlers()` — 17 个 IPC 处理器
3. ✅ 修改启动流程：`initGatewayClient()` → `initGatewayClientLazy()`

### Step 3: 修改 Preload 脚本 ✅ 已完成

1. ✅ 在 `ElectronAPI` 类型定义中添加 `api` 命名空间
2. ✅ 在 `electronAPI` 实现中暴露所有 API 调用方法

### Step 4: 修改渲染进程 ✅ 已完成

1. ✅ 修改 `useAuth.ts` — login/register/logout/refreshToken 改为 API Server 调用
2. ✅ 修改 `App.tsx` — 更新 Gateway 连接注释说明新流程
3. ✅ `AuthView.tsx` 无需修改 — 它调用 useAuth 的方法，底层已切换

### Step 5: 测试验证 ✅ 已完成

1. ✅ API 客户端单元测试：21 个测试全部通过
2. ✅ Windows 子项目全量测试：11 个测试文件、200 个测试全部通过
3. ⬜ E2E 测试：待后续完整环境中验证

---

## 8. 兼容性考虑

1. **Gateway 离线场景**
   - 用户可正常登录、注册、管理账户
   - 聊天功能不可用（显示离线提示）

2. **API Server 离线场景**
   - 登录功能不可用
   - 已登录用户可使用本地缓存的 Token 连接 Gateway

3. **Token 一致性**
   - API Server 和 Gateway 使用相同的 JWT 签名密钥
   - `accessToken` 可同时用于 API Server 和 Gateway 认证

---

## 9. 风险与缓解

| 风险                                     | 缓解措施                        |
| ---------------------------------------- | ------------------------------- |
| API Server 接口格式与 Gateway RPC 不一致 | 在 API 客户端层做格式转换       |
| 设备配对流程复杂度增加                   | 保持与现有 Gateway 配对流程兼容 |
| 用户体验变化                             | 保持 UI 不变，仅改变底层调用    |
| Token 刷新时机                           | 在 API 客户端层实现自动刷新     |

---

## 10. 验证清单

- [ ] API Server 启动，Gateway 未启动 → 用户可登录
- [ ] 登录成功后自动检查设备绑定状态
- [ ] 设备未绑定时自动发起配对请求
- [ ] 配对成功后自动连接 Gateway
- [ ] Token 过期时自动刷新
- [ ] 登出时清除本地状态并断开 Gateway
- [ ] 错误处理和用户提示正常
