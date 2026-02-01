/**
 * WeChat channel logger.
 * Provides consistent logging with channel prefix.
 */

export interface WeChatLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  debug: (msg: string) => void;
}

/**
 * Create a logger for a specific account.
 */
export function createWeChatLogger(accountId: string): WeChatLogger {
  const prefix = `[wechat:${accountId}]`;
  return {
    info: (msg: string) => console.info(`${prefix} ${msg}`),
    warn: (msg: string) => console.warn(`${prefix} ${msg}`),
    error: (msg: string) => console.error(`${prefix} ${msg}`),
    debug: (msg: string) => console.debug(`${prefix} ${msg}`),
  };
}

/**
 * Default logger for module-level logging.
 */
export const defaultLogger: WeChatLogger = {
  info: (msg: string) => console.info(`[wechat] ${msg}`),
  warn: (msg: string) => console.warn(`[wechat] ${msg}`),
  error: (msg: string) => console.error(`[wechat] ${msg}`),
  debug: (msg: string) => console.debug(`[wechat] ${msg}`),
};
