/**
 * 管理后台系统配置 RPC 方法
 *
 * 提供系统配置管理相关的 API：
 * - admin.config.list - 获取配置列表
 * - admin.config.get - 获取单个配置
 * - admin.config.set - 设置配置值
 * - admin.config.create - 创建配置
 * - admin.config.delete - 删除配置
 * - admin.config.groups - 获取配置分组
 * - admin.config.history - 获取变更历史
 * - admin.config.reset - 重置为默认值
 * - admin.config.initialize - 初始化默认配置
 * - admin.config.batch - 批量设置配置
 * - admin.config.notifications.list/get/update/test - 通知模板管理
 *
 * 使用真实数据库存储配置
 */

import type { GatewayRequestHandler, GatewayRequestHandlers } from "./types.js";
import {
  getAllConfigs,
  getConfigByKey,
  getConfigValue,
  setConfigValue,
  createConfig,
  deleteConfig,
  setConfigsBatch,
  getConfigHistory,
  getConfigGroups,
  resetConfigToDefault,
  initializeDefaultConfigs,
} from "../../assistant/config/index.js";
import { CONFIG_GROUPS, CONFIG_KEYS } from "../../db/schema/system-config.js";

/**
 * 模拟通知模板数据（通知模板暂时保持 mock，后续可迁移到数据库）
 */
const mockNotificationTemplates = [
  {
    id: "tpl_001",
    name: "欢迎邮件",
    code: "welcome_email",
    channel: "email" as const,
    subject: "欢迎加入 OpenClaw",
    content: `尊敬的 {{username}}，

欢迎加入 OpenClaw！您的账号已成功创建。

您可以使用以下方式登录：
- 邮箱：{{email}}
- 手机：{{phone}}

如有任何问题，请联系我们的客服团队。

祝您使用愉快！
OpenClaw 团队`,
    variables: ["username", "email", "phone"],
    enabled: true,
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "tpl_002",
    name: "密码重置",
    code: "password_reset",
    channel: "email" as const,
    subject: "密码重置请求",
    content: `尊敬的 {{username}}，

您正在重置密码。请点击以下链接完成重置：

{{resetLink}}

此链接将在 {{expireTime}} 后失效。

如果这不是您的操作，请忽略此邮件。

OpenClaw 团队`,
    variables: ["username", "resetLink", "expireTime"],
    enabled: true,
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "tpl_003",
    name: "验证码短信",
    code: "verification_sms",
    channel: "sms" as const,
    content:
      "【OpenClaw】您的验证码是 {{code}}，{{expireMinutes}} 分钟内有效。请勿将验证码告知他人。",
    variables: ["code", "expireMinutes"],
    enabled: true,
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "tpl_004",
    name: "订阅到期提醒",
    code: "subscription_expiry",
    channel: "email" as const,
    subject: "您的订阅即将到期",
    content: `尊敬的 {{username}}，

您的 {{planName}} 订阅将于 {{expireDate}} 到期。

为避免服务中断，请及时续费。

续费链接：{{renewLink}}

感谢您的支持！
OpenClaw 团队`,
    variables: ["username", "planName", "expireDate", "renewLink"],
    enabled: true,
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "tpl_005",
    name: "支付成功通知",
    code: "payment_success",
    channel: "email" as const,
    subject: "支付成功通知",
    content: `尊敬的 {{username}}，

您的订单 {{orderId}} 已支付成功。

订单详情：
- 商品：{{productName}}
- 金额：{{amount}}
- 支付时间：{{payTime}}

感谢您的购买！
OpenClaw 团队`,
    variables: ["username", "orderId", "productName", "amount", "payTime"],
    enabled: true,
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "tpl_006",
    name: "新设备登录提醒",
    code: "new_device_login",
    channel: "push" as const,
    content:
      "您的账号在新设备上登录：{{deviceName}}，IP: {{ipAddress}}。如非本人操作，请立即修改密码。",
    variables: ["deviceName", "ipAddress"],
    enabled: true,
    updatedAt: "2024-01-15T10:30:00Z",
  },
];

/**
 * 获取配置列表
 */
const listConfigs: GatewayRequestHandler = async ({ params, respond }) => {
  console.log("[admin-config] 获取配置列表");

  try {
    const group = params.group as string | undefined;
    const search = params.search as string | undefined;
    const includeSensitive = params.includeSensitive as boolean | undefined;
    const offset = params.offset as number | undefined;
    const limit = params.limit as number | undefined;

    const result = await getAllConfigs({
      group,
      search,
      includeSensitive: includeSensitive || false,
      offset,
      limit,
    });

    respond(true, {
      success: true,
      configs: result.configs,
      total: result.total,
      offset: result.offset,
      limit: result.limit,
    });
  } catch (error) {
    console.error("[admin-config] 获取配置列表失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取配置列表失败",
    });
  }
};

/**
 * 获取单个配置
 */
const getConfig: GatewayRequestHandler = async ({ params, respond }) => {
  const key = params.key as string;
  console.log("[admin-config] 获取配置:", key);

  try {
    const config = await getConfigByKey(key, {
      includeSensitive: params.includeSensitive as boolean,
    });

    if (!config) {
      respond(true, {
        success: false,
        error: `配置不存在: ${key}`,
      });
      return;
    }

    respond(true, {
      success: true,
      config,
    });
  } catch (error) {
    console.error("[admin-config] 获取配置失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取配置失败",
    });
  }
};

/**
 * 设置配置值
 */
const setConfig: GatewayRequestHandler = async ({ params, context, respond }) => {
  const key = params.key as string;
  const value = params.value;
  const reason = params.reason as string | undefined;

  console.log("[admin-config] 设置配置:", key);

  try {
    // TODO: 从 context 获取 adminId
    const adminId = "system";
    const adminName = "系统管理员";

    const config = await setConfigValue(key, value, {
      adminId,
      adminName,
      enableHistory: true,
    });

    respond(true, {
      success: true,
      config,
      message: "配置已更新",
    });
  } catch (error) {
    console.error("[admin-config] 设置配置失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "设置配置失败",
    });
  }
};

/**
 * 创建配置
 */
const createConfigHandler: GatewayRequestHandler = async ({ params, context, respond }) => {
  console.log("[admin-config] 创建配置:", params.key);

  try {
    // TODO: 从 context 获取 adminId
    const adminId = "system";
    const adminName = "系统管理员";

    const config = await createConfig(
      {
        key: params.key as string,
        value: params.value,
        valueType: params.valueType as "string" | "number" | "boolean" | "json" | "array",
        group: params.group as string,
        description: params.description as string,
        isSensitive: params.isSensitive as boolean,
        isReadonly: params.isReadonly as boolean,
        requiresRestart: params.requiresRestart as boolean,
        defaultValue: params.defaultValue,
        validationRules: params.validationRules as Record<string, unknown>,
      },
      {
        adminId,
        adminName,
        enableHistory: true,
      },
    );

    respond(true, {
      success: true,
      config,
      message: "配置已创建",
    });
  } catch (error) {
    console.error("[admin-config] 创建配置失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "创建配置失败",
    });
  }
};

/**
 * 删除配置
 */
const deleteConfigHandler: GatewayRequestHandler = async ({ params, context, respond }) => {
  const key = params.key as string;
  console.log("[admin-config] 删除配置:", key);

  try {
    // TODO: 从 context 获取 adminId
    const adminId = "system";
    const adminName = "系统管理员";

    await deleteConfig(key, {
      adminId,
      adminName,
      enableHistory: true,
    });

    respond(true, {
      success: true,
      message: "配置已删除",
    });
  } catch (error) {
    console.error("[admin-config] 删除配置失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "删除配置失败",
    });
  }
};

/**
 * 获取配置分组
 */
const listConfigGroups: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-config] 获取配置分组");

  try {
    const groups = await getConfigGroups();

    respond(true, {
      success: true,
      groups,
    });
  } catch (error) {
    console.error("[admin-config] 获取配置分组失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取配置分组失败",
    });
  }
};

/**
 * 获取配置变更历史
 */
const listConfigHistory: GatewayRequestHandler = async ({ params, respond }) => {
  console.log("[admin-config] 获取配置变更历史");

  try {
    const result = await getConfigHistory({
      configKey: params.configKey as string | undefined,
      adminId: params.adminId as string | undefined,
      startDate: params.startDate ? new Date(params.startDate as string) : undefined,
      endDate: params.endDate ? new Date(params.endDate as string) : undefined,
      offset: params.offset as number | undefined,
      limit: params.limit as number | undefined,
    });

    respond(true, {
      success: true,
      history: result.history,
      total: result.total,
    });
  } catch (error) {
    console.error("[admin-config] 获取变更历史失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取变更历史失败",
    });
  }
};

/**
 * 重置配置为默认值
 */
const resetConfig: GatewayRequestHandler = async ({ params, context, respond }) => {
  const key = params.key as string;
  console.log("[admin-config] 重置配置为默认值:", key);

  try {
    // TODO: 从 context 获取 adminId
    const adminId = "system";
    const adminName = "系统管理员";

    const config = await resetConfigToDefault(key, {
      adminId,
      adminName,
      enableHistory: true,
    });

    if (!config) {
      respond(true, {
        success: false,
        error: "配置没有默认值",
      });
      return;
    }

    respond(true, {
      success: true,
      config,
      message: "配置已重置为默认值",
    });
  } catch (error) {
    console.error("[admin-config] 重置配置失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "重置配置失败",
    });
  }
};

/**
 * 初始化默认配置
 */
const initializeConfigs: GatewayRequestHandler = async ({ context, respond }) => {
  console.log("[admin-config] 初始化默认配置");

  try {
    // TODO: 从 context 获取 adminId
    const adminId = "system";
    const adminName = "系统管理员";

    await initializeDefaultConfigs({
      adminId,
      adminName,
      enableHistory: true,
    });

    respond(true, {
      success: true,
      message: "默认配置已初始化",
    });
  } catch (error) {
    console.error("[admin-config] 初始化配置失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "初始化配置失败",
    });
  }
};

/**
 * 批量设置配置
 */
const batchSetConfigs: GatewayRequestHandler = async ({ params, context, respond }) => {
  const configs = params.configs as Array<{ key: string; value: unknown }>;
  console.log("[admin-config] 批量设置配置:", configs.length, "项");

  try {
    // TODO: 从 context 获取 adminId
    const adminId = "system";
    const adminName = "系统管理员";

    const results = await setConfigsBatch(configs, {
      adminId,
      adminName,
      enableHistory: true,
    });

    respond(true, {
      success: true,
      configs: results,
      message: `已更新 ${results.length} 项配置`,
    });
  } catch (error) {
    console.error("[admin-config] 批量设置配置失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "批量设置配置失败",
    });
  }
};

// ==================== 兼容旧接口 ====================

/**
 * 获取站点配置（兼容旧接口）
 */
const getSiteConfig: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-config] 获取站点配置（兼容接口）");

  try {
    // 从数据库获取站点相关配置
    const siteName = await getConfigValue<string>(CONFIG_KEYS.SITE_NAME, "OpenClaw AI Assistant");
    const siteDescription = await getConfigValue<string>(
      CONFIG_KEYS.SITE_DESCRIPTION,
      "智能 AI 助手平台",
    );

    respond(true, {
      success: true,
      config: {
        siteName,
        siteDescription,
        logoUrl: "/logo.png",
        faviconUrl: "/favicon.ico",
        contactEmail: "support@openclaw.ai",
        contactPhone: "400-123-4567",
        icpNumber: "京ICP备12345678号",
        copyright: "© 2024 OpenClaw. All rights reserved.",
      },
    });
  } catch (error) {
    console.error("[admin-config] 获取站点配置失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取站点配置失败",
    });
  }
};

/**
 * 更新站点配置（兼容旧接口）
 */
const setSiteConfig: GatewayRequestHandler = async ({ params, context, respond }) => {
  const config = params.config as Record<string, unknown>;
  console.log("[admin-config] 更新站点配置（兼容接口）:", Object.keys(config));

  try {
    // TODO: 从 context 获取 adminId
    const adminId = "system";
    const adminName = "系统管理员";

    // 更新相关配置
    if (config.siteName !== undefined) {
      await setConfigValue(CONFIG_KEYS.SITE_NAME, config.siteName, {
        adminId,
        adminName,
        enableHistory: true,
      });
    }
    if (config.siteDescription !== undefined) {
      await setConfigValue(CONFIG_KEYS.SITE_DESCRIPTION, config.siteDescription, {
        adminId,
        adminName,
        enableHistory: true,
      });
    }

    respond(true, {
      success: true,
      config,
      message: "站点配置已更新",
    });
  } catch (error) {
    console.error("[admin-config] 更新站点配置失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "更新站点配置失败",
    });
  }
};

/**
 * 获取功能开关（兼容旧接口）
 */
const getFeatureFlags: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-config] 获取功能开关（兼容接口）");

  try {
    const maintenanceMode = await getConfigValue<boolean>(CONFIG_KEYS.MAINTENANCE_MODE, false);
    const maintenanceMessage = await getConfigValue<string>(
      CONFIG_KEYS.MAINTENANCE_MESSAGE,
      "系统维护中，请稍后再试...",
    );
    const notificationEnabled = await getConfigValue<boolean>(
      CONFIG_KEYS.NOTIFICATION_ENABLED,
      true,
    );

    respond(true, {
      success: true,
      config: {
        registrationEnabled: true,
        emailVerificationRequired: true,
        phoneVerificationRequired: false,
        paymentEnabled: true,
        wechatPayEnabled: true,
        alipayEnabled: true,
        skillStoreEnabled: true,
        skillUploadEnabled: true,
        liveChatEnabled: true,
        maintenanceMode,
        maintenanceMessage,
        notificationEnabled,
      },
    });
  } catch (error) {
    console.error("[admin-config] 获取功能开关失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取功能开关失败",
    });
  }
};

/**
 * 更新功能开关（兼容旧接口）
 */
const setFeatureFlags: GatewayRequestHandler = async ({ params, context, respond }) => {
  const config = params.config as Record<string, unknown>;
  console.log("[admin-config] 更新功能开关（兼容接口）:", Object.keys(config));

  try {
    // TODO: 从 context 获取 adminId
    const adminId = "system";
    const adminName = "系统管理员";

    // 更新相关配置
    if (config.maintenanceMode !== undefined) {
      await setConfigValue(CONFIG_KEYS.MAINTENANCE_MODE, config.maintenanceMode, {
        adminId,
        adminName,
        enableHistory: true,
      });
    }
    if (config.maintenanceMessage !== undefined) {
      await setConfigValue(CONFIG_KEYS.MAINTENANCE_MESSAGE, config.maintenanceMessage, {
        adminId,
        adminName,
        enableHistory: true,
      });
    }
    if (config.notificationEnabled !== undefined) {
      await setConfigValue(CONFIG_KEYS.NOTIFICATION_ENABLED, config.notificationEnabled, {
        adminId,
        adminName,
        enableHistory: true,
      });
    }

    respond(true, {
      success: true,
      config,
      message: "功能开关已更新",
    });
  } catch (error) {
    console.error("[admin-config] 更新功能开关失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "更新功能开关失败",
    });
  }
};

/**
 * 获取安全配置（兼容旧接口）
 */
const getSecurityConfig: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-config] 获取安全配置（兼容接口）");

  try {
    const maxLoginAttempts = await getConfigValue<number>(CONFIG_KEYS.MAX_LOGIN_ATTEMPTS, 5);
    const lockoutDuration = await getConfigValue<number>(CONFIG_KEYS.LOCKOUT_DURATION, 1800);
    const sessionTimeout = await getConfigValue<number>(CONFIG_KEYS.SESSION_TIMEOUT, 7200);
    const twoFactorEnabled = await getConfigValue<boolean>(CONFIG_KEYS.TWO_FACTOR_ENABLED, false);

    respond(true, {
      success: true,
      config: {
        passwordMinLength: 8,
        passwordRequireUppercase: true,
        passwordRequireLowercase: true,
        passwordRequireNumber: true,
        passwordRequireSpecial: false,
        loginLockoutAttempts: maxLoginAttempts,
        loginLockoutDuration: Math.floor(lockoutDuration / 60), // 转换为分钟
        sessionTimeout: Math.floor(sessionTimeout / 60), // 转换为分钟
        twoFactorEnabled,
        twoFactorRequired: false,
        ipWhitelist: [],
        ipBlacklist: [],
      },
    });
  } catch (error) {
    console.error("[admin-config] 获取安全配置失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取安全配置失败",
    });
  }
};

/**
 * 更新安全配置（兼容旧接口）
 */
const setSecurityConfig: GatewayRequestHandler = async ({ params, context, respond }) => {
  const config = params.config as Record<string, unknown>;
  console.log("[admin-config] 更新安全配置（兼容接口）:", Object.keys(config));

  try {
    // TODO: 从 context 获取 adminId
    const adminId = "system";
    const adminName = "系统管理员";

    // 更新相关配置
    if (config.loginLockoutAttempts !== undefined) {
      await setConfigValue(CONFIG_KEYS.MAX_LOGIN_ATTEMPTS, config.loginLockoutAttempts, {
        adminId,
        adminName,
        enableHistory: true,
      });
    }
    if (config.loginLockoutDuration !== undefined) {
      // 从分钟转换为秒
      await setConfigValue(
        CONFIG_KEYS.LOCKOUT_DURATION,
        (config.loginLockoutDuration as number) * 60,
        {
          adminId,
          adminName,
          enableHistory: true,
        },
      );
    }
    if (config.sessionTimeout !== undefined) {
      // 从分钟转换为秒
      await setConfigValue(CONFIG_KEYS.SESSION_TIMEOUT, (config.sessionTimeout as number) * 60, {
        adminId,
        adminName,
        enableHistory: true,
      });
    }
    if (config.twoFactorEnabled !== undefined) {
      await setConfigValue(CONFIG_KEYS.TWO_FACTOR_ENABLED, config.twoFactorEnabled, {
        adminId,
        adminName,
        enableHistory: true,
      });
    }

    respond(true, {
      success: true,
      config,
      message: "安全配置已更新",
    });
  } catch (error) {
    console.error("[admin-config] 更新安全配置失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "更新安全配置失败",
    });
  }
};

/**
 * 获取所有配置（兼容旧接口）
 */
const getAllConfig: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-config] 获取所有配置（兼容接口）");

  try {
    // 获取各类配置
    const siteName = await getConfigValue<string>(CONFIG_KEYS.SITE_NAME, "OpenClaw AI Assistant");
    const siteDescription = await getConfigValue<string>(
      CONFIG_KEYS.SITE_DESCRIPTION,
      "智能 AI 助手平台",
    );
    const maintenanceMode = await getConfigValue<boolean>(CONFIG_KEYS.MAINTENANCE_MODE, false);
    const maintenanceMessage = await getConfigValue<string>(
      CONFIG_KEYS.MAINTENANCE_MESSAGE,
      "系统维护中，请稍后再试...",
    );
    const maxLoginAttempts = await getConfigValue<number>(CONFIG_KEYS.MAX_LOGIN_ATTEMPTS, 5);
    const lockoutDuration = await getConfigValue<number>(CONFIG_KEYS.LOCKOUT_DURATION, 1800);
    const sessionTimeout = await getConfigValue<number>(CONFIG_KEYS.SESSION_TIMEOUT, 7200);
    const twoFactorEnabled = await getConfigValue<boolean>(CONFIG_KEYS.TWO_FACTOR_ENABLED, false);

    respond(true, {
      success: true,
      config: {
        site: {
          siteName,
          siteDescription,
          logoUrl: "/logo.png",
          faviconUrl: "/favicon.ico",
          contactEmail: "support@openclaw.ai",
          contactPhone: "400-123-4567",
          icpNumber: "京ICP备12345678号",
          copyright: "© 2024 OpenClaw. All rights reserved.",
        },
        features: {
          registrationEnabled: true,
          emailVerificationRequired: true,
          phoneVerificationRequired: false,
          paymentEnabled: true,
          wechatPayEnabled: true,
          alipayEnabled: true,
          skillStoreEnabled: true,
          skillUploadEnabled: true,
          liveChatEnabled: true,
          maintenanceMode,
          maintenanceMessage,
        },
        security: {
          passwordMinLength: 8,
          passwordRequireUppercase: true,
          passwordRequireLowercase: true,
          passwordRequireNumber: true,
          passwordRequireSpecial: false,
          loginLockoutAttempts: maxLoginAttempts,
          loginLockoutDuration: Math.floor(lockoutDuration / 60),
          sessionTimeout: Math.floor(sessionTimeout / 60),
          twoFactorEnabled,
          twoFactorRequired: false,
          ipWhitelist: [],
          ipBlacklist: [],
        },
      },
    });
  } catch (error) {
    console.error("[admin-config] 获取所有配置失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取所有配置失败",
    });
  }
};

// ==================== 通知模板（暂保持 mock） ====================

/**
 * 获取通知模板列表
 */
const listNotificationTemplates: GatewayRequestHandler = async ({ params, respond }) => {
  const channel = params.channel as string | undefined;
  console.log("[admin-config] 获取通知模板列表, channel:", channel);

  let templates = mockNotificationTemplates;
  if (channel && channel !== "all") {
    templates = templates.filter((t) => t.channel === channel);
  }

  respond(true, {
    success: true,
    templates,
    total: templates.length,
  });
};

/**
 * 获取单个通知模板
 */
const getNotificationTemplate: GatewayRequestHandler = async ({ params, respond }) => {
  const templateId = params.templateId as string;
  console.log("[admin-config] 获取通知模板:", templateId);

  const template = mockNotificationTemplates.find((t) => t.id === templateId);
  if (!template) {
    respond(true, {
      success: false,
      error: "模板不存在",
    });
    return;
  }

  respond(true, {
    success: true,
    template,
  });
};

/**
 * 更新通知模板
 */
const updateNotificationTemplate: GatewayRequestHandler = async ({ params, respond }) => {
  const templateId = params.templateId as string;
  const subject = params.subject as string | undefined;
  const content = params.content as string;
  const enabled = params.enabled as boolean | undefined;

  console.log("[admin-config] 更新通知模板:", templateId);

  const templateIndex = mockNotificationTemplates.findIndex((t) => t.id === templateId);
  if (templateIndex === -1) {
    respond(true, {
      success: false,
      error: "模板不存在",
    });
    return;
  }

  // 模拟更新
  const template = mockNotificationTemplates[templateIndex];
  if (subject !== undefined) template.subject = subject;
  if (content !== undefined) template.content = content;
  if (enabled !== undefined) template.enabled = enabled;
  template.updatedAt = new Date().toISOString();

  respond(true, {
    success: true,
    template,
    message: "模板已更新",
  });
};

/**
 * 测试通知模板
 */
const testNotificationTemplate: GatewayRequestHandler = async ({ params, respond }) => {
  const templateId = params.templateId as string;
  const testData = params.testData as Record<string, string>;
  console.log("[admin-config] 测试通知模板:", templateId, testData);

  const template = mockNotificationTemplates.find((t) => t.id === templateId);
  if (!template) {
    respond(true, {
      success: false,
      error: "模板不存在",
    });
    return;
  }

  // 模拟渲染模板
  let renderedContent = template.content;
  for (const [key, value] of Object.entries(testData)) {
    renderedContent = renderedContent.replace(new RegExp(`{{${key}}}`, "g"), value);
  }

  respond(true, {
    success: true,
    preview: {
      subject: template.subject,
      content: renderedContent,
      channel: template.channel,
    },
    message: "模板测试成功",
  });
};

/**
 * 导出配置处理器
 */
export const adminConfigHandlers: GatewayRequestHandlers = {
  // 新接口 - 通用配置管理
  "admin.config.list": listConfigs,
  "admin.config.get": getConfig,
  "admin.config.set": setConfig,
  "admin.config.create": createConfigHandler,
  "admin.config.delete": deleteConfigHandler,
  "admin.config.groups": listConfigGroups,
  "admin.config.history": listConfigHistory,
  "admin.config.reset": resetConfig,
  "admin.config.initialize": initializeConfigs,
  "admin.config.batch": batchSetConfigs,

  // 兼容旧接口 - 站点配置
  "admin.config.site.get": getSiteConfig,
  "admin.config.site.set": setSiteConfig,
  // 兼容旧接口 - 功能开关
  "admin.config.features.get": getFeatureFlags,
  "admin.config.features.set": setFeatureFlags,
  // 兼容旧接口 - 安全配置
  "admin.config.security.get": getSecurityConfig,
  "admin.config.security.set": setSecurityConfig,
  // 兼容旧接口 - 获取所有配置
  "admin.config.all": getAllConfig,

  // 通知模板
  "admin.config.notifications.list": listNotificationTemplates,
  "admin.config.notifications.get": getNotificationTemplate,
  "admin.config.notifications.update": updateNotificationTemplate,
  "admin.config.notifications.test": testNotificationTemplate,
};
