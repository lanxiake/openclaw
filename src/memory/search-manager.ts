import type { MtBotConfig } from "../config/config.js";
import type { MemoryIndexManager } from "./manager.js";

export type MemorySearchManagerResult = {
  manager: MemoryIndexManager | null;
  error?: string;
};

/**
 * 获取旧版记忆搜索管理器
 *
 * @deprecated 使用 GatewayMemoryService.manager.knowledge 代替。
 * 旧版 MemoryIndexManager 将在后续版本中移除。
 */
export async function getMemorySearchManager(params: {
  cfg: MtBotConfig;
  agentId: string;
}): Promise<MemorySearchManagerResult> {
  try {
    const { MemoryIndexManager } = await import("./manager.js");
    const manager = await MemoryIndexManager.get(params);
    return { manager };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { manager: null, error: message };
  }
}
