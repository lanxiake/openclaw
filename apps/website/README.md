# Website - 官方网站

OpenClaw（麦图助手）官方网站是一个现代化的产品展示页面，采用纯静态 HTML + CSS + JavaScript 实现，无需构建工具，开箱即用。

## 功能特性

### 页面模块

- **Hero 区域** - 产品核心价值主张、CTA 按钮、关键数据展示
- **核心功能** - 4 大核心功能卡片展示（自然语言控制、技能生态、多设备管理、安全可控）
- **使用流程** - 3 步上手指南（下载安装、对话交互、自动执行）
- **产品展示** - 终端模拟器 + 打字机效果演示实际使用场景
- **定价方案** - 免费版、专业版、企业版三档套餐对比
- **常见问题** - FAQ 手风琴折叠展示
- **下载 CTA** - 多平台下载入口
- **Footer** - 公司信息、ICP 备案、联系方式

### 交互特性

- **滚动淡入动画** - 基于 IntersectionObserver 的视口检测动画
- **导航栏效果** - 滚动毛玻璃背景 + 当前 section 高亮
- **移动端适配** - 响应式布局 + 汉堡菜单
- **FAQ 折叠** - 手风琴式问答展开/收起
- **终端打字机** - 模拟真实对话的逐字显示效果
- **平滑滚动** - 锚点跳转平滑过渡

### 技术栈

- **HTML5** - 语义化标签、SEO 优化
- **CSS3** - Flexbox/Grid 布局、CSS 变量、渐变、动画
- **Vanilla JavaScript** - 无框架依赖、原生 API
- **IntersectionObserver** - 高性能滚动检测
- **响应式设计** - 移动优先、断点适配

## 快速开始

### 本地预览

无需构建，直接用浏览器打开：

```bash
# 方式 1: 直接打开
open apps/website/index.html

# 方式 2: 使用本地服务器（推荐）
cd apps/website
python -m http.server 8080
# 访问 http://localhost:8080

# 方式 3: 使用 Node.js 服务器
npx serve .
```

### 文件结构

```
apps/website/
├── index.html          # 主页面
├── css/
│   └── styles.css      # 样式表（约 800 行）
└── js/
    └── main.js         # 交互逻辑（约 280 行）
```

## 项目结构说明

### HTML 结构

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <!-- SEO 元数据 -->
  <meta name="description" content="...">
  <meta property="og:title" content="...">
  <!-- 样式表 -->
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <!-- 导航栏 -->
  <nav class="nav" id="nav">...</nav>

  <!-- Hero 区域 -->
  <section class="hero" id="hero">...</section>

  <!-- 核心功能 -->
  <section class="section" id="features">...</section>

  <!-- 使用流程 -->
  <section class="section section-alt" id="how-it-works">...</section>

  <!-- 产品展示 -->
  <section class="section" id="showcase">...</section>

  <!-- 定价方案 -->
  <section class="section section-alt" id="pricing">...</section>

  <!-- 常见问题 -->
  <section class="section" id="faq">...</section>

  <!-- 下载 CTA -->
  <section class="section section-alt" id="download">...</section>

  <!-- Footer -->
  <footer class="footer">...</footer>

  <!-- 交互脚本 -->
  <script src="js/main.js"></script>
</body>
</html>
```

### CSS 架构

```css
/* 1. CSS 变量 - 颜色、字体、间距 */
:root {
  --color-primary: #6366f1;
  --color-bg: #0a0a0f;
  --font-sans: 'Inter', sans-serif;
  /* ... */
}

/* 2. 全局样式 - 重置、基础排版 */
*, *::before, *::after { box-sizing: border-box; }
body { font-family: var(--font-sans); }

/* 3. 布局组件 - 导航栏、Hero、Section */
.nav { position: fixed; top: 0; width: 100%; }
.hero { min-height: 100vh; display: flex; }

/* 4. UI 组件 - 按钮、卡片、徽章 */
.btn { padding: 12px 24px; border-radius: 8px; }
.card { background: var(--color-card); border-radius: 16px; }

/* 5. 动画效果 - 淡入、悬停、过渡 */
.fade-in { opacity: 0; transform: translateY(20px); }
.fade-in.visible { opacity: 1; transform: translateY(0); }

/* 6. 响应式断点 - 移动端适配 */
@media (max-width: 768px) {
  .nav-links { display: none; }
  .hero-title { font-size: 2rem; }
}
```

### JavaScript 模块

```javascript
// 1. 滚动淡入动画
function initFadeIn() {
  const observer = new IntersectionObserver(/* ... */);
  elements.forEach(el => observer.observe(el));
}

// 2. 导航栏滚动效果
function initNavScroll() {
  window.addEventListener('scroll', onScroll);
}

// 3. 移动端菜单
function initMobileMenu() {
  toggle.addEventListener('click', () => links.classList.toggle('open'));
}

// 4. FAQ 折叠
function initFAQ() {
  items.forEach(item => {
    btn.addEventListener('click', () => item.classList.toggle('active'));
  });
}

// 5. 终端打字机效果
function initTypewriter() {
  const observer = new IntersectionObserver(/* ... */);
  observer.observe(terminal);
}

// 6. 平滑锚点滚动
function initSmoothScroll() {
  links.forEach(link => {
    link.addEventListener('click', e => {
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}
```

## 定制指南

### 修改品牌信息

1. **产品名称**: 搜索 `麦图助手` 替换为你的产品名
2. **公司信息**: 修改 Footer 中的公司名称和 ICP 备案号
3. **联系方式**: 更新 `mailto:contact@mytoolbot.com`
4. **域名**: 修改 `og:url` 和其他域名引用

### 修改配色方案

在 `css/styles.css` 中修改 CSS 变量：

```css
:root {
  --color-primary: #6366f1;      /* 主色调 */
  --color-secondary: #8b5cf6;    /* 辅助色 */
  --color-accent: #06b6d4;       /* 强调色 */
  --color-bg: #0a0a0f;           /* 背景色 */
  --color-text: #e5e7eb;         /* 文字色 */
}
```

### 修改功能卡片

在 `index.html` 中找到 `<div class="features-grid">` 区域，修改或添加功能卡片：

```html
<div class="feature-card fade-in">
  <div class="feature-icon">
    <!-- SVG 图标 -->
  </div>
  <h3 class="feature-title">功能标题</h3>
  <p class="feature-desc">功能描述...</p>
</div>
```

### 修改定价方案

在 `index.html` 中找到 `<div class="pricing-grid">` 区域，修改价格和功能列表：

```html
<div class="pricing-card">
  <div class="pricing-name">套餐名称</div>
  <div class="pricing-price">¥29.9<span class="pricing-unit">/月</span></div>
  <ul class="pricing-features">
    <li>功能 1</li>
    <li>功能 2</li>
  </ul>
  <a href="#" class="btn btn-primary">立即购买</a>
</div>
```

### 修改终端演示内容

在 `js/main.js` 中找到 `initTypewriter()` 函数，修改对话文本：

```javascript
var userText = '你的用户输入...';
var aiText = 'AI 的回复...';
var resultText = '执行结果...';
```

## 性能优化

### 已实现的优化

- **IntersectionObserver** - 替代 scroll 事件，减少重排重绘
- **requestAnimationFrame** - 节流滚动处理
- **CSS 变量** - 减少重复代码，便于主题切换
- **内联 SVG** - 减少 HTTP 请求
- **语义化 HTML** - 提升 SEO 和可访问性

### 进一步优化建议

1. **图片优化** - 使用 WebP 格式、懒加载
2. **字体优化** - 使用 `font-display: swap`、子集化
3. **代码压缩** - 使用 Terser 压缩 JS、cssnano 压缩 CSS
4. **CDN 加速** - 静态资源托管到 CDN
5. **Gzip/Brotli** - 服务器端启用压缩

## 部署

### 静态托管

可部署到任意静态托管服务：

- **Vercel**: `vercel --prod`
- **Netlify**: 拖拽 `apps/website` 目录
- **GitHub Pages**: 推送到 `gh-pages` 分支
- **Cloudflare Pages**: 连接 Git 仓库
- **阿里云 OSS**: 上传到 OSS Bucket

### Nginx 配置

```nginx
server {
    listen 80;
    server_name mytoolbot.com;

    root /var/www/website;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 启用 Gzip 压缩
    gzip on;
    gzip_types text/css application/javascript image/svg+xml;

    # 缓存静态资源
    location ~* \.(css|js|jpg|png|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Docker 部署

```dockerfile
FROM nginx:alpine
COPY apps/website/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## SEO 优化

### 已实现的 SEO 优化

- ✅ 语义化 HTML 标签
- ✅ Meta 描述和关键词
- ✅ Open Graph 标签
- ✅ 结构化数据（可进一步添加 JSON-LD）
- ✅ 移动端友好（响应式设计）
- ✅ 快速加载（无外部依赖）

### 进一步优化建议

1. **添加 sitemap.xml** - 提交给搜索引擎
2. **添加 robots.txt** - 控制爬虫行为
3. **结构化数据** - 添加 JSON-LD 标记
4. **内链优化** - 增加内部链接
5. **外链建设** - 获取高质量外链

## 浏览器兼容性

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ IE 11（需要 polyfill）

如需支持 IE 11，需添加以下 polyfill：

```html
<script src="https://polyfill.io/v3/polyfill.min.js?features=IntersectionObserver"></script>
```

## 相关文档

- [OpenClaw 主项目](../../README.md)
- [Admin Console](../admin-console/README.md)
- [Web Admin](../web-admin/README.md)
- [Windows App](../windows/README.md)

## 许可证

MIT License
