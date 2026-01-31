import type { WeChatBridgeCommand, WeChatBridgeEvent, WeChatMessage } from "./types.js";

export type GatewayMessageHandler = (message: WeChatMessage) => void;
export type GatewayStatusHandler = (status: {
  connected: boolean;
  wxid?: string;
  nickname?: string;
  error?: string;
}) => void;

export interface WeChatGatewayOptions {
  bridgeUrl: string;
  accountId: string;
  onMessage: GatewayMessageHandler;
  onStatus?: GatewayStatusHandler;
  listenChats?: string[];
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

/**
 * WeChat gateway manages WebSocket connection to wxauto-bridge.
 */
export class WeChatGateway {
  private ws: WebSocket | null = null;
  private options: WeChatGatewayOptions;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isClosing = false;
  private wxid: string | null = null;
  private nickname: string | null = null;

  constructor(options: WeChatGatewayOptions) {
    this.options = {
      reconnectDelayMs: 5000,
      maxReconnectAttempts: 10,
      ...options,
    };
  }

  /**
   * Connect to wxauto-bridge WebSocket.
   */
  async connect(): Promise<void> {
    if (this.ws) {
      return;
    }

    this.isClosing = false;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.bridgeUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.startPingInterval();

          // Add listen chats if configured
          if (this.options.listenChats?.length) {
            for (const chatName of this.options.listenChats) {
              this.send({ type: "addListen", chatName });
            }
          }

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data as string);
        };

        this.ws.onerror = (error) => {
          console.error(`[wechat:${this.options.accountId}] WebSocket error:`, error);
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            reject(new Error("WebSocket connection failed"));
          }
        };

        this.ws.onclose = () => {
          this.cleanup();
          this.options.onStatus?.({
            connected: false,
            wxid: this.wxid ?? undefined,
            nickname: this.nickname ?? undefined,
          });

          if (!this.isClosing) {
            this.scheduleReconnect();
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Disconnect from wxauto-bridge.
   */
  disconnect(): void {
    this.isClosing = true;
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a command to wxauto-bridge.
   */
  send(command: WeChatBridgeCommand): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(command));
      return true;
    } catch (err) {
      console.error(`[wechat:${this.options.accountId}] Send error:`, err);
      return false;
    }
  }

  /**
   * Send a text message.
   */
  sendText(to: string, text: string): boolean {
    return this.send({ type: "send", to, text });
  }

  /**
   * Send a file.
   */
  sendFile(to: string, filePath: string): boolean {
    return this.send({ type: "sendFile", to, filePath });
  }

  /**
   * Add a chat to listen list.
   */
  addListen(chatName: string): boolean {
    return this.send({ type: "addListen", chatName });
  }

  /**
   * Remove a chat from listen list.
   */
  removeListen(chatName: string): boolean {
    return this.send({ type: "removeListen", chatName });
  }

  /**
   * Get connection status.
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
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

  private handleMessage(data: string): void {
    try {
      const event = JSON.parse(data) as WeChatBridgeEvent;

      switch (event.type) {
        case "message":
          this.options.onMessage(event.data);
          break;

        case "connected":
          this.wxid = event.wxid;
          this.nickname = event.nickname;
          this.options.onStatus?.({
            connected: true,
            wxid: event.wxid,
            nickname: event.nickname,
          });
          break;

        case "disconnected":
          this.options.onStatus?.({
            connected: false,
            error: event.reason,
          });
          break;

        case "error":
          console.error(`[wechat:${this.options.accountId}] Bridge error:`, event.message);
          this.options.onStatus?.({
            connected: this.isConnected(),
            error: event.message,
          });
          break;

        case "pong":
          // Heartbeat response, no action needed
          break;

        case "chats":
          // Chat list response, can be used for status
          break;
      }
    } catch (err) {
      console.error(`[wechat:${this.options.accountId}] Failed to parse message:`, err);
    }
  }

  private cleanup(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPingInterval(): void {
    this.pingTimer = setInterval(() => {
      this.send({ type: "ping" });
    }, 30000);
  }

  private scheduleReconnect(): void {
    if (
      this.reconnectAttempts >= (this.options.maxReconnectAttempts ?? 10)
    ) {
      console.error(
        `[wechat:${this.options.accountId}] Max reconnect attempts reached`
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.options.reconnectDelayMs ?? 5000;

    console.log(
      `[wechat:${this.options.accountId}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.ws = null;
      this.connect().catch((err) => {
        console.error(`[wechat:${this.options.accountId}] Reconnect failed:`, err);
      });
    }, delay);
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
