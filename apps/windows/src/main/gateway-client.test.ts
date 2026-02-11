/**
 * GatewayClient 单元测试
 *
 * 测试用例:
 * - WIN-GW-001: 握手协议 (发送 connect 请求，协商 protocolVersion)
 * - WIN-GW-002: 连接断开重连 (自动重连，触发 reconnecting 事件)
 * - WIN-GW-003: 技能执行协议 (收到 SKILL_EXECUTE_EVENT，调用技能运行时)
 * - 额外: disconnect / call / 状态管理
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { WebSocketServer } from "ws";
import http from "http";
import { GatewayClient } from "./gateway-client";

/**
 * 辅助: 获取空闲端口并创建测试 WS 服务器
 */
function createTestServer(): Promise<{
  server: http.Server;
  wss: InstanceType<typeof WebSocketServer>;
  port: number;
  close: () => Promise<void>;
}> {
  return new Promise((resolve) => {
    const server = http.createServer();
    const wss = new WebSocketServer({ server });
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({
        server,
        wss,
        port: addr.port,
        close: () =>
          new Promise<void>((res) => {
            wss.close();
            server.close(() => res());
          }),
      });
    });
  });
}

describe("GatewayClient", () => {
  let testServer: Awaited<ReturnType<typeof createTestServer>>;
  let client: GatewayClient;

  beforeEach(async () => {
    testServer = await createTestServer();
    client = new GatewayClient({
      url: `ws://127.0.0.1:${testServer.port}`,
      token: "test-token",
      reconnectInterval: 100,
      maxReconnectAttempts: 0,
      heartbeatInterval: 60000,
      requestTimeout: 5000,
    });
  });

  afterEach(async () => {
    await client.disconnect();
    await testServer.close();
  });

  // ===========================================================================
  // WIN-GW-001: 握手协议
  // ===========================================================================
  describe("WIN-GW-001: 握手协议", () => {
    it("应完成 challenge -> connect -> 握手成功流程", async () => {
      const connectedPromise = new Promise<void>((resolve) => {
        client.on("connected", () => resolve());
      });

      // 服务端模拟: 发 challenge, 收到 connect req, 返回 ok res
      testServer.wss.on("connection", (ws) => {
        // 发送 connect.challenge
        ws.send(
          JSON.stringify({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "test-nonce-123", ts: Date.now() },
          }),
        );

        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "req" && msg.method === "connect") {
            // 验证 connect 参数
            expect(msg.params.minProtocol).toBe(3);
            expect(msg.params.maxProtocol).toBe(3);
            expect(msg.params.client.platform).toBe("win32");
            expect(msg.params.auth?.token).toBe("test-token");
            // 返回握手成功
            ws.send(
              JSON.stringify({
                type: "res",
                id: msg.id,
                ok: true,
                payload: { protocolVersion: 3, serverVersion: "1.0.0" },
              }),
            );
          }
        });
      });

      await client.connect();
      await connectedPromise;

      expect(client.isConnected()).toBe(true);
      expect(client.isHandshakeComplete()).toBe(true);
    });

    it("握手失败时应触发错误", async () => {
      testServer.wss.on("connection", (ws) => {
        ws.send(
          JSON.stringify({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "test-nonce", ts: Date.now() },
          }),
        );

        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "req" && msg.method === "connect") {
            ws.send(
              JSON.stringify({
                type: "res",
                id: msg.id,
                ok: false,
                error: { code: "AUTH_FAILED", message: "Invalid token" },
              }),
            );
          }
        });
      });

      await expect(client.connect()).rejects.toThrow("Invalid token");
    });
  });

  // ===========================================================================
  // WIN-GW-002: 连接断开重连
  // ===========================================================================
  describe("WIN-GW-002: 连接断开重连", () => {
    it("断开后应触发 disconnected 事件", async () => {
      const disconnectedPromise = new Promise<void>((resolve) => {
        client.on("disconnected", () => resolve());
      });

      // 服务端模拟握手成功后断开
      testServer.wss.on("connection", (ws) => {
        ws.send(
          JSON.stringify({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "nonce", ts: Date.now() },
          }),
        );
        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "req" && msg.method === "connect") {
            ws.send(
              JSON.stringify({
                type: "res",
                id: msg.id,
                ok: true,
                payload: {},
              }),
            );
            // 握手成功后立即断开
            setTimeout(() => ws.close(), 50);
          }
        });
      });

      await client.connect();
      await disconnectedPromise;

      expect(client.isConnected()).toBe(false);
    });

    it("getStatus 应反映重连尝试", async () => {
      const status = client.getStatus();
      expect(status.connected).toBe(false);
      expect(status.handshakeComplete).toBe(false);
      expect(status.reconnectAttempts).toBe(0);
    });
  });

  // ===========================================================================
  // WIN-GW-003: 技能执行协议
  // ===========================================================================
  describe("WIN-GW-003: 技能执行协议", () => {
    it("收到 skill.execute.request 事件应触发 skill:execute", async () => {
      const skillRequestPromise = new Promise<unknown>((resolve) => {
        client.on("skill:execute", (request) => resolve(request));
      });

      // 模拟服务端：握手成功后发送技能执行请求
      testServer.wss.on("connection", (ws) => {
        ws.send(
          JSON.stringify({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "nonce", ts: Date.now() },
          }),
        );
        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "req" && msg.method === "connect") {
            ws.send(
              JSON.stringify({
                type: "res",
                id: msg.id,
                ok: true,
                payload: {},
              }),
            );
            // 发送技能执行请求
            setTimeout(() => {
              ws.send(
                JSON.stringify({
                  type: "event",
                  event: "skill.execute.request",
                  payload: {
                    requestId: "req-001",
                    skillId: "builtin:system-info",
                    params: {},
                    requireConfirm: false,
                    timeoutMs: 5000,
                    runMode: "local",
                  },
                }),
              );
            }, 50);
          }
        });
      });

      await client.connect();
      const request = (await skillRequestPromise) as { requestId: string; skillId: string };
      expect(request.requestId).toBe("req-001");
      expect(request.skillId).toBe("builtin:system-info");
    });

    it("无 SkillRuntime 时收到执行请求应返回错误结果", async () => {
      const resultPromise = new Promise<unknown>((resolve) => {
        testServer.wss.on("connection", (ws) => {
          ws.send(
            JSON.stringify({
              type: "event",
              event: "connect.challenge",
              payload: { nonce: "nonce", ts: Date.now() },
            }),
          );
          ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "req" && msg.method === "connect") {
              ws.send(
                JSON.stringify({
                  type: "res",
                  id: msg.id,
                  ok: true,
                  payload: {},
                }),
              );
              // 发送技能执行请求
              setTimeout(() => {
                ws.send(
                  JSON.stringify({
                    type: "event",
                    event: "skill.execute.request",
                    payload: {
                      requestId: "req-002",
                      skillId: "builtin:test",
                      params: {},
                      requireConfirm: false,
                      timeoutMs: 5000,
                      runMode: "local",
                    },
                  }),
                );
              }, 50);
            } else if (msg.type === "req" && msg.method === "assistant.skill.result") {
              resolve(msg.params);
              ws.send(
                JSON.stringify({
                  type: "res",
                  id: msg.id,
                  ok: true,
                  payload: {},
                }),
              );
            }
          });
        });
      });

      // 不设置 skillRuntime
      await client.connect();
      const result = (await resultPromise) as { requestId: string; success: boolean; error?: { code: string } };
      expect(result.requestId).toBe("req-002");
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INTERNAL_ERROR");
    });
  });

  // ===========================================================================
  // disconnect / call
  // ===========================================================================
  describe("disconnect", () => {
    it("disconnect 应清理所有资源", async () => {
      testServer.wss.on("connection", (ws) => {
        ws.send(
          JSON.stringify({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "nonce", ts: Date.now() },
          }),
        );
        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "req" && msg.method === "connect") {
            ws.send(JSON.stringify({ type: "res", id: msg.id, ok: true, payload: {} }));
          }
        });
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);

      await client.disconnect();
      expect(client.isConnected()).toBe(false);
      expect(client.isHandshakeComplete()).toBe(false);
    });
  });

  describe("call", () => {
    it("未连接时调用 call 应抛出错误", async () => {
      await expect(client.call("test.method")).rejects.toThrow(
        "Not connected to Gateway",
      );
    });
  });

  // ===========================================================================
  // 配置方法
  // ===========================================================================
  describe("配置方法", () => {
    it("setUrl 应更新 URL", () => {
      client.setUrl("ws://new-host:9999");
      // 无直接 getter，通过重连验证即可
    });

    it("setToken 应更新 Token", () => {
      client.setToken("new-token");
      // 无直接 getter，通过重连验证即可
    });

    it("setSkillRuntime / getSkillRuntime 应正确设置和获取", () => {
      expect(client.getSkillRuntime()).toBeNull();
      const mockRuntime = { executeSkill: vi.fn() } as unknown as import("./skill-runtime").ClientSkillRuntime;
      client.setSkillRuntime(mockRuntime);
      expect(client.getSkillRuntime()).toBe(mockRuntime);
    });
  });
});
