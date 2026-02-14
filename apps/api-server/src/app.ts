/**
 * App Server 应用入口
 *
 * 加载配置 → 创建 Fastify 实例 → 启动 HTTP 服务
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

// 加载 .env 文件
config({ path: resolve(process.cwd(), ".env") });

/**
 * 启动 App Server
 */
async function main(): Promise<void> {
  const config = loadConfig();

  const server = await createServer(config);

  try {
    const address = await server.listen({
      port: config.port,
      host: config.host,
    });
    server.log.info(`[api-server] App Server 启动成功: ${address}`);
    server.log.info(`[api-server] 健康检查: ${address}/api/health`);
  } catch (error) {
    server.log.error(error, "[api-server] 启动失败");
    process.exit(1);
  }

  // 优雅关闭
  const shutdown = async (signal: string) => {
    server.log.info(`[api-server] 收到 ${signal} 信号，开始优雅关闭...`);
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
