/**
 * version-checker - 技能版本比较和更新检测
 *
 * 提供语义版本比较、单个技能更新判断、批量更新检查功能
 * 用于 Gateway 侧判断用户已安装技能是否有新版本可用
 */

/** 日志 */
const log = {
  info: (...args: unknown[]) => console.log("[version-checker]", ...args),
  debug: (...args: unknown[]) => console.log("[version-checker:debug]", ...args),
};

/**
 * 将版本字符串解析为数字数组
 *
 * 支持格式：1.0.0、1.0、1、v1.2.3
 *
 * @param version - 版本字符串
 * @returns [major, minor, patch] 数组
 */
function parseVersion(version: string): number[] {
  const cleaned = version.replace(/^v/i, "").trim();
  if (!cleaned) return [0, 0, 0];

  const parts = cleaned.split(".").map((p) => {
    const n = parseInt(p, 10);
    return isNaN(n) ? 0 : n;
  });

  // 补齐到 3 位
  while (parts.length < 3) {
    parts.push(0);
  }

  return parts.slice(0, 3);
}

/**
 * 比较两个语义版本
 *
 * @param a - 版本 A
 * @param b - 版本 B
 * @returns 正数表示 a > b，负数表示 a < b，0 表示相等
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);

  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) {
      return pa[i] - pb[i];
    }
  }

  return 0;
}

/**
 * 检查是否有更新可用
 *
 * @param installed - 已安装版本
 * @param latest - 最新可用版本
 * @returns true 表示 latest 大于 installed
 */
export function isUpdateAvailable(installed: string, latest: string): boolean {
  return compareVersions(latest, installed) > 0;
}

/**
 * 版本更新检查结果
 */
export interface UpdateCheckResult {
  /** 技能 ID */
  skillId: string;
  /** 已安装版本 */
  installedVersion: string;
  /** 最新可用版本 */
  latestVersion: string;
  /** 是否有更新 */
  hasUpdate: boolean;
}

/**
 * 批量检查多个技能的版本更新
 *
 * 仅返回在 registry 中找到的技能的检查结果，
 * 跳过不在 registry 中的技能
 *
 * @param installed - 已安装技能列表
 * @param registry - 技能注册表（包含最新版本信息）
 * @returns 更新检查结果数组
 */
export function checkUpdates(
  installed: Array<{ skillId: string; version: string }>,
  registry: Map<string, { latestVersion: string }>,
): UpdateCheckResult[] {
  const results: UpdateCheckResult[] = [];

  for (const item of installed) {
    const registryEntry = registry.get(item.skillId);
    if (!registryEntry) {
      log.debug("技能不在注册表中，跳过", { skillId: item.skillId });
      continue;
    }

    const hasUpdate = isUpdateAvailable(item.version, registryEntry.latestVersion);
    results.push({
      skillId: item.skillId,
      installedVersion: item.version,
      latestVersion: registryEntry.latestVersion,
      hasUpdate,
    });
  }

  log.info("批量版本检查完成", {
    checked: results.length,
    updatesAvailable: results.filter((r) => r.hasUpdate).length,
  });

  return results;
}
