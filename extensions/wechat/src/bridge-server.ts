/**
 * WeChat Bridge WebSocket Server
 *
 * Handles WebSocket connections from wxauto-bridge clients.
 * Uses JSON-RPC 2.0 protocol for communication.
 */

import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Socket } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";
import type { WeChatMessage } from "./types.js";

export type BridgeMessageHandler = (message: WeChatMessage) => void;
export type BridgeStatusHandler = (status: {
  connected: boolean;
  wxid?: string;
  nickname?: string;
  error?: string;
}) => void;

export interface WeChatBridgeServerOptions {
  accountId: string;
  onMessage: BridgeMessageHandler;
  onStatus?: BridgeStatusHandler;
  listenChats?: string[];
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * WeChat Bridge Server manages WebSocket connections from wxauto-bridge.
 */
export class WeChatBridgeServer {
  private wss: WebSocketServer;
  private client: WebSocket | null = null;
  private options: WeChatBridgeServerOptions;
  private pendingRequests = new Map<string, PendingRequest>();
  private wxid: string | null = null;
  private nickname: string | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: WeChatBridgeServerOptions) {
    this.options = options;
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on("connection", (ws) => {
      this.handleConnection(ws);
    });
  }

  /**
   * Handle WebSocket upgrade request.
   * Returns true if the request was handled.
   */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/channels/wechat") {
      return false;
    }

    this.wss.handleUpgrade(req, socket as Socket, head, (ws) => {
      this.wss.emit("connection", ws, req);
    });
    return true;
  }

  /**
   * Handle new WebSocket connection from bridge.
   */
  private handleConnection(ws: WebSocket): void {
    // Only allow one bridge connection at a time
    if (this.client) {
      console.log(`[wechat:${this.options.accountId}] Closing existing bridge connection`);
      this.client.close(1000, "New connection");
    }

    this.client = ws;
    console.log(`[wechat:${this.options.accountId}] Bridge connected`);

    ws.on("message", (data) => {
      this.handleMessage(data.toString());
    });

    ws.on("close", () => {
      console.log(`[wechat:${this.options.accountId}] Bridge disconnected`);
      this.cleanup();
      this.options.onStatus?.({
        connected: false,
        wxid: this.wxid ?? undefined,
        nickname: this.nickname ?? undefined,
      });
    });

    ws.on("error", (err) => {
      console.error(`[wechat:${this.options.accountId}] Bridge error:`, err);
    });

    // Start ping interval
    this.startPingInterval();
  }

  /**
   * Handle incoming message from bridge.
   */
  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data) as JsonRpcNotification | JsonRpcResponse;

      // Check if it's a response to a pending request
      if ("id" in msg && msg.id && this.pendingRequests.has(msg.id)) {
        const pending = this.pendingRequests.get(msg.id)!;
        this.pendingRequests.delete(msg.id);
        clearTimeout(pending.timeout);

        if ("error" in msg && msg.error) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve((msg as JsonRpcResponse).result);
        }
        return;
      }

      // Handle notifications from bridge
      if ("method" in msg) {
        this.handleNotification(msg as JsonRpcNotification);
      }
    } catch (err) {
      console.error(`[wechat:${this.options.accountId}] Failed to parse message:`, err);
    }
  }

  /**
   * Handle notification from bridge.
   */
  private handleNotification(msg: JsonRpcNotification): void {
    switch (msg.method) {
      case "wechat.connected": {
        const params = msg.params as {
          nickname?: string;
          wxid?: string;
          online?: boolean;
        };
        this.wxid = params.wxid ?? null;
        this.nickname = params.nickname ?? null;
        this.options.onStatus?.({
          connected: params.online ?? true,
          wxid: params.wxid,
          nickname: params.nickname,
        });

        // Add listen chats if configured
        if (this.options.listenChats?.length) {
          for (const chat of this.options.listenChats) {
            this.addListen(chat).catch((err) => {
              console.error(`[wechat:${this.options.accountId}] Failed to add listen:`, err);
            });
          }
        }
        break;
      }

      case "wechat.message": {
        const params = msg.params as {
          from: string;
          to: string;
          text: string;
          type: string;
          chatType: string;
          timestamp: number;
          isSelf?: boolean;
        };
        this.options.onMessage({
          from: params.from,
          to: params.to,
          text: params.text,
          type: params.type as WeChatMessage["type"],
          chatType: params.chatType as WeChatMessage["chatType"],
          timestamp: params.timestamp,
        });
        break;
      }

      case "wechat.status": {
        const params = msg.params as { status: string };
        this.options.onStatus?.({
          connected: params.status === "connected",
          wxid: this.wxid ?? undefined,
          nickname: this.nickname ?? undefined,
        });
        break;
      }
    }
  }

  /**
   * Send a JSON-RPC request to bridge and wait for response.
   */
  private async sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.client || this.client.readyState !== WebSocket.OPEN) {
      throw new Error("Bridge not connected");
    }

    const id = randomUUID();
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.client!.send(JSON.stringify(request));
    });
  }

  /**
   * Send a text message.
   */
  async sendText(to: string, text: string): Promise<boolean> {
    try {
      const result = (await this.sendRequest("send", { to, text })) as { ok: boolean };
      return result.ok;
    } catch (err) {
      console.error(`[wechat:${this.options.accountId}] Send failed:`, err);
      return false;
    }
  }

  /**
   * Send a file.
   */
  async sendFile(to: string, filePath: string): Promise<boolean> {
    try {
      const result = (await this.sendRequest("sendFile", { to, filePath })) as { ok: boolean };
      return result.ok;
    } catch (err) {
      console.error(`[wechat:${this.options.accountId}] SendFile failed:`, err);
      return false;
    }
  }

  /**
   * Add a chat to listen list.
   */
  async addListen(chat: string): Promise<boolean> {
    try {
      const result = (await this.sendRequest("addListen", { chat })) as { ok: boolean };
      return result.ok;
    } catch (err) {
      console.error(`[wechat:${this.options.accountId}] AddListen failed:`, err);
      return false;
    }
  }

  /**
   * Remove a chat from listen list.
   */
  async removeListen(chat: string): Promise<boolean> {
    try {
      const result = (await this.sendRequest("removeListen", { chat })) as { ok: boolean };
      return result.ok;
    } catch (err) {
      console.error(`[wechat:${this.options.accountId}] RemoveListen failed:`, err);
      return false;
    }
  }

  /**
   * Get bridge status.
   */
  async getStatus(): Promise<Record<string, unknown>> {
    try {
      return (await this.sendRequest("getStatus", {})) as Record<string, unknown>;
    } catch (err) {
      console.error(`[wechat:${this.options.accountId}] GetStatus failed:`, err);
      return { connected: false, error: String(err) };
    }
  }

  /**
   * Check if bridge is connected.
   */
  isConnected(): boolean {
    return this.client?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current wxid.
   */
  getWxid(): string | null {
    return this.wxid;
  }

  /**
   * Get current nickname.
   */
  getNickname(): string | null {
    return this.nickname;
  }

  /**
   * Close the server.
   */
  close(): void {
    this.cleanup();
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    this.wss.close();
  }

  private cleanup(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.client = null;

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();
  }

  private startPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
    this.pingTimer = setInterval(() => {
      this.sendRequest("ping", {}).catch(() => {
        // Ignore ping errors
      });
    }, 30000);
  }
}

// Singleton server instances per account
const servers = new Map<string, WeChatBridgeServer>();

/**
 * Get or create a bridge server instance for an account.
 */
export function getBridgeServer(accountId: string): WeChatBridgeServer | undefined {
  return servers.get(accountId);
}

/**
 * Create and register a bridge server instance.
 */
export function createBridgeServer(options: WeChatBridgeServerOptions): WeChatBridgeServer {
  const existing = servers.get(options.accountId);
  if (existing) {
    existing.close();
  }

  const server = new WeChatBridgeServer(options);
  servers.set(options.accountId, server);
  return server;
}

/**
 * Remove a bridge server instance.
 */
export function removeBridgeServer(accountId: string): void {
  const server = servers.get(accountId);
  if (server) {
    server.close();
    servers.delete(accountId);
  }
}

/**
 * Get all bridge servers for handling upgrades.
 */
export function getAllBridgeServers(): WeChatBridgeServer[] {
  return Array.from(servers.values());
}
