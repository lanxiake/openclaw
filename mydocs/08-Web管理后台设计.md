# AI 个人助理平台 - Web 管理后台设计文档

> 版本: 1.0 | 创建日期: 2026-02-07 | 状态: 初始设计
>
> 本文档详细设计 Web 管理后台的架构、组件、API 和权限控制

---

## 修订记录

| 版本 | 日期       | 修订内容                                         |
| ---- | ---------- | ------------------------------------------------ |
| 1.0  | 2026-02-07 | 初始设计：整体架构、页面路由、组件设计、REST API |

---

## 1. 概述

### 1.1 背景

根据产品架构设计（01-产品架构设计.md），Web Dashboard 需要提供以下核心功能：

- 设备管理：查看和管理已配对的设备
- 技能商店：浏览、购买和管理技能
- 使用统计：查看使用情况和费用统计
- 用户设置：管理账户和偏好设置

### 1.2 定位

Web 管理后台是面向**最终用户**和**运营管理员**的统一管理界面：

| 角色       | 功能范围                                |
| ---------- | --------------------------------------- |
| 普通用户   | 设备管理、技能订阅、个人设置、使用统计  |
| 运营管理员 | 上述功能 + 用户管理、系统监控、审计日志 |
| 超级管理员 | 上述功能 + 系统配置、权限管理           |

### 1.3 设计原则

1. **响应式设计** - 支持桌面、平板、移动端访问
2. **组件化** - 使用 shadcn/ui 构建可复用组件库
3. **类型安全** - TypeScript 全栈类型检查
4. **无状态** - 前端通过 REST API 获取数据，支持水平扩展
5. **安全优先** - HTTPS、CSRF 防护、XSS 防护

---

## 2. 技术架构

### 2.1 技术选型

| 层级 | 技术            | 版本   | 说明               |
| ---- | --------------- | ------ | ------------------ |
| 框架 | React           | 18+    | 组件化 UI 框架     |
| 构建 | Vite            | 5.x    | 快速构建和 HMR     |
| 语言 | TypeScript      | 5.x    | 类型安全           |
| UI   | shadcn/ui       | latest | TailwindCSS 组件库 |
| 样式 | TailwindCSS     | 3.x    | 原子化 CSS         |
| 状态 | Zustand         | 4.x    | 轻量状态管理       |
| 路由 | React Router    | 6.x    | 声明式路由         |
| 请求 | TanStack Query  | 5.x    | 数据获取和缓存     |
| 表单 | React Hook Form | 7.x    | 表单验证           |
| 验证 | Zod             | 3.x    | Schema 验证        |
| 图表 | Recharts        | 2.x    | 数据可视化         |
| 图标 | Lucide React    | latest | 图标库             |

### 2.2 项目结构

```
apps/web-admin/
├── public/
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── main.tsx                    # 应用入口
│   ├── App.tsx                     # 根组件
│   ├── vite-env.d.ts               # Vite 类型声明
│   │
│   ├── assets/                     # 静态资源
│   │   ├── images/
│   │   └── fonts/
│   │
│   ├── components/                 # 组件库
│   │   ├── ui/                     # shadcn/ui 基础组件
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── toast.tsx
│   │   │
│   │   ├── layout/                 # 布局组件
│   │   │   ├── AppLayout.tsx       # 主布局
│   │   │   ├── Sidebar.tsx         # 侧边栏
│   │   │   ├── Header.tsx          # 顶部导航
│   │   │   └── Footer.tsx          # 页脚
│   │   │
│   │   ├── common/                 # 通用业务组件
│   │   │   ├── DataTable.tsx       # 数据表格
│   │   │   ├── SearchInput.tsx     # 搜索框
│   │   │   ├── Pagination.tsx      # 分页
│   │   │   ├── Loading.tsx         # 加载状态
│   │   │   ├── ErrorBoundary.tsx   # 错误边界
│   │   │   └── ConfirmDialog.tsx   # 确认对话框
│   │   │
│   │   └── features/               # 功能组件
│   │       ├── auth/               # 认证相关
│   │       ├── devices/            # 设备管理
│   │       ├── skills/             # 技能管理
│   │       ├── users/              # 用户管理
│   │       └── audit/              # 审计日志
│   │
│   ├── hooks/                      # 自定义 Hooks
│   │   ├── useAuth.ts              # 认证状态
│   │   ├── useUser.ts              # 用户信息
│   │   ├── useDevices.ts           # 设备列表
│   │   ├── useSkills.ts            # 技能列表
│   │   └── useToast.ts             # 消息提示
│   │
│   ├── lib/                        # 工具库
│   │   ├── api.ts                  # API 客户端
│   │   ├── utils.ts                # 通用工具
│   │   ├── validators.ts           # 验证器
│   │   └── constants.ts            # 常量定义
│   │
│   ├── pages/                      # 页面组件
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx       # 登录页
│   │   │   ├── RegisterPage.tsx    # 注册页
│   │   │   └── ForgotPasswordPage.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx   # 仪表盘
│   │   │
│   │   ├── devices/
│   │   │   ├── DevicesPage.tsx     # 设备列表
│   │   │   └── DeviceDetailPage.tsx
│   │   │
│   │   ├── skills/
│   │   │   ├── SkillStorePage.tsx  # 技能商店
│   │   │   ├── MySkillsPage.tsx    # 我的技能
│   │   │   └── SkillDetailPage.tsx
│   │   │
│   │   ├── subscription/
│   │   │   ├── SubscriptionPage.tsx # 订阅管理
│   │   │   └── BillingPage.tsx     # 账单
│   │   │
│   │   ├── settings/
│   │   │   ├── ProfilePage.tsx     # 个人资料
│   │   │   ├── SecurityPage.tsx    # 安全设置
│   │   │   └── PreferencesPage.tsx # 偏好设置
│   │   │
│   │   └── admin/                  # 管理员页面
│   │       ├── UsersPage.tsx       # 用户管理
│   │       ├── AuditLogPage.tsx    # 审计日志
│   │       ├── SystemPage.tsx      # 系统监控
│   │       └── ConfigPage.tsx      # 系统配置
│   │
│   ├── routes/                     # 路由配置
│   │   ├── index.tsx               # 路由定义
│   │   ├── PrivateRoute.tsx        # 私有路由
│   │   └── AdminRoute.tsx          # 管理员路由
│   │
│   ├── stores/                     # Zustand 状态
│   │   ├── authStore.ts            # 认证状态
│   │   ├── uiStore.ts              # UI 状态
│   │   └── notificationStore.ts    # 通知状态
│   │
│   ├── types/                      # 类型定义
│   │   ├── api.ts                  # API 响应类型
│   │   ├── user.ts                 # 用户类型
│   │   ├── device.ts               # 设备类型
│   │   ├── skill.ts                # 技能类型
│   │   └── subscription.ts         # 订阅类型
│   │
│   └── styles/                     # 样式文件
│       ├── globals.css             # 全局样式
│       └── tailwind.config.ts      # Tailwind 配置
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── postcss.config.js
```

### 2.3 系统架构图

```
┌────────────────────────────────────────────────────────────────────────┐
│                           Web 管理后台                                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐            │
│   │   浏览器      │    │   浏览器      │    │   浏览器      │            │
│   │  (用户 A)     │    │  (用户 B)     │    │  (管理员)     │            │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘            │
│          │                   │                   │                     │
│          └───────────────────┼───────────────────┘                     │
│                              │                                         │
│                              ▼                                         │
│   ┌──────────────────────────────────────────────────────────┐        │
│   │                      Vite Dev Server                      │        │
│   │                  (开发) / Nginx (生产)                     │        │
│   └──────────────────────────┬───────────────────────────────┘        │
│                              │                                         │
└──────────────────────────────┼─────────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Gateway 服务                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────┐         ┌─────────────────┐                   │
│   │   REST API      │         │   WebSocket     │                   │
│   │   /api/v1/*     │         │   /ws           │                   │
│   └────────┬────────┘         └────────┬────────┘                   │
│            │                           │                             │
│            ▼                           ▼                             │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │              认证中间件 (JWT + Device Token)             │       │
│   └─────────────────────────────────────────────────────────┘       │
│            │                           │                             │
│            ▼                           ▼                             │
│   ┌─────────────────┐         ┌─────────────────┐                   │
│   │  REST Handlers  │         │   RPC Methods   │                   │
│   │  (CRUD 操作)    │         │  (实时操作)      │                   │
│   └────────┬────────┘         └────────┬────────┘                   │
│            │                           │                             │
│            └───────────┬───────────────┘                             │
│                        ▼                                             │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │                  业务逻辑层                               │       │
│   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │       │
│   │  │ 用户管理  │ │ 设备管理  │ │ 技能管理  │ │ 订阅管理  │   │       │
│   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │       │
│   └─────────────────────────────────────────────────────────┘       │
│                        │                                             │
│                        ▼                                             │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │                  数据访问层                               │       │
│   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │       │
│   │  │ PostgreSQL   │ │ JSON 文件    │ │ 对象存储      │    │       │
│   │  │ (用户/订阅)  │ │ (设备配对)   │ │ (文件/头像)   │    │       │
│   │  └──────────────┘ └──────────────┘ └──────────────────┘  │       │
│   └─────────────────────────────────────────────────────────┘       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. 页面路由设计

### 3.1 路由结构

```typescript
// src/routes/index.tsx

import { createBrowserRouter } from 'react-router-dom'

export const router = createBrowserRouter([
  // ==================== 公开路由 ====================
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password/:token',
    element: <ResetPasswordPage />,
  },

  // ==================== 认证路由 ====================
  {
    path: '/',
    element: <PrivateRoute><AppLayout /></PrivateRoute>,
    children: [
      // 仪表盘
      {
        index: true,
        element: <DashboardPage />,
      },

      // 设备管理
      {
        path: 'devices',
        children: [
          { index: true, element: <DevicesPage /> },
          { path: ':deviceId', element: <DeviceDetailPage /> },
          { path: 'pair', element: <DevicePairPage /> },
        ],
      },

      // 技能商店
      {
        path: 'skills',
        children: [
          { index: true, element: <SkillStorePage /> },
          { path: 'my', element: <MySkillsPage /> },
          { path: ':skillId', element: <SkillDetailPage /> },
        ],
      },

      // 订阅管理
      {
        path: 'subscription',
        children: [
          { index: true, element: <SubscriptionPage /> },
          { path: 'billing', element: <BillingPage /> },
          { path: 'payment/:planId', element: <PaymentPage /> },
        ],
      },

      // 设置
      {
        path: 'settings',
        children: [
          { index: true, element: <ProfilePage /> },
          { path: 'security', element: <SecurityPage /> },
          { path: 'preferences', element: <PreferencesPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
        ],
      },

      // ==================== 管理员路由 ====================
      {
        path: 'admin',
        element: <AdminRoute />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          // 用户管理
          {
            path: 'users',
            children: [
              { index: true, element: <UsersPage /> },
              { path: ':userId', element: <UserDetailPage /> },
            ],
          },
          // 审计日志
          {
            path: 'audit',
            element: <AuditLogPage />,
          },
          // 系统监控
          {
            path: 'system',
            element: <SystemMonitorPage />,
          },
          // 系统配置
          {
            path: 'config',
            element: <ConfigPage />,
          },
        ],
      },
    ],
  },

  // 404
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
```

### 3.2 页面权限矩阵

| 页面路径                  | 普通用户 | 运营管理员 | 超级管理员 | 所需权限         |
| ------------------------- | -------- | ---------- | ---------- | ---------------- |
| `/` (仪表盘)              | ✅       | ✅         | ✅         | -                |
| `/devices`                | ✅       | ✅         | ✅         | -                |
| `/devices/:id`            | ✅       | ✅         | ✅         | 仅限自己的设备   |
| `/skills`                 | ✅       | ✅         | ✅         | -                |
| `/skills/my`              | ✅       | ✅         | ✅         | -                |
| `/subscription`           | ✅       | ✅         | ✅         | -                |
| `/settings/*`             | ✅       | ✅         | ✅         | -                |
| `/admin`                  | ❌       | ✅         | ✅         | `operator.read`  |
| `/admin/users`            | ❌       | ✅         | ✅         | `operator.read`  |
| `/admin/users/:id` (编辑) | ❌       | ❌         | ✅         | `operator.write` |
| `/admin/audit`            | ❌       | ✅         | ✅         | `operator.read`  |
| `/admin/system`           | ❌       | ✅         | ✅         | `operator.read`  |
| `/admin/config`           | ❌       | ❌         | ✅         | `admin`          |

---

## 4. 组件设计

### 4.1 布局组件

#### 4.1.1 AppLayout - 主布局

```typescript
// src/components/layout/AppLayout.tsx

import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/stores/uiStore'

/**
 * 主布局组件
 *
 * 包含侧边栏、顶部导航和内容区域
 */
export function AppLayout() {
  const { sidebarCollapsed } = useUIStore()

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* 侧边栏 */}
      <Sidebar collapsed={sidebarCollapsed} />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部导航 */}
        <Header />

        {/* 页面内容 */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

#### 4.1.2 Sidebar - 侧边栏

```typescript
// src/components/layout/Sidebar.tsx

import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Smartphone,
  Puzzle,
  CreditCard,
  Settings,
  Users,
  FileText,
  Activity,
  Cog,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
}

/**
 * 侧边栏导航
 */
export function Sidebar({ collapsed }: SidebarProps) {
  const { user, hasScope } = useAuth()

  // 导航菜单配置
  const menuItems = [
    // 用户菜单
    {
      title: '概览',
      items: [
        { icon: LayoutDashboard, label: '仪表盘', path: '/' },
      ],
    },
    {
      title: '管理',
      items: [
        { icon: Smartphone, label: '设备管理', path: '/devices' },
        { icon: Puzzle, label: '技能商店', path: '/skills' },
        { icon: CreditCard, label: '订阅管理', path: '/subscription' },
      ],
    },
    {
      title: '设置',
      items: [
        { icon: Settings, label: '个人设置', path: '/settings' },
      ],
    },
  ]

  // 管理员菜单
  const adminItems = hasScope('operator.read') ? [
    {
      title: '系统管理',
      items: [
        { icon: Users, label: '用户管理', path: '/admin/users' },
        { icon: FileText, label: '审计日志', path: '/admin/audit' },
        { icon: Activity, label: '系统监控', path: '/admin/system' },
        ...(hasScope('admin') ? [
          { icon: Cog, label: '系统配置', path: '/admin/config' },
        ] : []),
      ],
    },
  ] : []

  const allMenuItems = [...menuItems, ...adminItems]

  return (
    <aside
      className={cn(
        'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700',
        'transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b">
        <img
          src="/logo.svg"
          alt="OpenClaw"
          className={cn('transition-all', collapsed ? 'w-8 h-8' : 'w-32')}
        />
      </div>

      {/* 导航菜单 */}
      <nav className="p-4 space-y-6">
        {allMenuItems.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {section.title}
              </h3>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                        'hover:bg-gray-100 dark:hover:bg-gray-700',
                        isActive
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                          : 'text-gray-700 dark:text-gray-300'
                      )
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
```

### 4.2 通用业务组件

#### 4.2.1 DataTable - 数据表格

```typescript
// src/components/common/DataTable.tsx

import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataTableProps<TData> {
  /** 列定义 */
  columns: ColumnDef<TData>[]
  /** 数据 */
  data: TData[]
  /** 搜索框占位符 */
  searchPlaceholder?: string
  /** 每页条数选项 */
  pageSizeOptions?: number[]
  /** 加载状态 */
  loading?: boolean
  /** 空状态文本 */
  emptyText?: string
}

/**
 * 通用数据表格组件
 *
 * 支持排序、搜索、分页
 */
export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = '搜索...',
  pageSizeOptions = [10, 20, 50],
  loading = false,
  emptyText = '暂无数据',
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 表格 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'px-4 py-3 text-left text-sm font-medium text-gray-500',
                      header.column.getCanSort() && 'cursor-pointer select-none'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() === 'asc' && <ChevronUp className="w-4 h-4" />}
                      {header.column.getIsSorted() === 'desc' && <ChevronDown className="w-4 h-4" />}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>加载中...</span>
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">每页显示</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-sm">
            第 {table.getState().pagination.pageIndex + 1} 页，共 {table.getPageCount()} 页
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  )
}
```

#### 4.2.2 ConfirmDialog - 确认对话框

```typescript
// src/components/common/ConfirmDialog.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  /** 是否打开 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 确认回调 */
  onConfirm: () => void
  /** 标题 */
  title: string
  /** 描述 */
  description: string
  /** 确认按钮文本 */
  confirmText?: string
  /** 取消按钮文本 */
  cancelText?: string
  /** 类型 */
  variant?: 'info' | 'warning' | 'danger'
  /** 加载状态 */
  loading?: boolean
}

const variantConfig = {
  info: {
    icon: Info,
    iconClass: 'text-blue-500',
    buttonClass: 'bg-blue-500 hover:bg-blue-600',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-yellow-500',
    buttonClass: 'bg-yellow-500 hover:bg-yellow-600',
  },
  danger: {
    icon: AlertCircle,
    iconClass: 'text-red-500',
    buttonClass: 'bg-red-500 hover:bg-red-600',
  },
}

/**
 * 确认对话框组件
 *
 * 用于危险操作的二次确认
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'info',
  loading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Icon className={cn('w-6 h-6', config.iconClass)} />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            className={config.buttonClass}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '处理中...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 4.3 状态管理

#### 4.3.1 authStore - 认证状态

```typescript
// src/stores/authStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

interface User {
  id: string;
  phone?: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  status: string;
  scopes: string[];
}

interface AuthState {
  /** 用户信息 */
  user: User | null;
  /** 访问 Token */
  accessToken: string | null;
  /** 刷新 Token */
  refreshToken: string | null;
  /** 是否已认证 */
  isAuthenticated: boolean;
  /** 登录 */
  login: (phone: string, code: string) => Promise<void>;
  /** 登出 */
  logout: () => Promise<void>;
  /** 刷新 Token */
  refreshAccessToken: () => Promise<void>;
  /** 检查权限 */
  hasScope: (scope: string) => boolean;
}

/**
 * 认证状态管理
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      /**
       * 用户登录
       *
       * @param phone - 手机号
       * @param code - 验证码
       */
      login: async (phone: string, code: string) => {
        console.log("[authStore] 开始登录:", phone);

        const response = await api.post("/api/v1/auth/login", {
          phone,
          code,
        });

        const { user, accessToken, refreshToken } = response.data;

        console.log("[authStore] 登录成功:", user.displayName);

        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },

      /**
       * 用户登出
       */
      logout: async () => {
        console.log("[authStore] 登出");

        try {
          await api.post("/api/v1/auth/logout");
        } catch {
          // 忽略登出请求失败
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      /**
       * 刷新访问 Token
       */
      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          throw new Error("No refresh token");
        }

        console.log("[authStore] 刷新 Token");

        const response = await api.post("/api/v1/auth/refresh", {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        set({
          accessToken,
          refreshToken: newRefreshToken,
        });
      },

      /**
       * 检查用户是否具有指定权限
       */
      hasScope: (scope: string) => {
        const { user } = get();
        if (!user) return false;
        return user.scopes.includes(scope) || user.scopes.includes("admin");
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
```

#### 4.3.2 uiStore - UI 状态

```typescript
// src/stores/uiStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean;
  /** 暗色模式 */
  darkMode: boolean;
  /** 切换侧边栏 */
  toggleSidebar: () => void;
  /** 切换暗色模式 */
  toggleDarkMode: () => void;
  /** 设置暗色模式 */
  setDarkMode: (dark: boolean) => void;
}

/**
 * UI 状态管理
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      darkMode: false,

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      toggleDarkMode: () => {
        set((state) => {
          const newDarkMode = !state.darkMode;
          // 更新 DOM
          document.documentElement.classList.toggle("dark", newDarkMode);
          return { darkMode: newDarkMode };
        });
      },

      setDarkMode: (dark: boolean) => {
        document.documentElement.classList.toggle("dark", dark);
        set({ darkMode: dark });
      },
    }),
    {
      name: "ui-storage",
    },
  ),
);
```

---

## 5. REST API 设计

### 5.1 API 规范

#### 5.1.1 基础规范

| 规范     | 说明               |
| -------- | ------------------ |
| 基础路径 | `/api/v1`          |
| 协议     | HTTPS              |
| 编码     | UTF-8              |
| 格式     | JSON               |
| 认证     | Bearer Token (JWT) |

#### 5.1.2 响应格式

```typescript
// 成功响应
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

// 错误响应
interface ApiErrorResponse {
  success: false;
  error: {
    code: string; // 错误码
    message: string; // 用户友好的错误消息
    details?: unknown; // 详细错误信息（仅开发环境）
  };
}
```

#### 5.1.3 错误码规范

| 错误码             | HTTP 状态码 | 说明           |
| ------------------ | ----------- | -------------- |
| `AUTH_REQUIRED`    | 401         | 需要认证       |
| `AUTH_EXPIRED`     | 401         | Token 已过期   |
| `AUTH_INVALID`     | 401         | Token 无效     |
| `FORBIDDEN`        | 403         | 无权限         |
| `NOT_FOUND`        | 404         | 资源不存在     |
| `VALIDATION_ERROR` | 400         | 参数验证失败   |
| `RATE_LIMITED`     | 429         | 请求频率限制   |
| `INTERNAL_ERROR`   | 500         | 服务器内部错误 |

### 5.2 认证 API

#### 5.2.1 发送验证码

```
POST /api/v1/auth/send-code

请求体:
{
  "phone": "+8613800138000",
  "type": "login" | "register" | "reset-password"
}

响应:
{
  "success": true,
  "data": {
    "expiresIn": 300
  }
}

错误:
- PHONE_INVALID: 手机号格式无效
- RATE_LIMITED: 发送频率限制
```

#### 5.2.2 用户登录

```
POST /api/v1/auth/login

请求体:
{
  "phone": "+8613800138000",
  "code": "123456"
}

响应:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "phone": "+8613800138000",
      "displayName": "用户名",
      "avatarUrl": "https://...",
      "status": "active",
      "scopes": ["operator.read"]
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "uuid",
    "expiresIn": 900
  }
}

错误:
- CODE_INVALID: 验证码无效
- CODE_EXPIRED: 验证码已过期
- ACCOUNT_SUSPENDED: 账户已停用
- ACCOUNT_LOCKED: 账户已锁定
```

#### 5.2.3 刷新 Token

```
POST /api/v1/auth/refresh

请求体:
{
  "refreshToken": "uuid"
}

响应:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "new-uuid",
    "expiresIn": 900
  }
}

错误:
- REFRESH_TOKEN_INVALID: 刷新 Token 无效
- REFRESH_TOKEN_EXPIRED: 刷新 Token 已过期
```

#### 5.2.4 登出

```
POST /api/v1/auth/logout

请求头:
Authorization: Bearer <accessToken>

响应:
{
  "success": true,
  "data": null
}
```

### 5.3 设备管理 API

#### 5.3.1 获取设备列表

```
GET /api/v1/devices

请求头:
Authorization: Bearer <accessToken>

查询参数:
- page: 页码 (默认 1)
- limit: 每页条数 (默认 20)
- status: 状态过滤 (online | offline | all)

响应:
{
  "success": true,
  "data": [
    {
      "id": "device-uuid",
      "displayName": "我的电脑",
      "platform": "windows",
      "role": "owner",
      "scopes": ["operator.read", "operator.write"],
      "lastActiveAt": "2026-02-07T10:30:00Z",
      "status": "online",
      "linkedAt": "2026-02-01T08:00:00Z"
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20
  }
}
```

#### 5.3.2 获取设备详情

```
GET /api/v1/devices/:deviceId

请求头:
Authorization: Bearer <accessToken>

响应:
{
  "success": true,
  "data": {
    "id": "device-uuid",
    "displayName": "我的电脑",
    "platform": "windows",
    "platformVersion": "Windows 11",
    "appVersion": "1.0.0",
    "role": "owner",
    "scopes": ["operator.read", "operator.write"],
    "lastActiveAt": "2026-02-07T10:30:00Z",
    "linkedAt": "2026-02-01T08:00:00Z",
    "status": "online"
  }
}

错误:
- NOT_FOUND: 设备不存在
- FORBIDDEN: 无权访问该设备
```

#### 5.3.3 解绑设备

```
DELETE /api/v1/devices/:deviceId

请求头:
Authorization: Bearer <accessToken>

响应:
{
  "success": true,
  "data": null
}

错误:
- NOT_FOUND: 设备不存在
- FORBIDDEN: 无权解绑该设备
```

### 5.4 技能管理 API

#### 5.4.1 获取技能商店列表

```
GET /api/v1/skills

查询参数:
- page: 页码
- limit: 每页条数
- category: 分类过滤
- search: 搜索关键词
- sort: 排序 (popular | newest | price-asc | price-desc)

响应:
{
  "success": true,
  "data": [
    {
      "id": "skill-uuid",
      "name": "微信自动回复",
      "slug": "wechat-auto-reply",
      "description": "自动回复微信消息",
      "icon": "https://...",
      "category": "automation",
      "price": 9.9,
      "pricePeriod": "month",
      "rating": 4.8,
      "reviewCount": 128,
      "installCount": 5000,
      "isActive": true
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20
  }
}
```

#### 5.4.2 获取我的技能

```
GET /api/v1/skills/my

请求头:
Authorization: Bearer <accessToken>

响应:
{
  "success": true,
  "data": [
    {
      "id": "user-skill-uuid",
      "skill": {
        "id": "skill-uuid",
        "name": "微信自动回复",
        "slug": "wechat-auto-reply",
        "icon": "https://..."
      },
      "installedAt": "2026-02-01T08:00:00Z",
      "configuration": {
        "autoReplyEnabled": true,
        "replyDelay": 1000
      },
      "isFavorite": true
    }
  ]
}
```

#### 5.4.3 订阅技能

```
POST /api/v1/skills/:skillId/subscribe

请求头:
Authorization: Bearer <accessToken>

请求体:
{
  "paymentMethod": "wechat" | "alipay"
}

响应:
{
  "success": true,
  "data": {
    "subscriptionId": "sub-uuid",
    "paymentUrl": "https://pay.example.com/...",
    "expiresAt": "2026-03-07T00:00:00Z"
  }
}

错误:
- SKILL_NOT_FOUND: 技能不存在
- ALREADY_SUBSCRIBED: 已订阅该技能
- PAYMENT_FAILED: 支付失败
```

### 5.5 用户管理 API (管理员)

#### 5.5.1 获取用户列表

```
GET /api/v1/admin/users

请求头:
Authorization: Bearer <accessToken>

所需权限: operator.read

查询参数:
- page: 页码
- limit: 每页条数
- status: 状态过滤 (active | suspended | deleted)
- search: 搜索关键词 (手机号/邮箱/名称)

响应:
{
  "success": true,
  "data": [
    {
      "id": "user-uuid",
      "phone": "+8613800138000",
      "email": "user@example.com",
      "displayName": "用户名",
      "status": "active",
      "deviceCount": 2,
      "createdAt": "2026-01-01T00:00:00Z",
      "lastLoginAt": "2026-02-07T10:30:00Z"
    }
  ],
  "meta": {
    "total": 1000,
    "page": 1,
    "limit": 20
  }
}
```

#### 5.5.2 获取用户详情

```
GET /api/v1/admin/users/:userId

请求头:
Authorization: Bearer <accessToken>

所需权限: operator.read

响应:
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "phone": "+8613800138000",
    "email": "user@example.com",
    "displayName": "用户名",
    "avatarUrl": "https://...",
    "status": "active",
    "isPhoneVerified": true,
    "isEmailVerified": false,
    "mfaEnabled": false,
    "timezone": "Asia/Shanghai",
    "locale": "zh-CN",
    "createdAt": "2026-01-01T00:00:00Z",
    "lastLoginAt": "2026-02-07T10:30:00Z",
    "devices": [
      {
        "id": "device-uuid",
        "displayName": "我的电脑",
        "platform": "windows",
        "status": "online"
      }
    ],
    "subscriptions": [
      {
        "id": "sub-uuid",
        "plan": { "name": "专业版" },
        "status": "active",
        "expiresAt": "2026-03-01T00:00:00Z"
      }
    ]
  }
}
```

#### 5.5.3 更新用户状态

```
PATCH /api/v1/admin/users/:userId/status

请求头:
Authorization: Bearer <accessToken>

所需权限: operator.write

请求体:
{
  "status": "suspended" | "active",
  "reason": "违规行为描述"
}

响应:
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "status": "suspended"
  }
}

错误:
- NOT_FOUND: 用户不存在
- FORBIDDEN: 无权修改该用户
```

### 5.6 审计日志 API (管理员)

#### 5.6.1 查询审计日志

```
GET /api/v1/admin/audit-logs

请求头:
Authorization: Bearer <accessToken>

所需权限: operator.read

查询参数:
- page: 页码
- limit: 每页条数
- userId: 用户 ID 过滤
- deviceId: 设备 ID 过滤
- action: 操作类型过滤
- startTime: 开始时间
- endTime: 结束时间

响应:
{
  "success": true,
  "data": [
    {
      "id": "log-uuid",
      "userId": "user-uuid",
      "userName": "用户名",
      "deviceId": "device-uuid",
      "deviceName": "我的电脑",
      "action": "device.unlink",
      "resource": "device/device-uuid",
      "details": {
        "reason": "用户主动解绑"
      },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-02-07T10:30:00Z"
    }
  ],
  "meta": {
    "total": 500,
    "page": 1,
    "limit": 20
  }
}
```

---

## 6. 权限控制设计

### 6.1 权限模型

```
┌─────────────────────────────────────────────────────────────────────┐
│                         权限控制模型                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   前端层                                                            │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │ 路由守卫                                                   │    │
│   │ ├── PrivateRoute: 检查是否登录                            │    │
│   │ └── AdminRoute: 检查是否有 operator.read 权限             │    │
│   └───────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                              ▼                                      │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │ 组件级权限                                                 │    │
│   │ ├── hasScope('operator.read'): 显示/隐藏管理菜单          │    │
│   │ ├── hasScope('operator.write'): 显示/隐藏编辑按钮         │    │
│   │ └── hasScope('admin'): 显示/隐藏系统配置                  │    │
│   └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│   后端层                                                            │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │ API 认证中间件                                             │    │
│   │ ├── 验证 JWT Token 有效性                                 │    │
│   │ ├── 解析用户信息和权限                                    │    │
│   │ └── 注入到请求上下文                                      │    │
│   └───────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                              ▼                                      │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │ 权限检查中间件                                             │    │
│   │ ├── 检查 API 所需权限                                     │    │
│   │ ├── 验证用户是否具有权限                                  │    │
│   │ └── 返回 403 或继续处理                                   │    │
│   └───────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                              ▼                                      │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │ 资源级权限                                                 │    │
│   │ ├── 检查用户是否有权访问特定资源                          │    │
│   │ └── 例如：只能访问自己的设备                              │    │
│   └───────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 权限范围定义

| 权限             | 说明         | 角色                   |
| ---------------- | ------------ | ---------------------- |
| (无权限)         | 普通用户功能 | 所有登录用户           |
| `operator.read`  | 查看管理数据 | 运营管理员、超级管理员 |
| `operator.write` | 修改管理数据 | 超级管理员             |
| `admin`          | 系统配置     | 超级管理员             |

### 6.3 前端权限组件

```typescript
// src/components/common/Permission.tsx

import { useAuth } from '@/hooks/useAuth'

interface PermissionProps {
  /** 所需权限 */
  scope: string | string[]
  /** 有权限时显示的内容 */
  children: React.ReactNode
  /** 无权限时显示的内容（可选） */
  fallback?: React.ReactNode
}

/**
 * 权限控制组件
 *
 * 根据用户权限决定是否渲染子组件
 *
 * @example
 * <Permission scope="operator.write">
 *   <Button>编辑</Button>
 * </Permission>
 *
 * @example
 * <Permission scope={["operator.read", "admin"]} fallback={<span>无权限</span>}>
 *   <AdminPanel />
 * </Permission>
 */
export function Permission({ scope, children, fallback = null }: PermissionProps) {
  const { hasScope } = useAuth()

  const scopes = Array.isArray(scope) ? scope : [scope]
  const hasPermission = scopes.some(s => hasScope(s))

  return hasPermission ? <>{children}</> : <>{fallback}</>
}
```

### 6.4 后端权限中间件

```typescript
// src/gateway/middleware/permission.ts

import { FastifyRequest, FastifyReply } from "fastify";

/**
 * API 权限定义
 */
const API_PERMISSIONS: Record<string, { scopes?: string[]; public?: boolean }> = {
  // 公开 API
  "POST /api/v1/auth/send-code": { public: true },
  "POST /api/v1/auth/login": { public: true },
  "POST /api/v1/auth/refresh": { public: true },

  // 用户 API (无需特殊权限)
  "GET /api/v1/devices": {},
  "GET /api/v1/devices/:deviceId": {},
  "DELETE /api/v1/devices/:deviceId": {},
  "GET /api/v1/skills": {},
  "GET /api/v1/skills/my": {},

  // 管理员 API
  "GET /api/v1/admin/users": { scopes: ["operator.read"] },
  "GET /api/v1/admin/users/:userId": { scopes: ["operator.read"] },
  "PATCH /api/v1/admin/users/:userId/status": { scopes: ["operator.write"] },
  "GET /api/v1/admin/audit-logs": { scopes: ["operator.read"] },
  "GET /api/v1/admin/config": { scopes: ["admin"] },
  "PUT /api/v1/admin/config": { scopes: ["admin"] },
};

/**
 * 权限检查中间件
 */
export async function permissionMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const routeKey = `${request.method} ${request.routeOptions.url}`;
  const permission = API_PERMISSIONS[routeKey];

  // 未定义的路由默认需要认证
  if (!permission) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "请先登录",
        },
      });
    }
    return;
  }

  // 公开 API
  if (permission.public) {
    return;
  }

  // 需要认证
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "请先登录",
      },
    });
  }

  // 检查权限
  if (permission.scopes && permission.scopes.length > 0) {
    const userScopes = request.user.scopes || [];
    const hasPermission = permission.scopes.some(
      (scope) => userScopes.includes(scope) || userScopes.includes("admin"),
    );

    if (!hasPermission) {
      console.log(
        `[permission] 权限不足: 用户 ${request.user.id} 尝试访问 ${routeKey}`,
        `所需: ${permission.scopes.join(", ")}, 拥有: ${userScopes.join(", ")}`,
      );

      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "无权限执行此操作",
        },
      });
    }
  }
}
```

---

## 7. 安全设计

### 7.1 认证安全

| 安全措施        | 实现方式                                                |
| --------------- | ------------------------------------------------------- |
| JWT 短有效期    | Access Token 15 分钟过期                                |
| 刷新 Token 轮转 | 每次刷新生成新的 Refresh Token                          |
| Token 存储      | Access Token 仅存内存，Refresh Token 存 httpOnly Cookie |
| 登录尝试限制    | 5 次失败后锁定 15 分钟                                  |
| 验证码限制      | 每个手机号 60 秒内只能发送一次                          |

### 7.2 请求安全

| 安全措施      | 实现方式                              |
| ------------- | ------------------------------------- |
| HTTPS         | 强制 HTTPS，HSTS 头                   |
| CORS          | 限制允许的源                          |
| CSRF          | 使用 SameSite Cookie + CSRF Token     |
| Rate Limiting | 全局 100 req/min，敏感接口 10 req/min |
| 请求大小限制  | 最大 10MB                             |

### 7.3 数据安全

| 安全措施     | 实现方式                    |
| ------------ | --------------------------- |
| 输入验证     | Zod schema 验证所有输入     |
| SQL 注入防护 | 使用 Drizzle ORM 参数化查询 |
| XSS 防护     | React 自动转义 + CSP 头     |
| 敏感数据脱敏 | 手机号、邮箱等在日志中脱敏  |

### 7.4 审计日志

所有敏感操作都记录审计日志：

| 操作类型               | 描述         |
| ---------------------- | ------------ |
| `auth.login`           | 用户登录     |
| `auth.logout`          | 用户登出     |
| `auth.password-change` | 密码修改     |
| `device.link`          | 设备配对     |
| `device.unlink`        | 设备解绑     |
| `skill.subscribe`      | 技能订阅     |
| `skill.unsubscribe`    | 取消订阅     |
| `user.update`          | 用户信息更新 |
| `user.suspend`         | 用户停用     |
| `config.update`        | 系统配置修改 |

---

## 8. 部署架构

### 8.1 开发环境

```
┌─────────────────────────────────────────────────────────────────┐
│                        开发环境                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐         ┌─────────────────┐              │
│   │   Vite Dev      │  proxy  │   Gateway       │              │
│   │   localhost:5173│ ──────► │   localhost:3000│              │
│   └─────────────────┘         └─────────────────┘              │
│                                       │                         │
│                                       ▼                         │
│                               ┌─────────────────┐              │
│                               │   PostgreSQL    │              │
│                               │   localhost:5432│              │
│                               └─────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 生产环境

```
┌─────────────────────────────────────────────────────────────────┐
│                        生产环境                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐         ┌─────────────────┐              │
│   │   CDN           │         │   负载均衡       │              │
│   │   (静态资源)     │         │   (API 请求)     │              │
│   └────────┬────────┘         └────────┬────────┘              │
│            │                           │                        │
│            ▼                           ▼                        │
│   ┌─────────────────┐         ┌─────────────────┐              │
│   │   OSS/S3        │         │   Gateway 集群   │              │
│   │   (前端构建产物)  │         │   (多实例)       │              │
│   └─────────────────┘         └────────┬────────┘              │
│                                        │                        │
│            ┌───────────────────────────┼───────────────────┐   │
│            ▼                           ▼                   ▼   │
│   ┌─────────────────┐         ┌─────────────────┐ ┌──────────┐│
│   │   PostgreSQL    │         │   Redis         │ │ MinIO    ││
│   │   (RDS)         │         │   (Session)     │ │ (文件)   ││
│   └─────────────────┘         └─────────────────┘ └──────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. 实施计划

### 9.1 开发阶段

| 阶段    | 内容                           | 优先级 |
| ------- | ------------------------------ | ------ |
| Phase 1 | 项目初始化、布局组件、认证流程 | P0     |
| Phase 2 | 设备管理、技能商店             | P0     |
| Phase 3 | 订阅管理、用户设置             | P1     |
| Phase 4 | 管理员功能、审计日志           | P1     |
| Phase 5 | 系统监控、性能优化             | P2     |

### 9.2 测试计划

| 测试类型 | 工具            | 覆盖率目标    |
| -------- | --------------- | ------------- |
| 单元测试 | Vitest          | 80%           |
| 组件测试 | Testing Library | 70%           |
| E2E 测试 | Playwright      | 关键流程 100% |
| API 测试 | Vitest          | 90%           |

---

## 附录 A: 类型定义

```typescript
// src/types/user.ts

export interface User {
  id: string;
  phone?: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  status: "active" | "suspended" | "deleted";
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  timezone: string;
  locale: string;
  scopes: string[];
  createdAt: string;
  lastLoginAt?: string;
}

// src/types/device.ts

export interface Device {
  id: string;
  displayName: string;
  platform: "windows" | "macos" | "linux" | "android" | "ios";
  platformVersion?: string;
  appVersion?: string;
  role: "owner" | "member" | "guest";
  scopes: string[];
  status: "online" | "offline";
  lastActiveAt: string;
  linkedAt: string;
}

// src/types/skill.ts

export interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  category: string;
  price: number;
  pricePeriod: "month" | "year" | "once";
  rating: number;
  reviewCount: number;
  installCount: number;
  isActive: boolean;
}

export interface UserSkill {
  id: string;
  skill: Skill;
  installedAt: string;
  configuration: Record<string, unknown>;
  isFavorite: boolean;
}

// src/types/subscription.ts

export interface Subscription {
  id: string;
  plan: Plan;
  skill?: Skill;
  status: "active" | "canceled" | "expired";
  startedAt: string;
  expiresAt: string;
  autoRenew: boolean;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  period: "month" | "year";
  features: string[];
}
```

---

## 附录 B: 环境变量

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws

# .env.production
VITE_API_BASE_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com/ws
```

---

## 附录 C: 参考资料

- [React 官方文档](https://react.dev/)
- [Vite 官方文档](https://vitejs.dev/)
- [shadcn/ui 组件库](https://ui.shadcn.com/)
- [TanStack Query 文档](https://tanstack.com/query)
- [Zustand 状态管理](https://docs.pmnd.rs/zustand)
- [React Router 文档](https://reactrouter.com/)
