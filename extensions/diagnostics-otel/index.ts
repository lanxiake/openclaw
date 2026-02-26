import type { MtBotPluginApi } from "mtbot/plugin-sdk";
import { emptyPluginConfigSchema } from "mtbot/plugin-sdk";

import { createDiagnosticsOtelService } from "./src/service.js";

const plugin = {
  id: "diagnostics-otel",
  name: "Diagnostics OpenTelemetry",
  description: "Export diagnostics events to OpenTelemetry",
  configSchema: emptyPluginConfigSchema(),
  register(api: MtBotPluginApi) {
    api.registerService(createDiagnosticsOtelService());
  },
};

export default plugin;
