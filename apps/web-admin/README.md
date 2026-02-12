# Web Admin - 用户管理后台

OpenClaw 用户管理后台是面向普通用户的 Web 管理界面，用于管理个人设备、技能订阅、账户设置和使用数据查看。

## 功能特性

### 核心功能模块

- **仪表盘 (Dashboard)** - 个人数据概览、设备状态、使用统计
- **设备管理 (Devices)** - 设备列表、设备详情、远程控制、设备配对
- **技能中心 (Skills)**
  - 技能商店 - 浏览、搜索、订阅技能
  - 我的技能 - 已订阅技能管理、本地技能上传
- **订阅管理 (Subscription)** - 套餐升级、订单历史、发票下载
- **个人设置 (Settings)**
  - 个人资料 - 头像、昵称、邮箱修改
  - 安全设置 - 密码修改、两步验证、登录设备管理

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

访问 http://localhost:5174 查看应用。

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
apps/web-admin/
├── src/
│   ├── components/          # 可复用组件
│   │   ├── layout/         # 布局组件（Header, Sidebar, AppLayout）
│   │   └── ui/             # UI 基础组件
│   ├── pages/              # 页面组件
│   │   ├── admin/          # 管理员页面（用户管理、系统监控、审计日志）
│   │   ├── auth/           # 认证页面（登录、注册）
│   │   ├── dashboard/      # 仪表盘页面
│   │   ├── devices/        # 设备管理页面
│   │   ├── settings/       # 个人设置页面
│   │   ├── skills/         # 技能中心页面
│   │   └── subscription/   # 订阅管理页面
│   ├── routes/             # 路由配置
│   │   ├── AdminRoute.tsx  # 管理员路由守卫
│   │   ├── PrivateRoute.tsx # 登录路由守卫
│   │   └── index.tsx       # 路由配置
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

### 用户权限管理

- **普通用户**: 可访问仪表盘、设备管理、技能中心、订阅管理、个人设置
- **管理员**: 额外可访问用户管理、系统监控、审计日志

使用 `AdminRoute` 组件保护管理员专属路由：

```tsx
<Route element={<AdminRoute />}>
  <Route path="/admin/users" element={<UsersPage />} />
</Route>
```

### 添加新页面

1. 在 `src/pages/` 下创建页面组件
2. 在 `src/routes/index.tsx` 中注册路由
3. 在 `src/components/layout/Sidebar.tsx` 中添加导航链接
4. 根据需要使用 `PrivateRoute` 或 `AdminRoute` 保护路由

### 设备管理集成

设备管理页面通过 WebSocket 与后端保持实时连接，支持：

- 实时设备状态更新
- 远程命令执行
- 设备配对与解绑
- 设备详情查看

### 技能商店集成

技能商店支持：

- 技能浏览与搜索
- 技能详情查看
- 一键订阅/取消订阅
- 本地技能上传与管理

## 部署

### 静态部署

构建后将 `dist/` 目录部署到任意静态服务器。

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name admin.openclaw.ai;

    root /var/www/web-admin/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker 部署

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 与 Admin Console 的区别

| 特性 | Web Admin (用户后台) | Admin Console (管理员控制台) |
|------|---------------------|---------------------------|
| 目标用户 | 普通用户 + 管理员 | 仅管理员 |
| 主要功能 | 设备管理、技能订阅、个人设置 | 用户管理、数据分析、系统配置 |
| 权限控制 | 基于用户角色 | 仅管理员可访问 |
| 数据范围 | 个人数据 | 全局数据 |
| 部署方式 | 面向公网 | 可内网部署 |

## 相关文档

- [OpenClaw 主项目](../../README.md)
- [Admin Console](../admin-console/README.md)
- [API 文档](../../docs/api/)
- [部署指南](../../docs/deployment/)

## 许可证

MIT License
