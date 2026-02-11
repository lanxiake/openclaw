import type { BrowserBridge } from "../../services/browser/bridge-server.js";

export const BROWSER_BRIDGES = new Map<string, { bridge: BrowserBridge; containerName: string }>();
