import type { MtBotConfig } from "../../config/config.js";
import { normalizeAccountId } from "../../routing/session-key.js";

const MB = 1024 * 1024;

export function resolveChannelMediaMaxBytes(params: {
  cfg: MtBotConfig;
  // Channel-specific config lives under different keys; keep this helper generic
  // so shared plugin helpers don't need channel-id branching.
  resolveChannelLimitMb: (params: { cfg: MtBotConfig; accountId: string }) => number | undefined;
  accountId?: string | null;
}): number | undefined {
  const accountId = normalizeAccountId(params.accountId);
  const channelLimit = params.resolveChannelLimitMb({
    cfg: params.cfg,
    accountId,
  });
  if (channelLimit) {
    return channelLimit * MB;
  }
  if (params.cfg.agents?.defaults?.mediaMaxMb) {
    return params.cfg.agents.defaults.mediaMaxMb * MB;
  }
  return undefined;
}
