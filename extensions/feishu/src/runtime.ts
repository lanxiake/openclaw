/**
 * Feishu runtime context management
 */

import type { PluginRuntime } from "openclaw/plugin-sdk";

let feishuRuntime: PluginRuntime | null = null;

export function setFeishuRuntime(runtime: PluginRuntime): void {
  feishuRuntime = runtime;
}

export function getFeishuRuntime(): PluginRuntime {
  if (!feishuRuntime) {
    throw new Error("Feishu runtime not initialized");
  }
  return feishuRuntime;
}
