/**
 * App Server 环境变量配置
 *
 * 集中管理所有配置项，启动时校验必填项
 */

export interface AppConfig {
  /** 服务端口号 */
  port: number;
  /** 服务主机地址 */
  host: string;
  /** 运行环境 */
  nodeEnv: "development" | "production" | "test";
  /** 数据库连接字符串 */
  databaseUrl: string;
  /** JWT 密钥（用户） */
  jwtSecret: string;
  /** JWT 密钥（管理员，可选，默认使用 jwtSecret） */
  adminJwtSecret: string;
  /** CORS 允许的来源 */
  corsOrigins: string[];
  /** API 限流：每分钟最大请求数 */
  rateLimitMax: number;
  /** 日志级别 */
  logLevel: string;
}

/**
 * 从环境变量加载配置
 *
 * @throws 缺少必填环境变量时抛出错误
 */
export function loadConfig(): AppConfig {
  const jwtSecret = process.env.JWT_SECRET ?? "";
  const adminJwtSecret = process.env.ADMIN_JWT_SECRET ?? jwtSecret;

  if (!jwtSecret) {
    throw new Error("[config] JWT_SECRET 环境变量未配置");
  }

  const databaseUrl =
    process.env.DATABASE_URL ?? "postgresql://localhost:5432/openclaw";

  const nodeEnv = (process.env.NODE_ENV ??
    "development") as AppConfig["nodeEnv"];

  const corsOriginsRaw =
    process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:5174";
  const corsOrigins = corsOriginsRaw.split(",").map((s) => s.trim());

  return {
    port: Number(process.env.API_SERVER_PORT ?? "3000"),
    host: process.env.API_SERVER_HOST ?? "0.0.0.0",
    nodeEnv,
    databaseUrl,
    jwtSecret,
    adminJwtSecret,
    corsOrigins,
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? "100"),
    logLevel:
      process.env.LOG_LEVEL ?? (nodeEnv === "production" ? "info" : "debug"),
  };
}
