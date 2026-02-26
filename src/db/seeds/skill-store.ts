/**
 * 技能商店种子数据
 *
 * 初始化技能分类和示例技能
 */

import { getDatabase } from "../connection.js";
import { skillCategories, skillStoreItems } from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/**
 * 默认技能分类
 */
const DEFAULT_CATEGORIES = [
  {
    name: "开发工具",
    description: "代码生成、调试、测试等开发辅助工具",
    icon: "🛠️",
    sortOrder: 1,
  },
  {
    name: "数据分析",
    description: "数据处理、可视化、统计分析工具",
    icon: "📊",
    sortOrder: 2,
  },
  {
    name: "文本处理",
    description: "文本编辑、格式转换、内容生成工具",
    icon: "📝",
    sortOrder: 3,
  },
  {
    name: "图像处理",
    description: "图片编辑、格式转换、AI 生成工具",
    icon: "🖼️",
    sortOrder: 4,
  },
  {
    name: "自动化",
    description: "工作流自动化、任务调度工具",
    icon: "⚙️",
    sortOrder: 5,
  },
  {
    name: "通信协作",
    description: "消息发送、邮件处理、团队协作工具",
    icon: "💬",
    sortOrder: 6,
  },
  {
    name: "系统管理",
    description: "系统监控、文件管理、网络工具",
    icon: "🖥️",
    sortOrder: 7,
  },
  {
    name: "娱乐休闲",
    description: "游戏、音乐、视频等娱乐工具",
    icon: "🎮",
    sortOrder: 8,
  },
];

/**
 * 初始化技能分类
 */
export async function seedSkillCategories(): Promise<void> {
  logger.info("[seed] 开始初始化技能分类");

  const db = await getDatabase();

  // 检查是否已有分类
  const existing = await db.select().from(skillCategories).limit(1);

  if (existing.length > 0) {
    logger.info("[seed] 技能分类已存在，跳过初始化");
    return;
  }

  // 插入默认分类
  const categories = DEFAULT_CATEGORIES.map((cat) => ({
    id: generateId(),
    ...cat,
    skillCount: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  await db.insert(skillCategories).values(categories);

  logger.info(`[seed] 成功创建 ${categories.length} 个技能分类`);
}

/**
 * 初始化示例技能
 */
export async function seedExampleSkills(): Promise<void> {
  logger.info("[seed] 开始初始化示例技能");

  const db = await getDatabase();

  // 检查是否已有技能
  const existing = await db.select().from(skillStoreItems).limit(1);

  if (existing.length > 0) {
    logger.info("[seed] 技能已存在，跳过初始化");
    return;
  }

  // 获取分类
  const categories = await db.select().from(skillCategories);

  if (categories.length === 0) {
    logger.warn("[seed] 未找到技能分类，请先初始化分类");
    return;
  }

  // 创建示例技能
  const devCategory = categories.find((c) => c.name === "开发工具");
  const textCategory = categories.find((c) => c.name === "文本处理");

  const exampleSkills = [
    {
      id: generateId(),
      name: "代码格式化",
      description: "自动格式化代码，支持多种编程语言",
      readme: `# 代码格式化工具

## 功能特性

- 支持 JavaScript、TypeScript、Python、Go 等多种语言
- 自动检测代码风格
- 可自定义格式化规则

## 使用方法

\`\`\`
格式化代码：<语言> <代码>
\`\`\`

## 示例

\`\`\`
格式化代码：javascript
function hello(){console.log("Hello")}
\`\`\`
`,
      authorId: null,
      authorName: "MtBot 官方",
      version: "1.0.0",
      categoryId: devCategory?.id,
      tags: ["代码", "格式化", "开发"],
      status: "published" as const,
      subscriptionLevel: "free" as const,
      downloadCount: 0,
      ratingAvg: "0",
      ratingCount: 0,
      isFeatured: true,
      featuredOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
    },
    {
      id: generateId(),
      name: "Markdown 转换",
      description: "Markdown 与其他格式互相转换",
      readme: `# Markdown 转换工具

## 功能特性

- Markdown 转 HTML
- Markdown 转 PDF
- HTML 转 Markdown
- 支持自定义样式

## 使用方法

\`\`\`
转换：<源格式> to <目标格式>
<内容>
\`\`\`

## 示例

\`\`\`
转换：markdown to html
# 标题
这是一段文本
\`\`\`
`,
      authorId: null,
      authorName: "MtBot 官方",
      version: "1.0.0",
      categoryId: textCategory?.id,
      tags: ["markdown", "转换", "文档"],
      status: "published" as const,
      subscriptionLevel: "free" as const,
      downloadCount: 0,
      ratingAvg: "0",
      ratingCount: 0,
      isFeatured: true,
      featuredOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
    },
  ];

  await db.insert(skillStoreItems).values(exampleSkills);

  logger.info(`[seed] 成功创建 ${exampleSkills.length} 个示例技能`);
}

/**
 * 运行所有种子数据初始化
 */
export async function runSkillSeeds(): Promise<void> {
  logger.info("[seed] 开始初始化技能商店种子数据");

  try {
    await seedSkillCategories();
    await seedExampleSkills();

    logger.info("[seed] 技能商店种子数据初始化完成");
  } catch (error) {
    logger.error("[seed] 技能商店种子数据初始化失败", { error });
    throw error;
  }
}
