# 合并 Web Admin 到 Windows 客户端 - 迁移方案

> 决策日期: 2026-02-20
> 分支: feat/ai-assistant-platform
> 状态: 规划中

## 1. 背景与目标

### 1.1 现状问题

项目中存在三个前端应用，其中 Web Admin 和 Windows 客户端功能重叠度约 40%：

| 应用                                      | 用户群体          | 技术栈                                    |
| ----------------------------------------- | ----------------- | ----------------------------------------- |
| **Web Admin** (`apps/web-admin/`)         | 普通用户 + 管理员 | React + Vite + shadcn/ui + TanStack Query |
| **Admin Console** (`apps/admin-console/`) | 平台运营          | React + Vite + shadcn/ui + TanStack Query |
| **Windows Client** (`apps/windows/`)      | 个人用户          | Electron + React + 自定义 CSS             |

重叠模块：认证、订阅管理、技能管理/商店、审计日志、设备管理、个人设置。

### 1.2 决策

- **移除 Web Admin**，将其面向普通用户的功能迁移到 Windows 客户端
- **管理员专属功能**（用户管理、审计日志、系统监控）保留在 Admin Console 中
- **迁移方式**：直接迁移组件到 Windows renderer，统一为当前 Windows 的 React + CSS 方案

### 1.3 目标

1. 消除 Web Admin 与 Windows 客户端之间的代码重复
2. Windows 客户端成为面向终端用户的唯一客户端入口
3. Admin Console 保持为纯运营管理后台
4. 保持小步迭代，每个阶段可独立测试和验证

---

## 2. 迁移范围分析

### 2.1 Web Admin 功能分类

#### 需要迁移的用户功能（7 个页面）

| Web Admin 页面   | 路由                 | Windows 现状                       | 迁移策略     |
| ---------------- | -------------------- | ---------------------------------- | ------------ |
| DashboardPage    | `/`                  | 无对应视图                         | **新增**     |
| DevicesPage      | `/devices`           | DeviceManagementView（仅配对流程） | **增强**     |
| DeviceDetailPage | `/devices/:id`       | 无                                 | **新增**     |
| SkillStorePage   | `/skills`            | SkillStoreView（更完整）           | **对齐补全** |
| MySkillsPage     | `/skills/my`         | SkillsView（更完整）               | **对齐补全** |
| SubscriptionPage | `/subscription`      | SubscriptionView（更完整）         | **对齐补全** |
| ProfilePage      | `/settings`          | SettingsView（部分覆盖）           | **增强**     |
| SecurityPage     | `/settings/security` | SettingsView（部分覆盖）           | **增强**     |

#### 不迁移的管理员功能（保留在 Admin Console）

| 页面                 | 路由            | 权限要求      | 说明         |
| -------------------- | --------------- | ------------- | ------------ |
| UsersPage            | `/admin/users`  | operator.read | 用户管理     |
| AuditLogPage         | `/admin/audit`  | operator.read | 审计日志     |
| SystemMonitorPage    | `/admin/system` | operator.read | 系统监控     |
| Dashboard 管理员部分 | `/`（条件渲染） | operator.read | 系统概览统计 |

### 2.2 逐模块差异分析

#### 模块 1: Dashboard（新增）

**Web Admin 现有功能：**

- 欢迎语（显示用户名）
- 4 个统计卡片：已连接设备数/限额、已安装技能数/加载错误数、今日调用数/限额、当前订阅计划/到期日
- 快捷操作入口：添加设备、浏览技能商店、管理订阅
- 管理员部分（不迁移）：总日志数、今日操作、成功率、最近活动

**Windows 需要新增：**

- `DashboardView` 组件，作为登录后的首页
- `useDashboard` hook，聚合订阅概览 + 技能统计数据
- 数据来源：`useSubscription` 的 overview 数据 + `useSkills` 的统计数据

**API 调用：**

- 复用现有 `useSubscription.fetchOverview()` 获取设备/调用量使用情况
- 复用现有 `useSkills.loadSkills()` 获取技能加载统计

#### 模块 2: 设备管理（增强）

**当前差异：**

| 能力          | Web Admin               | Windows                  |
| ------------- | ----------------------- | ------------------------ |
| 数据来源      | Gateway RPC `node.list` | REST API `deviceService` |
| 在线/离线状态 | 有（connected 字段）    | 无                       |
| 配对状态      | 有（paired 字段）       | 无                       |
| IP 地址       | 有                      | 无                       |
| 连接时间      | 有（connectedAtMs）     | 无                       |
| 版本号        | 有                      | 无                       |
| 设备详情页    | 有（但数据硬编码）      | 无                       |
| 配对新设备    | 按钮存在但未实现        | 完整流程                 |
| 设为主设备    | 无                      | 有                       |
| 删除/解绑设备 | 菜单项未对接 API        | 已对接                   |

**迁移方案：**

1. **融合两套 API 数据源**：
   - 通过 Gateway RPC `node.list` 获取实时连接信息（connected, paired, remoteIp, connectedAtMs, version）
   - 通过 REST `deviceService.getDevices()` 获取持久化绑定信息（isPrimary, alias, linkedAt）
   - 按 `nodeId/deviceId` 关联合并为统一的设备视图

2. **增强 DeviceManagementView**：
   - 设备卡片增加：在线/离线状态指示、IP 地址、版本号、连接时间
   - 新增设备详情面板或页面
   - 保留现有配对流程和主设备设置功能

3. **新增 IPC 通道**：
   - `gateway:call` 已存在，可直接调用 `node.list`

#### 模块 3: 技能商店（对齐补全）

**Windows 已有优势：** 排序、侧边栏分类（含数量）、热门标签、技能详情对话框、热门技能区。
**Web Admin 独有优势：** 加载更多分页（hasMore）、刷新商店按钮、hasUpdate 提示、错误重试。

**迁移方案：**

- Windows 的 `SkillStoreView` 补充：
  - `hasMore` 分页加载（当前是一次性加载全部）
  - 刷新商店数据按钮
  - `hasUpdate` 更新提示标记
  - 错误状态下的重试按钮

#### 模块 4: 我的技能（对齐补全）

**Windows 已有优势：** 搜索/分类/状态过滤、技能详情面板、执行功能（带参数表单）、本地/URL 安装、触发方式展示。
**Web Admin 独有优势：** 无明显缺失功能。

**迁移方案：**

- Windows 的 `SkillsView` 基本无需改动，功能已是超集
- 可选：参考 Web Admin 的分组展示样式（error/enabled/disabled 三组卡片）

#### 模块 5: 订阅管理（对齐补全）

**Windows 已有优势：** 计费周期月/年切换、年付折扣提示、功能标签展示、降级按钮、cancelAtPeriodEnd 提示、企业版联系销售。
**Web Admin 独有优势：** 使用量进度条（devices/skills/dailyCalls/storage 四维）。

**迁移方案：**

- Windows 的 `SubscriptionView` 补充：
  - 使用量进度条展示（设备/技能/每日调用/存储空间）
  - 数据来源：`useSubscription.overview.usage`

#### 模块 6: 个人资料设置（增强）

**Web Admin 独有功能（Windows 缺失）：**

- 头像展示和更换入口
- 邮箱修改
- 角色显示（只读）
- 用户名显示（只读）

**迁移方案：**

- 在 Windows `SettingsView` 的"账户信息"区块增加：
  - 头像展示（圆形，点击可更换 — Web 端用 `<input type="file">` 替代 Electron 对话框，或复用 `electronAPI.dialog.showOpenDialog`）
  - 邮箱字段（可编辑）
  - 角色/用户名（只读显示）
- 个人资料保存 API：使用 REST API `updateUserProfile({ displayName, email })`

#### 模块 7: 安全设置（增强）

**Web Admin 独有功能（Windows 缺失）：**

- 密码修改后强制登出（更安全）
- 密码强度校验（8 位 + 大小写 + 数字，比 Windows 的 6 位更严格）
- 密码输入可见/隐藏切换
- 两步验证 UI（未实现后端）
- 删除账户 UI（未实现后端）

**迁移方案：**

- 统一密码修改行为：修改成功后强制登出 + 重新登录（采用 Web Admin 的安全策略）
- 提升密码强度校验到 8 位 + 大小写 + 数字
- 增加密码可见/隐藏切换按钮
- 可选：添加两步验证和删除账户的 UI 占位（标注"即将推出"）

---

## 3. 实施计划

### 3.1 分阶段实施

#### Phase 1: Dashboard 新增 + 设备管理增强

**范围：**

- 新增 `DashboardView` 组件和 `useDashboard` hook
- 增强 `DeviceManagementView`，融合 Gateway `node.list` 数据
- 更新 `App.tsx` 侧边栏，添加 Dashboard 入口
- 默认视图从 `chat` 改为 `dashboard`

**新增/修改文件：**

```
apps/windows/src/renderer/
  components/
    DashboardView.tsx          # 新增
    DashboardView.css          # 新增
    DeviceManagementView.tsx   # 修改：增加节点信息展示
    DeviceManagementView.css   # 修改：新增样式
  hooks/
    useDashboard.ts            # 新增
    useDevicePairing.ts        # 修改：增加 node.list 调用
  App.tsx                      # 修改：添加 dashboard 视图
  components/Sidebar.tsx       # 修改：添加 Dashboard 菜单项
```

**测试要点：**

- Dashboard 统计数据正确加载和展示
- 快捷操作按钮正确切换到对应视图
- 设备列表同时展示在线状态和绑定信息
- 未连接 Gateway 时的降级显示

#### Phase 2: 技能模块对齐

**范围：**

- SkillStoreView 补充：分页加载、刷新按钮、hasUpdate 提示
- SkillsView 可选优化：参考 Web Admin 的分组展示

**修改文件：**

```
apps/windows/src/renderer/
  components/
    SkillStoreView.tsx         # 修改：添加分页/刷新/更新提示
    SkillStoreView.css         # 修改：新增样式
  hooks/
    useSkillStore.ts           # 修改：添加 hasMore/refreshStore 逻辑
```

**测试要点：**

- 分页加载正常（滚动/点击加载更多）
- 刷新按钮触发商店数据重新获取
- hasUpdate 技能正确标记"有更新"

#### Phase 3: 订阅管理对齐 + 设置增强

**范围：**

- SubscriptionView 补充使用量进度条
- SettingsView 增加个人资料编辑（头像、邮箱、角色）
- SettingsView 增强安全设置（密码强制登出、强度校验、可见切换）

**修改文件：**

```
apps/windows/src/renderer/
  components/
    SubscriptionView.tsx       # 修改：添加使用量进度条
    SubscriptionView.css       # 修改：进度条样式
    SettingsView.tsx           # 修改：增加个人资料和安全设置
    SettingsView.css           # 修改：新增样式
  hooks/
    useAuth.ts                 # 修改：changePassword 后强制登出
    useSettings.ts             # 可能修改：增加 profile 相关设置
```

**测试要点：**

- 使用量进度条正确显示百分比和限额
- 个人资料编辑保存成功
- 头像选择和展示正常
- 密码修改后自动登出并跳转到登录界面
- 密码强度校验生效

#### Phase 4: 移除 Web Admin

**范围：**

- 确认所有用户功能已在 Windows 客户端中可用
- 删除 `apps/web-admin/` 目录
- 更新 `pnpm-workspace.yaml` 移除 web-admin
- 更新项目文档和 CI 配置

**操作清单：**

```bash
# 1. 确认 Windows 功能完整性测试全部通过

# 2. 移除 Web Admin
rm -rf apps/web-admin/

# 3. 更新 workspace 配置
# 编辑 pnpm-workspace.yaml，移除 apps/web-admin

# 4. 更新 CI 配置（如有引用 web-admin 的构建/测试步骤）

# 5. 更新 CLAUDE.md 和相关文档

# 6. pnpm install 更新 lockfile
```

**验证：**

- `pnpm install` 无错误
- `pnpm build` 无错误
- `pnpm test` 无错误
- Windows 客户端功能回归测试通过

---

## 4. 技术细节

### 4.1 数据来源映射

迁移后 Windows 客户端的数据获取方式：

| 数据         | 当前 Web Admin 方式                | 迁移后 Windows 方式                                |
| ------------ | ---------------------------------- | -------------------------------------------------- |
| 订阅概览     | REST API (TanStack Query)          | REST API (`window.electronAPI.api`)                |
| 技能列表     | Gateway RPC `skill.*`              | Gateway RPC (`window.electronAPI.gateway.call`)    |
| 技能商店     | Gateway RPC `skill.store.*`        | Gateway RPC (`window.electronAPI.gateway.call`)    |
| 设备节点列表 | Gateway RPC `node.list`            | Gateway RPC (`window.electronAPI.gateway.call`)    |
| 设备绑定信息 | 无                                 | REST API (`deviceService`)                         |
| 审计日志     | REST API `operator.audit.*`        | 不迁移（保留在 Admin Console）                     |
| 个人资料修改 | Gateway RPC `admin.updateProfile`  | REST API (`window.electronAPI.api.updateProfile`)  |
| 密码修改     | Gateway RPC `admin.changePassword` | REST API (`window.electronAPI.api.changePassword`) |

### 4.2 新增 IPC 通道（如需）

当前 Windows 的 `preload/index.ts` 已暴露的关键 API：

```typescript
// 已有，可直接使用
window.electronAPI.gateway.call(method, params); // 通用 Gateway RPC
window.electronAPI.api.login(params);
window.electronAPI.api.refreshToken(refreshToken);
window.electronAPI.api.getPlans();
window.electronAPI.api.getSubscription();
window.electronAPI.api.createSubscription(planId, period);
window.electronAPI.api.cancelSubscription(immediate, reason);
window.electronAPI.pairing.getStatus();
window.electronAPI.pairing.requestPairing(token);
```

**可能需要新增的 API 方法（在 main/api-client.ts 和 preload/index.ts 中）：**

```typescript
// 个人资料更新（如果当前不存在）
window.electronAPI.api.updateProfile({ displayName, email });

// 头像上传（如果当前不存在）
window.electronAPI.api.uploadAvatar(filePath);
```

### 4.3 Dashboard 组件设计

```
┌─────────────────────────────────────────────┐
│  欢迎回来，{displayName}                     │
├──────────┬──────────┬──────────┬────────────┤
│ 已连接设备 │ 已安装技能 │ 今日调用  │ 当前订阅   │
│  2 / 5    │  8 (1err)│  42/100  │ Pro · 30天 │
├──────────┴──────────┴──────────┴────────────┤
│  快捷操作                                    │
│  [管理设备]  [浏览技能商店]  [管理订阅]        │
└─────────────────────────────────────────────┘
```

### 4.4 设备管理增强设计

```
┌─────────────────────────────────────────────┐
│  我的设备                    [配对新设备] [刷新]│
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │ Windows PC          ★主设备  ● 在线    │  │
│  │ windows · v1.2.3 · 192.168.1.100     │  │
│  │ 已连接 2 小时前                        │  │
│  │                        [详情] [解绑]   │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │ MacBook Pro                  ○ 离线    │  │
│  │ macos · v1.1.0                        │  │
│  │ 最后连接 3 天前                        │  │
│  │                   [设为主设备] [解绑]   │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## 5. 风险与注意事项

### 5.1 API 兼容性风险

| 风险                     | 说明                                                                | 应对                                                   |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------ |
| `node.list` 返回数据格式 | Web Admin 直接调用 Gateway RPC，Windows 通过 IPC 中转               | 确认 `gateway:call` IPC 通道能正确透传 RPC 结果        |
| 个人资料 API 差异        | Web Admin 用 Gateway RPC `admin.updateProfile`，Windows 用 REST API | 统一使用 REST API，确认 REST 端点支持 email 修改       |
| 密码修改后会话管理       | Web Admin 修改后服务端吊销所有会话                                  | 确认 REST API 的 `changePassword` 也有相同的服务端行为 |

### 5.2 功能回归风险

| 风险         | 说明                                     | 应对                                   |
| ------------ | ---------------------------------------- | -------------------------------------- |
| 技能商店分页 | 新增 hasMore 分页可能引入状态管理复杂度  | 使用 offset+limit 方式，保持简单       |
| 设备数据融合 | 两套 API 返回的设备 ID 可能不匹配        | 需要确认 nodeId 与 deviceId 的对应关系 |
| 头像上传     | Web Admin 未真正实现，Windows 需从零实现 | 可先只做展示，上传功能后续迭代         |

### 5.3 不迁移的功能确认

以下功能确认不迁移到 Windows 客户端，由 Admin Console 覆盖：

- 用户管理（`/admin/users`）— 运营功能
- 审计日志（`/admin/audit`）— 运营功能
- 系统监控（`/admin/system`）— 运营功能（Windows 有本地系统监控，不同用途）
- Dashboard 管理员统计部分 — 运营功能

---

## 6. 验收标准

### Phase 1 验收

- [ ] Dashboard 显示设备/技能/调用量/订阅四个统计卡片
- [ ] Dashboard 快捷操作按钮跳转到正确视图
- [ ] 设备列表显示在线/离线状态
- [ ] 设备列表显示 IP 地址和版本号
- [ ] 设备配对流程正常

### Phase 2 验收

- [ ] 技能商店支持分页加载
- [ ] 技能商店有刷新按钮
- [ ] 已安装技能正确显示 hasUpdate 标记

### Phase 3 验收

- [ ] 订阅页面显示使用量进度条（设备/技能/调用/存储）
- [ ] 设置页面可修改头像、邮箱
- [ ] 设置页面显示角色和用户名
- [ ] 修改密码后自动登出
- [ ] 密码强度校验：8 位 + 大小写 + 数字

### Phase 4 验收

- [ ] `apps/web-admin/` 已删除
- [ ] `pnpm install && pnpm build && pnpm test` 全部通过
- [ ] Windows 客户端所有功能回归测试通过
- [ ] CI 流水线无 web-admin 相关错误

---

## 7. 文件影响清单

### 新增文件

```
apps/windows/src/renderer/components/DashboardView.tsx
apps/windows/src/renderer/components/DashboardView.css
apps/windows/src/renderer/hooks/useDashboard.ts
```

### 修改文件

```
apps/windows/src/renderer/App.tsx                          # 添加 dashboard 视图
apps/windows/src/renderer/components/Sidebar.tsx            # 添加 Dashboard 菜单
apps/windows/src/renderer/components/DeviceManagementView.tsx  # 增加节点信息
apps/windows/src/renderer/components/DeviceManagementView.css
apps/windows/src/renderer/components/SkillStoreView.tsx     # 分页/刷新/更新提示
apps/windows/src/renderer/components/SkillStoreView.css
apps/windows/src/renderer/components/SubscriptionView.tsx   # 使用量进度条
apps/windows/src/renderer/components/SubscriptionView.css
apps/windows/src/renderer/components/SettingsView.tsx       # 个人资料/安全增强
apps/windows/src/renderer/components/SettingsView.css
apps/windows/src/renderer/hooks/useSkillStore.ts            # hasMore/refresh
apps/windows/src/renderer/hooks/useAuth.ts                  # 密码修改后登出
apps/windows/src/main/api-client.ts                         # 可能新增 updateProfile
apps/windows/src/preload/index.ts                           # 可能新增 IPC 方法
```

### 删除文件（Phase 4）

```
apps/web-admin/                                             # 整个目录
```

### 其他需更新的文件

```
pnpm-workspace.yaml                                        # 移除 web-admin
package.json                                                # 如有 web-admin 相关脚本
CLAUDE.md                                                   # 更新架构说明
.github/workflows/                                          # 如有 web-admin CI 步骤
```

---

**文档编写日期**: 2026-02-20
**预计实施周期**: Phase 1-3 增量迭代，Phase 4 为最终清理
