import type { MtBotPluginApi } from "../../src/plugins/types.js";

import { createLlmTaskTool } from "./src/llm-task-tool.js";

export default function register(api: MtBotPluginApi) {
  api.registerTool(createLlmTaskTool(api), { optional: true });
}
