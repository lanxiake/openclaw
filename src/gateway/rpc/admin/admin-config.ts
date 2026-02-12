/**
 * 绠＄悊鍚庡彴绯荤粺閰嶇疆 RPC 鏂规硶
 *
 * 鎻愪緵绯荤粺閰嶇疆绠＄悊鐩稿叧鐨?API锛? * - admin.config.list - 鑾峰彇閰嶇疆鍒楄〃
 * - admin.config.get - 鑾峰彇鍗曚釜閰嶇疆
 * - admin.config.set - 璁剧疆閰嶇疆鍊? * - admin.config.create - 鍒涘缓閰嶇疆
 * - admin.config.delete - 鍒犻櫎閰嶇疆
 * - admin.config.groups - 鑾峰彇閰嶇疆鍒嗙粍
 * - admin.config.history - 鑾峰彇鍙樻洿鍘嗗彶
 * - admin.config.reset - 閲嶇疆涓洪粯璁ゅ€? * - admin.config.initialize - 鍒濆鍖栭粯璁ら厤缃? * - admin.config.batch - 鎵归噺璁剧疆閰嶇疆
 * - admin.config.notifications.list/get/update/test - 閫氱煡妯℃澘绠＄悊
 *
 * 浣跨敤鐪熷疄鏁版嵁搴撳瓨鍌ㄩ厤缃? */

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
 * 妯℃嫙閫氱煡妯℃澘鏁版嵁锛堥€氱煡妯℃澘鏆傛椂淇濇寔 mock锛屽悗缁彲杩佺Щ鍒版暟鎹簱锛? */
const mockNotificationTemplates = [
  {
    id: "tpl_001",
    name: "娆㈣繋閭欢",
    code: "welcome_email",
    channel: "email" as const,
    subject: "娆㈣繋鍔犲叆 OpenClaw",
    content: `灏婃暚鐨?{{username}}锛?
娆㈣繋鍔犲叆 OpenClaw锛佹偍鐨勮处鍙峰凡鎴愬姛鍒涘缓銆?
鎮ㄥ彲浠ヤ娇鐢ㄤ互涓嬫柟寮忕櫥褰曪細
- 閭锛歿{email}}
- 鎵嬫満锛歿{phone}}

濡傛湁浠讳綍闂锛岃鑱旂郴鎴戜滑鐨勫鏈嶅洟闃熴€?
绁濇偍浣跨敤鎰夊揩锛?OpenClaw 鍥㈤槦`,
    variables: ["username", "email", "phone"],
    enabled: true,
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "tpl_002",
    name: "瀵嗙爜閲嶇疆",
    code: "password_reset",
    channel: "email" as const,
    subject: "瀵嗙爜閲嶇疆璇锋眰",
    content: `灏婃暚鐨?{{username}}锛?
鎮ㄦ鍦ㄩ噸缃瘑鐮併€傝鐐瑰嚮浠ヤ笅閾炬帴瀹屾垚閲嶇疆锛?
{{resetLink}}

姝ら摼鎺ュ皢鍦?{{expireTime}} 鍚庡け鏁堛€?
濡傛灉杩欎笉鏄偍鐨勬搷浣滐紝璇峰拷鐣ユ閭欢銆?
OpenClaw 鍥㈤槦`,
    variables: ["username", "resetLink", "expireTime"],
    enabled: true,
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "tpl_003",
    name: "楠岃瘉鐮佺煭淇?,
    code: "verification_sms",
    channel: "sms" as const,
    content:
      "銆怬penClaw銆戞偍鐨勯獙璇佺爜鏄?{{code}}锛寋{expireMinutes}} 鍒嗛挓鍐呮湁鏁堛€傝鍕垮皢楠岃瘉鐮佸憡鐭ヤ粬浜恒€?,
    variables: ["code", "expireMinutes"],
    enabled: true,
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "tpl_004",
    name: "璁㈤槄鍒版湡鎻愰啋",
    code: "subscription_expiry",
    channel: "email" as const,
    subject: "鎮ㄧ殑璁㈤槄鍗冲皢鍒版湡",
    content: `灏婃暚鐨?{{username}}锛?
鎮ㄧ殑 {{planName}} 璁㈤槄灏嗕簬 {{expireDate}} 鍒版湡銆?
涓洪伩鍏嶆湇鍔′腑鏂紝璇峰強鏃剁画璐广€?
缁垂閾炬帴锛歿{renewLink}}

鎰熻阿鎮ㄧ殑鏀寔锛?OpenClaw 鍥㈤槦`,
    variables: ["username", "planName", "expireDate", "renewLink"],
    enabled: true,
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "tpl_005",
    name: "鏀粯鎴愬姛閫氱煡",
    code: "payment_success",
    channel: "email" as const,
    subject: "鏀粯鎴愬姛閫氱煡",
    content: `灏婃暚鐨?{{username}}锛?
鎮ㄧ殑璁㈠崟 {{orderId}} 宸叉敮浠樻垚鍔熴€?
璁㈠崟璇︽儏锛?- 鍟嗗搧锛歿{productName}}
- 閲戦锛歿{amount}}
- 鏀粯鏃堕棿锛歿{payTime}}

鎰熻阿鎮ㄧ殑璐拱锛?OpenClaw 鍥㈤槦`,
    variables: ["username", "orderId", "productName", "amount", "payTime"],
    enabled: true,
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "tpl_006",
    name: "鏂拌澶囩櫥褰曟彁閱?,
    code: "new_device_login",
    channel: "push" as const,
    content:
      "鎮ㄧ殑璐﹀彿鍦ㄦ柊璁惧涓婄櫥褰曪細{{deviceName}}锛孖P: {{ipAddress}}銆傚闈炴湰浜烘搷浣滐紝璇风珛鍗充慨鏀瑰瘑鐮併€?,
    variables: ["deviceName", "ipAddress"],
    enabled: true,
    updatedAt: "2024-01-15T10:30:00Z",
  },
];

/**
 * 鑾峰彇閰嶇疆鍒楄〃
 */
const listConfigs: GatewayRequestHandler = async ({ params, respond }) => {
  console.log("[admin-config] 鑾峰彇閰嶇疆鍒楄〃");

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
    console.error("[admin-config] 鑾峰彇閰嶇疆鍒楄〃澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇閰嶇疆鍒楄〃澶辫触",
    });
  }
};

/**
 * 鑾峰彇鍗曚釜閰嶇疆
 */
const getConfig: GatewayRequestHandler = async ({ params, respond }) => {
  const key = params.key as string;
  console.log("[admin-config] 鑾峰彇閰嶇疆:", key);

  try {
    const config = await getConfigByKey(key, {
      includeSensitive: params.includeSensitive as boolean,
    });

    if (!config) {
      respond(true, {
        success: false,
        error: `閰嶇疆涓嶅瓨鍦? ${key}`,
      });
      return;
    }

    respond(true, {
      success: true,
      config,
    });
  } catch (error) {
    console.error("[admin-config] 鑾峰彇閰嶇疆澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇閰嶇疆澶辫触",
    });
  }
};

/**
 * 璁剧疆閰嶇疆鍊? */
const setConfig: GatewayRequestHandler = async ({ params, context, respond }) => {
  const key = params.key as string;
  const value = params.value;
  const reason = params.reason as string | undefined;

  console.log("[admin-config] 璁剧疆閰嶇疆:", key);

  try {
    // TODO: 浠?context 鑾峰彇 adminId
    const adminId = "system";
    const adminName = "绯荤粺绠＄悊鍛?;

    const config = await setConfigValue(key, value, {
      adminId,
      adminName,
      enableHistory: true,
    });

    respond(true, {
      success: true,
      config,
      message: "閰嶇疆宸叉洿鏂?,
    });
  } catch (error) {
    console.error("[admin-config] 璁剧疆閰嶇疆澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "璁剧疆閰嶇疆澶辫触",
    });
  }
};

/**
 * 鍒涘缓閰嶇疆
 */
const createConfigHandler: GatewayRequestHandler = async ({ params, context, respond }) => {
  console.log("[admin-config] 鍒涘缓閰嶇疆:", params.key);

  try {
    // TODO: 浠?context 鑾峰彇 adminId
    const adminId = "system";
    const adminName = "绯荤粺绠＄悊鍛?;

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
      message: "閰嶇疆宸插垱寤?,
    });
  } catch (error) {
    console.error("[admin-config] 鍒涘缓閰嶇疆澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鍒涘缓閰嶇疆澶辫触",
    });
  }
};

/**
 * 鍒犻櫎閰嶇疆
 */
const deleteConfigHandler: GatewayRequestHandler = async ({ params, context, respond }) => {
  const key = params.key as string;
  console.log("[admin-config] 鍒犻櫎閰嶇疆:", key);

  try {
    // TODO: 浠?context 鑾峰彇 adminId
    const adminId = "system";
    const adminName = "绯荤粺绠＄悊鍛?;

    await deleteConfig(key, {
      adminId,
      adminName,
      enableHistory: true,
    });

    respond(true, {
      success: true,
      message: "閰嶇疆宸插垹闄?,
    });
  } catch (error) {
    console.error("[admin-config] 鍒犻櫎閰嶇疆澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鍒犻櫎閰嶇疆澶辫触",
    });
  }
};

/**
 * 鑾峰彇閰嶇疆鍒嗙粍
 */
const listConfigGroups: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-config] 鑾峰彇閰嶇疆鍒嗙粍");

  try {
    const groups = await getConfigGroups();

    respond(true, {
      success: true,
      groups,
    });
  } catch (error) {
    console.error("[admin-config] 鑾峰彇閰嶇疆鍒嗙粍澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇閰嶇疆鍒嗙粍澶辫触",
    });
  }
};

/**
 * 鑾峰彇閰嶇疆鍙樻洿鍘嗗彶
 */
const listConfigHistory: GatewayRequestHandler = async ({ params, respond }) => {
  console.log("[admin-config] 鑾峰彇閰嶇疆鍙樻洿鍘嗗彶");

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
    console.error("[admin-config] 鑾峰彇鍙樻洿鍘嗗彶澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇鍙樻洿鍘嗗彶澶辫触",
    });
  }
};

/**
 * 閲嶇疆閰嶇疆涓洪粯璁ゅ€? */
const resetConfig: GatewayRequestHandler = async ({ params, context, respond }) => {
  const key = params.key as string;
  console.log("[admin-config] 閲嶇疆閰嶇疆涓洪粯璁ゅ€?", key);

  try {
    // TODO: 浠?context 鑾峰彇 adminId
    const adminId = "system";
    const adminName = "绯荤粺绠＄悊鍛?;

    const config = await resetConfigToDefault(key, {
      adminId,
      adminName,
      enableHistory: true,
    });

    if (!config) {
      respond(true, {
        success: false,
        error: "閰嶇疆娌℃湁榛樿鍊?,
      });
      return;
    }

    respond(true, {
      success: true,
      config,
      message: "閰嶇疆宸查噸缃负榛樿鍊?,
    });
  } catch (error) {
    console.error("[admin-config] 閲嶇疆閰嶇疆澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "閲嶇疆閰嶇疆澶辫触",
    });
  }
};

/**
 * 鍒濆鍖栭粯璁ら厤缃? */
const initializeConfigs: GatewayRequestHandler = async ({ context, respond }) => {
  console.log("[admin-config] 鍒濆鍖栭粯璁ら厤缃?);

  try {
    // TODO: 浠?context 鑾峰彇 adminId
    const adminId = "system";
    const adminName = "绯荤粺绠＄悊鍛?;

    await initializeDefaultConfigs({
      adminId,
      adminName,
      enableHistory: true,
    });

    respond(true, {
      success: true,
      message: "榛樿閰嶇疆宸插垵濮嬪寲",
    });
  } catch (error) {
    console.error("[admin-config] 鍒濆鍖栭厤缃け璐?", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鍒濆鍖栭厤缃け璐?,
    });
  }
};

/**
 * 鎵归噺璁剧疆閰嶇疆
 */
const batchSetConfigs: GatewayRequestHandler = async ({ params, context, respond }) => {
  const configs = params.configs as Array<{ key: string; value: unknown }>;
  console.log("[admin-config] 鎵归噺璁剧疆閰嶇疆:", configs.length, "椤?);

  try {
    // TODO: 浠?context 鑾峰彇 adminId
    const adminId = "system";
    const adminName = "绯荤粺绠＄悊鍛?;

    const results = await setConfigsBatch(configs, {
      adminId,
      adminName,
      enableHistory: true,
    });

    respond(true, {
      success: true,
      configs: results,
      message: `宸叉洿鏂?${results.length} 椤归厤缃甡,
    });
  } catch (error) {
    console.error("[admin-config] 鎵归噺璁剧疆閰嶇疆澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鎵归噺璁剧疆閰嶇疆澶辫触",
    });
  }
};

// ==================== 鍏煎鏃ф帴鍙?====================

/**
 * 鑾峰彇绔欑偣閰嶇疆锛堝吋瀹规棫鎺ュ彛锛? */
const getSiteConfig: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-config] 鑾峰彇绔欑偣閰嶇疆锛堝吋瀹规帴鍙ｏ級");

  try {
    // 浠庢暟鎹簱鑾峰彇绔欑偣鐩稿叧閰嶇疆
    const siteName = await getConfigValue<string>(CONFIG_KEYS.SITE_NAME, "OpenClaw AI Assistant");
    const siteDescription = await getConfigValue<string>(
      CONFIG_KEYS.SITE_DESCRIPTION,
      "鏅鸿兘 AI 鍔╂墜骞冲彴",
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
        icpNumber: "浜琁CP澶?2345678鍙?,
        copyright: "漏 2024 OpenClaw. All rights reserved.",
      },
    });
  } catch (error) {
    console.error("[admin-config] 鑾峰彇绔欑偣閰嶇疆澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇绔欑偣閰嶇疆澶辫触",
    });
  }
};

/**
 * 鏇存柊绔欑偣閰嶇疆锛堝吋瀹规棫鎺ュ彛锛? */
const setSiteConfig: GatewayRequestHandler = async ({ params, context, respond }) => {
  const config = params.config as Record<string, unknown>;
  console.log("[admin-config] 鏇存柊绔欑偣閰嶇疆锛堝吋瀹规帴鍙ｏ級:", Object.keys(config));

  try {
    // TODO: 浠?context 鑾峰彇 adminId
    const adminId = "system";
    const adminName = "绯荤粺绠＄悊鍛?;

    // 鏇存柊鐩稿叧閰嶇疆
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
      message: "绔欑偣閰嶇疆宸叉洿鏂?,
    });
  } catch (error) {
    console.error("[admin-config] 鏇存柊绔欑偣閰嶇疆澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鏇存柊绔欑偣閰嶇疆澶辫触",
    });
  }
};

/**
 * 鑾峰彇鍔熻兘寮€鍏筹紙鍏煎鏃ф帴鍙ｏ級
 */
const getFeatureFlags: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-config] 鑾峰彇鍔熻兘寮€鍏筹紙鍏煎鎺ュ彛锛?);

  try {
    const maintenanceMode = await getConfigValue<boolean>(CONFIG_KEYS.MAINTENANCE_MODE, false);
    const maintenanceMessage = await getConfigValue<string>(
      CONFIG_KEYS.MAINTENANCE_MESSAGE,
      "绯荤粺缁存姢涓紝璇风◢鍚庡啀璇?..",
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
    console.error("[admin-config] 鑾峰彇鍔熻兘寮€鍏冲け璐?", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇鍔熻兘寮€鍏冲け璐?,
    });
  }
};

/**
 * 鏇存柊鍔熻兘寮€鍏筹紙鍏煎鏃ф帴鍙ｏ級
 */
const setFeatureFlags: GatewayRequestHandler = async ({ params, context, respond }) => {
  const config = params.config as Record<string, unknown>;
  console.log("[admin-config] 鏇存柊鍔熻兘寮€鍏筹紙鍏煎鎺ュ彛锛?", Object.keys(config));

  try {
    // TODO: 浠?context 鑾峰彇 adminId
    const adminId = "system";
    const adminName = "绯荤粺绠＄悊鍛?;

    // 鏇存柊鐩稿叧閰嶇疆
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
      message: "鍔熻兘寮€鍏冲凡鏇存柊",
    });
  } catch (error) {
    console.error("[admin-config] 鏇存柊鍔熻兘寮€鍏冲け璐?", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鏇存柊鍔熻兘寮€鍏冲け璐?,
    });
  }
};

/**
 * 鑾峰彇瀹夊叏閰嶇疆锛堝吋瀹规棫鎺ュ彛锛? */
const getSecurityConfig: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-config] 鑾峰彇瀹夊叏閰嶇疆锛堝吋瀹规帴鍙ｏ級");

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
        loginLockoutDuration: Math.floor(lockoutDuration / 60), // 杞崲涓哄垎閽?        sessionTimeout: Math.floor(sessionTimeout / 60), // 杞崲涓哄垎閽?        twoFactorEnabled,
        twoFactorRequired: false,
        ipWhitelist: [],
        ipBlacklist: [],
      },
    });
  } catch (error) {
    console.error("[admin-config] 鑾峰彇瀹夊叏閰嶇疆澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇瀹夊叏閰嶇疆澶辫触",
    });
  }
};

/**
 * 鏇存柊瀹夊叏閰嶇疆锛堝吋瀹规棫鎺ュ彛锛? */
const setSecurityConfig: GatewayRequestHandler = async ({ params, context, respond }) => {
  const config = params.config as Record<string, unknown>;
  console.log("[admin-config] 鏇存柊瀹夊叏閰嶇疆锛堝吋瀹规帴鍙ｏ級:", Object.keys(config));

  try {
    // TODO: 浠?context 鑾峰彇 adminId
    const adminId = "system";
    const adminName = "绯荤粺绠＄悊鍛?;

    // 鏇存柊鐩稿叧閰嶇疆
    if (config.loginLockoutAttempts !== undefined) {
      await setConfigValue(CONFIG_KEYS.MAX_LOGIN_ATTEMPTS, config.loginLockoutAttempts, {
        adminId,
        adminName,
        enableHistory: true,
      });
    }
    if (config.loginLockoutDuration !== undefined) {
      // 浠庡垎閽熻浆鎹负绉?      await setConfigValue(
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
      // 浠庡垎閽熻浆鎹负绉?      await setConfigValue(CONFIG_KEYS.SESSION_TIMEOUT, (config.sessionTimeout as number) * 60, {
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
      message: "瀹夊叏閰嶇疆宸叉洿鏂?,
    });
  } catch (error) {
    console.error("[admin-config] 鏇存柊瀹夊叏閰嶇疆澶辫触:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鏇存柊瀹夊叏閰嶇疆澶辫触",
    });
  }
};

/**
 * 鑾峰彇鎵€鏈夐厤缃紙鍏煎鏃ф帴鍙ｏ級
 */
const getAllConfig: GatewayRequestHandler = async ({ respond }) => {
  console.log("[admin-config] 鑾峰彇鎵€鏈夐厤缃紙鍏煎鎺ュ彛锛?);

  try {
    // 鑾峰彇鍚勭被閰嶇疆
    const siteName = await getConfigValue<string>(CONFIG_KEYS.SITE_NAME, "OpenClaw AI Assistant");
    const siteDescription = await getConfigValue<string>(
      CONFIG_KEYS.SITE_DESCRIPTION,
      "鏅鸿兘 AI 鍔╂墜骞冲彴",
    );
    const maintenanceMode = await getConfigValue<boolean>(CONFIG_KEYS.MAINTENANCE_MODE, false);
    const maintenanceMessage = await getConfigValue<string>(
      CONFIG_KEYS.MAINTENANCE_MESSAGE,
      "绯荤粺缁存姢涓紝璇风◢鍚庡啀璇?..",
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
          icpNumber: "浜琁CP澶?2345678鍙?,
          copyright: "漏 2024 OpenClaw. All rights reserved.",
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
    console.error("[admin-config] 鑾峰彇鎵€鏈夐厤缃け璐?", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "鑾峰彇鎵€鏈夐厤缃け璐?,
    });
  }
};

// ==================== 閫氱煡妯℃澘锛堟殏淇濇寔 mock锛?====================

/**
 * 鑾峰彇閫氱煡妯℃澘鍒楄〃
 */
const listNotificationTemplates: GatewayRequestHandler = async ({ params, respond }) => {
  const channel = params.channel as string | undefined;
  console.log("[admin-config] 鑾峰彇閫氱煡妯℃澘鍒楄〃, channel:", channel);

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
 * 鑾峰彇鍗曚釜閫氱煡妯℃澘
 */
const getNotificationTemplate: GatewayRequestHandler = async ({ params, respond }) => {
  const templateId = params.templateId as string;
  console.log("[admin-config] 鑾峰彇閫氱煡妯℃澘:", templateId);

  const template = mockNotificationTemplates.find((t) => t.id === templateId);
  if (!template) {
    respond(true, {
      success: false,
      error: "妯℃澘涓嶅瓨鍦?,
    });
    return;
  }

  respond(true, {
    success: true,
    template,
  });
};

/**
 * 鏇存柊閫氱煡妯℃澘
 */
const updateNotificationTemplate: GatewayRequestHandler = async ({ params, respond }) => {
  const templateId = params.templateId as string;
  const subject = params.subject as string | undefined;
  const content = params.content as string;
  const enabled = params.enabled as boolean | undefined;

  console.log("[admin-config] 鏇存柊閫氱煡妯℃澘:", templateId);

  const templateIndex = mockNotificationTemplates.findIndex((t) => t.id === templateId);
  if (templateIndex === -1) {
    respond(true, {
      success: false,
      error: "妯℃澘涓嶅瓨鍦?,
    });
    return;
  }

  // 妯℃嫙鏇存柊
  const template = mockNotificationTemplates[templateIndex];
  if (subject !== undefined) template.subject = subject;
  if (content !== undefined) template.content = content;
  if (enabled !== undefined) template.enabled = enabled;
  template.updatedAt = new Date().toISOString();

  respond(true, {
    success: true,
    template,
    message: "妯℃澘宸叉洿鏂?,
  });
};

/**
 * 娴嬭瘯閫氱煡妯℃澘
 */
const testNotificationTemplate: GatewayRequestHandler = async ({ params, respond }) => {
  const templateId = params.templateId as string;
  const testData = params.testData as Record<string, string>;
  console.log("[admin-config] 娴嬭瘯閫氱煡妯℃澘:", templateId, testData);

  const template = mockNotificationTemplates.find((t) => t.id === templateId);
  if (!template) {
    respond(true, {
      success: false,
      error: "妯℃澘涓嶅瓨鍦?,
    });
    return;
  }

  // 妯℃嫙娓叉煋妯℃澘
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
    message: "妯℃澘娴嬭瘯鎴愬姛",
  });
};

/**
 * 瀵煎嚭閰嶇疆澶勭悊鍣? */
export const adminConfigHandlers: GatewayRequestHandlers = {
  // 鏂版帴鍙?- 閫氱敤閰嶇疆绠＄悊
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

  // 鍏煎鏃ф帴鍙?- 绔欑偣閰嶇疆
  "admin.config.site.get": getSiteConfig,
  "admin.config.site.set": setSiteConfig,
  // 鍏煎鏃ф帴鍙?- 鍔熻兘寮€鍏?  "admin.config.features.get": getFeatureFlags,
  "admin.config.features.set": setFeatureFlags,
  // 鍏煎鏃ф帴鍙?- 瀹夊叏閰嶇疆
  "admin.config.security.get": getSecurityConfig,
  "admin.config.security.set": setSecurityConfig,
  // 鍏煎鏃ф帴鍙?- 鑾峰彇鎵€鏈夐厤缃?  "admin.config.all": getAllConfig,

  // 閫氱煡妯℃澘
  "admin.config.notifications.list": listNotificationTemplates,
  "admin.config.notifications.get": getNotificationTemplate,
  "admin.config.notifications.update": updateNotificationTemplate,
  "admin.config.notifications.test": testNotificationTemplate,
};
