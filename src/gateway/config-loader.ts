/**
 * Gateway 配置加载器
 *
 * 支持多种配置源:
 * 1. 数据库配置 (优先级最高)
 * 2. 环境变量
 * 3. 默认配置
 */

import { getLogger } from "../logging/logger.js";
import { getDatabase } from "../db/connection.js";
import { GatewayConfigRepository } from "../db/repositories/gateway-configs.js";

const logger = getLogger();

/**
 * Gateway 配置接口
 */
export interface GatewayConfig {
  mode: "local" | "remote";
  port: number;
  bind: "loopback" | "tailnet" | "0.0.0.0" | "::";
  auth: {
    mode: "none" | "token" | "password";
    token?: string;
    password?: string;
    allowTailscale?: boolean;
  };
  controlUi: {
    enabled: boolean;
    allowInsecureAuth: boolean;
  };
  tailscale: {
    mode: "off" | "serve";
    resetOnExit: boolean;
  };
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: GatewayConfig = {
  mode: "local",
  port: 18789,
  bind: "loopback",
  auth: {
    mode: "none", // 开发环境默认无需认证
    allowTailscale: false,
  },
  controlUi: {
    enabled: true,
    allowInsecureAuth: true, // 开发环境允许
  },
  tailscale: {
    mode: "off",
    resetOnExit: false,
  },
};

/**
 * 从环境变量加载配置
 */
function loadConfigFromEnv(): Partial<GatewayConfig> {
  const config: Partial<GatewayConfig> = {};

  // Gateway 模式
  if (process.env.GATEWAY_MODE) {
    config.mode = process.env.GATEWAY_MODE as "local" | "remote";
  }

  // Gateway 端口
  if (process.env.GATEWAY_PORT) {
    config.port = parseInt(process.env.GATEWAY_PORT, 10);
  }

  // Gateway 绑定地址
  if (process.env.GATEWAY_BIND) {
    config.bind = process.env.GATEWAY_BIND as any;
  }

  // 认证配置
  if (process.env.GATEWAY_AUTH_MODE) {
    config.auth = {
      mode: process.env.GATEWAY_AUTH_MODE as "none" | "token" | "password",
      token: process.env.GATEWAY_AUTH_TOKEN,
      password: process.env.GATEWAY_AUTH_PASSWORD,
    };
  }

  return config;
}

/**
 * 从数据库加载配置
 */
async function loadConfigFromDatabase(userId?: string): Promise<GatewayConfig | null> {
  try {
    const db = getDatabase();
    const repo = new GatewayConfigRepository(db);

    // 获取有效配置 (租户配置优先)
    const dbConfig = await repo.getEffectiveConfig(userId);

    if (!dbConfig) {
      return null;
    }

    // 转换数据库配置为 Gateway 配置格式
    return {
      mode: (dbConfig.gatewayMode as "local" | "remote") || "local",
      port: dbConfig.gatewayPort || 18789,
      bind: (dbConfig.gatewayBind as any) || "loopback",
      auth: {
        mode: (dbConfig.authMode as "none" | "token" | "password") || "none",
        token: dbConfig.authToken || undefined,
        password: dbConfig.authPassword || undefined,
        allowTailscale: dbConfig.authAllowTailscale || false,
      },
      controlUi: {
        enabled: dbConfig.controlUiEnabled !== false,
        allowInsecureAuth: dbConfig.controlUiAllowInsecureAuth || false,
      },
      tailscale: {
        mode: (dbConfig.tailscaleMode as "off" | "serve") || "off",
        resetOnExit: dbConfig.tailscaleResetOnExit || false,
      },
    };
  } catch (error) {
    logger.warn("[ConfigLoader] 从数据库加载配置失败:", error);
    return null;
  }
}

/**
 * 加载 Gateway 配置
 *
 * 配置优先级:
 * 1. 数据库配置 (租户配置 > 系统配置)
 * 2. 环境变量
 * 3. 默认配置
 */
export async function loadGatewayConfig(userId?: string): Promise<GatewayConfig> {
  logger.info("[ConfigLoader] 加载 Gateway 配置...", { userId });

  // 1. 尝试从数据库加载
  try {
    const dbConfig = await loadConfigFromDatabase(userId);
    if (dbConfig) {
      logger.info("[ConfigLoader] 使用数据库配置");
      return dbConfig;
    }
  } catch (error) {
    logger.warn("[ConfigLoader] 数据库配置加载失败,回退到环境变量:", error);
  }

  // 2. 从环境变量加载
  const envConfig = loadConfigFromEnv();

  // 3. 合并配置 (环境变量 > 默认配置)
  const finalConfig: GatewayConfig = {
    ...DEFAULT_CONFIG,
    ...envConfig,
    auth: {
      ...DEFAULT_CONFIG.auth,
      ...envConfig.auth,
    },
    controlUi: {
      ...DEFAULT_CONFIG.controlUi,
      ...envConfig.controlUi,
    },
    tailscale: {
      ...DEFAULT_CONFIG.tailscale,
      ...envConfig.tailscale,
    },
  };

  logger.info("[ConfigLoader] 使用环境变量 + 默认配置", {
    mode: finalConfig.mode,
    port: finalConfig.port,
    authMode: finalConfig.auth.mode,
  });

  return finalConfig;
}

/**
 * 验证配置有效性
 */
export function validateGatewayConfig(config: GatewayConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 验证端口
  if (config.port < 1 || config.port > 65535) {
    errors.push(`无效的端口号: ${config.port}`);
  }

  // 验证认证模式
  if (config.auth.mode === "token" && !config.auth.token) {
    errors.push("认证模式为 token,但未提供 token");
  }

  if (config.auth.mode === "password" && !config.auth.password) {
    errors.push("认证模式为 password,但未提供 password");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
