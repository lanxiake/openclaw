/**
 * WeChat Gateway - Unified interface for bridge communication.
 *
 * Supports two modes:
 * 1. Server mode (default): Gateway acts as WebSocket server, bridge connects to it
 * 2. Client mode (legacy): Gateway connects to bridge as WebSocket client
 */

import type { WeChatMessage } from "./types.js";
import {
  WeChatBridgeServer,
  createBridgeServer,
  getBridgeServer,
  removeBridgeServer,
  getAllBridgeServers,
  type WeChatBridgeServerOptions,
} from "./bridge-server.js";
import { createWeChatLogger, type WeChatLogger } from "./logger.js";

export type GatewayMessageHandler = (message: WeChatMessage) => void;
export type GatewayStatusHandler = (status: {
  connected: boolean;
  wxid?: string;
  nickname?: string;
  error?: string;
}) => void;

export interface WeChatGatewayOptions {
  accountId: string;
  authToken: string;
  onMessage: GatewayMessageHandler;
  onStatus?: GatewayStatusHandler;
  listenChats?: string[];
}

/**
 * WeChat Gateway wraps the bridge server for a unified interface.
 */
export class WeChatGateway {
  private server: WeChatBridgeServer;
  private options: WeChatGatewayOptions;
  private log: WeChatLogger;

  constructor(options: WeChatGatewayOptions) {
    this.options = options;
    this.log = createWeChatLogger(options.accountId);
    this.server = createBridgeServer({
      accountId: options.accountId,
      authToken: options.authToken,
      onMessage: options.onMessage,
      onStatus: options.onStatus,
      listenChats: options.listenChats,
    });
  }

  /**
   * Start the gateway (no-op for server mode, bridge initiates connection).
   */
  async connect(): Promise<void> {
    // In server mode, we don't actively connect.
    // The bridge will connect to us.
    this.log.info("Gateway ready, waiting for bridge connection");
  }

  /**
   * Stop the gateway.
   */
  disconnect(): void {
    this.server.close();
    removeBridgeServer(this.options.accountId);
  }

  /**
   * Send a text message.
   * @param to - Target chat name
   * @param text - Message text
   * @param at - Optional user(s) to @ in group chat
   */
  async sendText(to: string, text: string, at?: string | string[]): Promise<boolean> {
    return this.server.sendText(to, text, at);
  }

  /**
   * Send a file.
   */
  async sendFile(to: string, filePath: string): Promise<boolean> {
    return this.server.sendFile(to, filePath);
  }

  /**
   * Add a chat to listen list.
   */
  async addListen(chatName: string): Promise<boolean> {
    return this.server.addListen(chatName);
  }

  /**
   * Remove a chat from listen list.
   */
  async removeListen(chatName: string): Promise<boolean> {
    return this.server.removeListen(chatName);
  }

  /**
   * Get connection status.
   */
  isConnected(): boolean {
    return this.server.isConnected();
  }

  /**
   * Get current wxid.
   */
  getWxid(): string | null {
    return this.server.getWxid();
  }

  /**
   * Get current nickname.
   */
  getNickname(): string | null {
    return this.server.getNickname();
  }

  /**
   * Get the underlying bridge server for upgrade handling.
   */
  getBridgeServer(): WeChatBridgeServer {
    return this.server;
  }
}

// Singleton gateway instances per account
const gateways = new Map<string, WeChatGateway>();

/**
 * Get or create a gateway instance for an account.
 */
export function getGateway(accountId: string): WeChatGateway | undefined {
  return gateways.get(accountId);
}

/**
 * Create and register a gateway instance.
 */
export function createGateway(options: WeChatGatewayOptions): WeChatGateway {
  const existing = gateways.get(options.accountId);
  if (existing) {
    existing.disconnect();
  }

  const gateway = new WeChatGateway(options);
  gateways.set(options.accountId, gateway);
  return gateway;
}

/**
 * Remove a gateway instance.
 */
export function removeGateway(accountId: string): void {
  const gateway = gateways.get(accountId);
  if (gateway) {
    gateway.disconnect();
    gateways.delete(accountId);
  }
}

/**
 * Handle WebSocket upgrade for wechat channel.
 * This should be called from the main gateway's upgrade handler.
 */
export function handleWeChatUpgrade(
  req: import("node:http").IncomingMessage,
  socket: import("node:stream").Duplex,
  head: Buffer,
): boolean {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname !== "/channels/wechat") {
    return false;
  }

  // Find any active bridge server to handle the upgrade
  const servers = getAllBridgeServers();

  if (servers.length === 0) {
    // No servers available, reject connection
    socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
    socket.destroy();
    return true;
  }

  // Use the first available server (typically there's only one)
  return servers[0].handleUpgrade(req, socket, head);
}

// Re-export for convenience
export { getBridgeServer, getAllBridgeServers };
