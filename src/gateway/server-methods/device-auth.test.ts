import { describe, expect, it, vi } from "vitest";
import { requireDeviceAuth } from "./device-auth.js";
import type { GatewayClient } from "./types.js";

/**
 * requireDeviceAuth 测试
 *
 * 验证从 client.authenticatedUser 提取 userId 的逻辑
 */
describe("requireDeviceAuth", () => {
  /** 创建 mock respond 函数 */
  const createMockRespond = () => vi.fn() as unknown as Parameters<typeof requireDeviceAuth>[1];

  // --- 已认证客户端 ---

  it("returns userId for authenticated client", () => {
    const client: GatewayClient = {
      connect: {} as GatewayClient["connect"],
      authenticatedUser: {
        userId: "user-123",
        authenticatedAt: new Date(),
      },
    };
    const respond = createMockRespond();

    const result = requireDeviceAuth(client, respond);

    expect(result).toBe("user-123");
    expect(respond).not.toHaveBeenCalled();
  });

  // --- 未认证客户端 ---

  it("returns null and responds error when client is null", () => {
    const respond = createMockRespond();

    const result = requireDeviceAuth(null, respond);

    expect(result).toBeNull();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "INVALID_REQUEST",
        message: expect.stringContaining("认证"),
      }),
    );
  });

  it("returns null and responds error when client has no authenticatedUser", () => {
    const client: GatewayClient = {
      connect: {} as GatewayClient["connect"],
    };
    const respond = createMockRespond();

    const result = requireDeviceAuth(client, respond);

    expect(result).toBeNull();
    expect(respond).toHaveBeenCalledOnce();
  });

  it("returns null when authenticatedUser has empty userId", () => {
    const client: GatewayClient = {
      connect: {} as GatewayClient["connect"],
      authenticatedUser: {
        userId: "",
        authenticatedAt: new Date(),
      },
    };
    const respond = createMockRespond();

    const result = requireDeviceAuth(client, respond);

    expect(result).toBeNull();
    expect(respond).toHaveBeenCalledOnce();
  });
});
