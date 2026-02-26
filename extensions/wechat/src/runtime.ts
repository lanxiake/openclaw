import type { PluginRuntime } from "mtbot/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setWeChatRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getWeChatRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("WeChat runtime not initialized");
  }
  return runtime;
}
