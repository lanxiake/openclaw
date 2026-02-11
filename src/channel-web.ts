// Barrel exports for the web channel pieces. Splitting the original 900+ line
// module keeps responsibilities small and testable.
export {
  DEFAULT_WEB_MEDIA_BYTES,
  HEARTBEAT_PROMPT,
  HEARTBEAT_TOKEN,
  monitorWebChannel,
  resolveHeartbeatRecipients,
  runWebHeartbeatOnce,
  type WebChannelStatus,
  type WebMonitorTuning,
} from "./channels/whatsapp/auto-reply.js";
export {
  extractMediaPlaceholder,
  extractText,
  monitorWebInbox,
  type WebInboundMessage,
  type WebListenerCloseReason,
} from "./channels/whatsapp/inbound.js";
export { loginWeb } from "./channels/whatsapp/login.js";
export { loadWebMedia, optimizeImageToJpeg } from "./channels/whatsapp/media.js";
export { sendMessageWhatsApp } from "./channels/whatsapp/outbound.js";
export {
  createWaSocket,
  formatError,
  getStatusCode,
  logoutWeb,
  logWebSelfId,
  pickWebChannel,
  WA_WEB_AUTH_DIR,
  waitForWaConnection,
  webAuthExists,
} from "./channels/whatsapp/session.js";
