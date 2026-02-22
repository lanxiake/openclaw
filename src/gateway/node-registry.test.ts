/**
 * NodeRegistry.emitToUser() 多设备事件广播测试
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { NodeRegistry } from "./node-registry.js";
import type { GatewayWsClient } from "./server/ws-types.js";

/**
 * 创建模拟的 GatewayWsClient
 */
function createMockClient(opts: {
  connId: string;
  nodeId: string;
  userId?: string;
}): GatewayWsClient {
  return {
    socket: {
      send: vi.fn(),
      bufferedAmount: 0,
      readyState: 1, // WebSocket.OPEN
    } as unknown as GatewayWsClient["socket"],
    connect: {
      client: { id: opts.nodeId },
      device: { id: opts.nodeId },
    } as GatewayWsClient["connect"],
    connId: opts.connId,
    authenticatedUser: opts.userId
      ? {
          userId: opts.userId,
          authenticatedAt: new Date(),
        }
      : undefined,
  };
}

describe("NodeRegistry", () => {
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
  });

  describe("emitToUser", () => {
    it("向目标用户的所有节点发送事件", () => {
      const client1 = createMockClient({
        connId: "conn-1",
        nodeId: "node-1",
        userId: "user-a",
      });
      const client2 = createMockClient({
        connId: "conn-2",
        nodeId: "node-2",
        userId: "user-a",
      });
      registry.register(client1, {});
      registry.register(client2, {});

      const sent = registry.emitToUser("user-a", "chat", { text: "hello" });

      expect(sent).toBe(2);
      expect(client1.socket.send).toHaveBeenCalledOnce();
      expect(client2.socket.send).toHaveBeenCalledOnce();

      const frame1 = JSON.parse(
        (client1.socket.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string,
      );
      expect(frame1).toEqual({
        type: "event",
        event: "chat",
        payload: { text: "hello" },
      });

      const frame2 = JSON.parse(
        (client2.socket.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string,
      );
      expect(frame2).toEqual({
        type: "event",
        event: "chat",
        payload: { text: "hello" },
      });
    });

    it("不向其他用户的节点发送事件", () => {
      const clientA = createMockClient({
        connId: "conn-a",
        nodeId: "node-a",
        userId: "user-a",
      });
      const clientB = createMockClient({
        connId: "conn-b",
        nodeId: "node-b",
        userId: "user-b",
      });
      registry.register(clientA, {});
      registry.register(clientB, {});

      const sent = registry.emitToUser("user-a", "chat", { text: "private" });

      expect(sent).toBe(1);
      expect(clientA.socket.send).toHaveBeenCalledOnce();
      expect(clientB.socket.send).not.toHaveBeenCalled();
    });

    it("当用户无在线节点时返回 0", () => {
      const clientB = createMockClient({
        connId: "conn-b",
        nodeId: "node-b",
        userId: "user-b",
      });
      registry.register(clientB, {});

      const sent = registry.emitToUser("user-nonexistent", "chat", { text: "hello" });

      expect(sent).toBe(0);
      expect(clientB.socket.send).not.toHaveBeenCalled();
    });

    it("节点断开后不再接收事件", () => {
      const client = createMockClient({
        connId: "conn-1",
        nodeId: "node-1",
        userId: "user-a",
      });
      registry.register(client, {});

      // 断开连接
      registry.unregister("conn-1");

      const sent = registry.emitToUser("user-a", "chat", { text: "hello" });

      expect(sent).toBe(0);
      expect(client.socket.send).not.toHaveBeenCalled();
    });

    it("socket.send 抛出异常时不计入成功数", () => {
      const clientOk = createMockClient({
        connId: "conn-ok",
        nodeId: "node-ok",
        userId: "user-a",
      });
      const clientFail = createMockClient({
        connId: "conn-fail",
        nodeId: "node-fail",
        userId: "user-a",
      });
      // 模拟 send 抛出异常
      (clientFail.socket.send as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("connection closed");
      });
      registry.register(clientOk, {});
      registry.register(clientFail, {});

      const sent = registry.emitToUser("user-a", "chat", { text: "test" });

      // 一个成功，一个失败
      expect(sent).toBe(1);
      expect(clientOk.socket.send).toHaveBeenCalledOnce();
    });

    it("payload 为 undefined 时正常发送", () => {
      const client = createMockClient({
        connId: "conn-1",
        nodeId: "node-1",
        userId: "user-a",
      });
      registry.register(client, {});

      const sent = registry.emitToUser("user-a", "presence");

      expect(sent).toBe(1);
      const frame = JSON.parse(
        (client.socket.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string,
      );
      expect(frame).toEqual({
        type: "event",
        event: "presence",
        payload: undefined,
      });
    });
  });
});
