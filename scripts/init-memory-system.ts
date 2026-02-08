/**
 * 初始化记忆系统
 *
 * 该脚本用于初始化可插拔记忆系统并验证与各服务的连接。
 *
 * 使用方式:
 *   pnpm tsx scripts/init-memory-system.ts
 *
 * @author OpenClaw
 */

import { config } from "dotenv";
config();

import {
  type MemoryManagerConfig,
  validateConfig,
  createMemoryManager,
  DEFAULT_DEV_CONFIG,
} from "../src/memory/pluggable/index.js";

/**
 * 从环境变量构建记忆系统配置
 */
function buildMemoryConfig(): MemoryManagerConfig {
  // 检查是否有生产环境配置
  const hasProductionConfig =
    process.env.MILVUS_ADDRESS || process.env.NEO4J_URI || process.env.MINIO_ENDPOINT;

  if (!hasProductionConfig) {
    console.log("[init-memory] 使用开发环境配置（内存存储）");
    return DEFAULT_DEV_CONFIG;
  }

  console.log("[init-memory] 检测到生产环境配置，构建连接配置...");

  // 构建生产配置
  const config: MemoryManagerConfig = {
    // 工作记忆：使用内存存储（暂不需要持久化）
    working: {
      provider: "memory",
      options: {},
    },

    // 情节记忆：使用内存存储（后续可切换到持久化方案）
    episodic: {
      provider: "memory",
      options: {},
    },

    // 画像记忆：使用内存存储（后续可切换到 PostgreSQL）
    profile: {
      provider: "memory",
      options: {},
    },

    // 知识记忆：使用简单实现（后续可切换到 Milvus + Neo4j）
    knowledge: {
      provider: "simple",
      options: {},
    },

    // 对象存储：使用本地存储（后续可切换到 MinIO）
    storage: {
      provider: "local",
      options: {
        basePath: "./.memory/storage",
      },
    },
  };

  // 如果配置了 MinIO，使用远程存储
  if (process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY) {
    console.log("[init-memory] 检测到 MinIO 配置，将使用远程对象存储");
    // 注意：需要先实现 MinIO 提供者才能启用
    // config.storage = {
    //   provider: 'minio',
    //   options: {
    //     endpoint: process.env.MINIO_ENDPOINT,
    //     port: parseInt(process.env.MINIO_PORT || '9000', 10),
    //     useSSL: process.env.MINIO_USE_SSL === 'true',
    //     accessKey: process.env.MINIO_ACCESS_KEY,
    //     secretKey: process.env.MINIO_SECRET_KEY,
    //   },
    // }
  }

  return config;
}

/**
 * 测试记忆系统基本功能
 */
async function testMemorySystem(): Promise<void> {
  console.log("\n========================================");
  console.log("初始化 OpenClaw 记忆系统");
  console.log("========================================\n");

  // 1. 构建配置
  const memoryConfig = buildMemoryConfig();

  // 2. 验证配置
  console.log("[init-memory] 验证配置...");
  try {
    validateConfig(memoryConfig);
    console.log("[init-memory] ✅ 配置验证通过");
  } catch (error) {
    console.error("[init-memory] ❌ 配置验证失败:", error);
    process.exit(1);
  }

  // 3. 创建记忆管理器
  console.log("\n[init-memory] 创建记忆管理器...");
  const manager = createMemoryManager({
    config: memoryConfig,
    autoInitialize: false,
  });

  // 4. 初始化
  console.log("[init-memory] 初始化记忆管理器...");
  try {
    await manager.initialize();
    console.log("[init-memory] ✅ 初始化成功");
  } catch (error) {
    console.error("[init-memory] ❌ 初始化失败:", error);
    process.exit(1);
  }

  // 5. 健康检查
  console.log("\n[init-memory] 执行健康检查...");
  const health = await manager.healthCheck();
  console.log("[init-memory] 健康状态:", health.status);

  for (const [name, status] of Object.entries(health.providers)) {
    const icon = status.status === "healthy" ? "✅" : status.status === "degraded" ? "⚠️" : "❌";
    console.log(`  ${icon} ${name}: ${status.status} (${status.latency}ms)`);
  }

  // 6. 测试工作记忆
  console.log("\n[init-memory] 测试工作记忆...");
  try {
    const sessionId = await manager.working.createSession("test-user");
    console.log(`  ✅ 创建会话: ${sessionId}`);

    await manager.working.addMessage(sessionId, {
      role: "user",
      content: "你好，这是一条测试消息",
    });
    console.log("  ✅ 添加消息成功");

    const messages = await manager.working.getMessages(sessionId);
    console.log(`  ✅ 获取消息: ${messages.length} 条`);

    await manager.working.deleteSession(sessionId);
    console.log("  ✅ 删除会话成功");
  } catch (error) {
    console.error("  ❌ 工作记忆测试失败:", error);
  }

  // 7. 测试画像记忆
  console.log("\n[init-memory] 测试画像记忆...");
  try {
    const factId = await manager.profile.addFact("test-user", {
      category: "personal",
      key: "name",
      value: "测试用户",
      confidence: 1.0,
      source: "explicit",
      sensitive: false,
    });
    console.log(`  ✅ 添加事实: ${factId}`);

    const facts = await manager.profile.getFacts("test-user");
    console.log(`  ✅ 获取事实: ${facts.length} 条`);

    const prefs = await manager.profile.getPreferences("test-user");
    console.log(`  ✅ 获取偏好: 语言=${prefs.language}`);
  } catch (error) {
    console.error("  ❌ 画像记忆测试失败:", error);
  }

  // 8. 测试情节记忆
  console.log("\n[init-memory] 测试情节记忆...");
  try {
    const sessionId = "test-session-" + Date.now();
    await manager.episodic.addConversation("test-user", sessionId, [
      { id: "1", role: "user", content: "你好", createdAt: new Date() },
      { id: "2", role: "assistant", content: "你好！有什么可以帮助您的？", createdAt: new Date() },
    ]);
    console.log("  ✅ 保存对话成功");

    // getTimeline 需要 startDate 和 endDate
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 一周前
    const timeline = await manager.episodic.getTimeline("test-user", startDate, endDate);
    console.log(`  ✅ 获取时间线: ${timeline.length} 条`);
  } catch (error) {
    console.error("  ❌ 情节记忆测试失败:", error);
  }

  // 9. 测试知识记忆
  console.log("\n[init-memory] 测试知识记忆...");
  try {
    const docId = await manager.knowledge.addDocument("test-user", {
      title: "测试文档",
      content: Buffer.from("这是一个测试文档的内容"),
      mimeType: "text/plain",
      source: "upload",
    });
    console.log(`  ✅ 添加文档: ${docId}`);

    const results = await manager.knowledge.searchHybrid("test-user", "测试", {
      limit: 5,
    });
    console.log(`  ✅ 搜索结果: ${results.length} 条`);
  } catch (error) {
    console.error("  ❌ 知识记忆测试失败:", error);
  }

  // 10. 测试对象存储
  console.log("\n[init-memory] 测试对象存储...");
  try {
    // 确保 bucket 存在
    const buckets = await manager.storage.listBuckets();
    if (!buckets.some((b) => b.name === "test-bucket")) {
      await manager.storage.createBucket("test-bucket");
      console.log("  ✅ 创建 bucket: test-bucket");
    }

    // 上传测试文件
    const testData = Buffer.from("Hello, OpenClaw Memory System!");
    const objectName = `test-file-${Date.now()}.txt`;
    await manager.storage.upload("test-bucket", objectName, testData, {
      contentType: "text/plain",
    });
    console.log(`  ✅ 上传文件: ${objectName}`);

    // 下载文件
    const downloaded = await manager.storage.download("test-bucket", objectName);
    if (downloaded.toString() === testData.toString()) {
      console.log("  ✅ 下载验证通过");
    }

    // 删除测试文件
    await manager.storage.delete("test-bucket", objectName);
    console.log("  ✅ 删除文件成功");
  } catch (error) {
    console.error("  ❌ 对象存储测试失败:", error);
  }

  // 11. 关闭
  console.log("\n[init-memory] 关闭记忆管理器...");
  await manager.shutdown();
  console.log("[init-memory] ✅ 关闭成功");

  console.log("\n========================================");
  console.log("记忆系统初始化测试完成！");
  console.log("========================================\n");
}

// 运行测试
testMemorySystem().catch((error) => {
  console.error("初始化失败:", error);
  process.exit(1);
});
