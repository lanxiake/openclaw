import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema, registerWsUpgradeHandler } from "openclaw/plugin-sdk";

import { wechatPlugin, handleWeChatUpgrade } from "./src/channel.js";
import { setWeChatRuntime } from "./src/runtime.js";

const plugin = {
  id: "wechat",
  name: "WeChat",
  description: "WeChat channel plugin via wxauto-bridge",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setWeChatRuntime(api.runtime);
    api.registerChannel({ plugin: wechatPlugin });

    // Register WebSocket upgrade handler for bridge connections
    try {
      registerWsUpgradeHandler({
        path: "/channels/wechat",
        handler: handleWeChatUpgrade,
      });
      api.logger.info("WeChat WebSocket upgrade handler registered at /channels/wechat");
    } catch (err) {
      api.logger.debug(`WeChat WebSocket handler registration skipped: ${String(err)}`);
    }
  },
};

export default plugin;
