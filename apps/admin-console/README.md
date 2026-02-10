# Admin Console - 管理员控制台

OpenClaw 管理员控制台是一个基于 React + TypeScript 的现代化 Web 管理平台，用于管理用户、订阅、技能商店、系统配置和运营数据分析。

## 功能特性

### 核心功能模块

- **仪表盘 (Dashboard)** - 实时数据概览、关键指标监控、图表可视化
- **用户管理 (Users)** - 用户列表、详情查看、权限管理、账户操作
- **订阅管理 (Subscriptions)** - 订阅计划、订单管理、支付记录
- **技能商店 (Skills)** - 技能审核、分类管理、推荐配置
- **数据分析 (Analytics)** - 用户分析、收入分析、漏斗分析、技能使用统计
- **系统配置 (Config)** - 站点配置、功能开关、安全设置、通知配置
- **监控告警 (Monitor)** - 系统日志、性能监控、告警管理
- **审计日志 (Audit)** - 操作记录、安全审计、合规追踪

### 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **路由**: React Router v6
- **状态管理**: Zustand + TanStack Query
- **UI 组件**: Radix UI + Tailwind CSS
- **表单处理**: React Hook Form + Zod
- **图表**: Recharts
- **测试**: Vitest

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

访问 http://localhost:5173 查看应用。

### 构建生产版本

```bash
pnpm build
```

构建产物输出到 `dist/` 目录。

### 预览生产构建

```bash
pnpm preview
```

### 代码检查

```bash
pnpm lint
```

### 运行测试

```bash
# 运行测试
pnpm test

# 监听模式
pnpm test:watch
```

## 项目结构

```
apps/admin-console/
├── src/
│   ├── components/          # 可复用组件
│   │   ├── layout/         # 布局组件（Header, Sidebar, AdminLayout）
│   │   └── ui/             # UI 基础组件（基于 Radix UI）
│   ├── pages/              # 页面组件
│   │   ├── analytics/      # 数据分析页面
│   │   ├── audit/          # 审计日志页面
│   │   ├── auth/           # 认证页面（登录）
│   │   ├── config/         # 系统配置页面
│   │   ├── dashboard/      # 仪表盘页面
│   │   ├── monitor/        # 监控告警页面
│   │   ├── skills/         # 技能管理页面
│   │   ├── subscriptions/  # 订阅管理页面
│   │   └── users/          # 用户管理页面
│   ├── routes/             # 路由配置
│   ├── hooks/              # 自定义 Hooks
│   ├── services/           # API 服务
│   ├── stores/             # 状态管理
│   ├── types/              # TypeScript 类型定义
│   ├── utils/              # 工具函数
│   ├── main.tsx            # 应用入口
│   └── App.tsx             # 根组件
├── dist/                   # 构建输出目录
├── index.html              # HTML 模板
├── package.json            # 项目配置
├── tsconfig.json           # TypeScript 配置
├── vite.config.ts          # Vite 配置
├── tailwind.config.js      # Tailwind CSS 配置
└── postcss.config.js       # PostCSS 配置
```

## 环境配置

创建 `.env.development` 文件配置开发环境变量：

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

## 开发指南

### 添加新页面

1. 在 `src/pages/` 下创建页面组件
2. 在 `src/routes/index.tsx` 中注册路由
3. 在 `src/components/layout/Sidebar.tsx` 中添加导航链接

### 添加新的 API 服务

1. 在 `src/services/` 下创建服务文件
2. 使用 TanStack Query 封装数据请求
3. 在组件中通过自定义 Hook 调用

### UI 组件开发

- 基础组件位于 `src/components/ui/`，基于 Radix UI 封装
- 使用 Tailwind CSS 进行样式定制
- 遵循 shadcn/ui 设计规范

## 部署

### 静态部署

构建后将 `dist/` 目录部署到任意静态服务器（Nginx、Apache、CDN 等）。

### Docker 部署

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 环境变量配置

生产环境需要配置以下环境变量：

- `VITE_API_BASE_URL` - 后端 API 地址
- `VITE_WS_URL` - WebSocket 服务地址

## 相关文档

- [OpenClaw 主项目](../../README.md)
- [API 文档](../../docs/api/)
- [部署指南](../../docs/deployment/)

## 许可证

MIT License
