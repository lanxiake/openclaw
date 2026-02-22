import { describe, expect, it, vi, beforeEach } from "vitest";
import type { GatewayClient } from "./types.js";

/**
 * assistant-device.ts handler 测试
 *
 * 验证业务层 device.* 方法使用服务端 userId（而非客户端传入的 params.userId）
 */

// Mock 依赖模块
vi.mock("../../assistant/device/index.js", () => ({
  linkDevice: vi.fn(),
  unlinkDevice: vi.fn(),
  listUserDevices: vi.fn(),
  getDeviceQuota: vi.fn(),
  setPrimaryDevice: vi.fn(),
  updateDeviceAlias: vi.fn(),
  checkDevicePaired: vi.fn(),
  getDeviceInfo: vi.fn(),
  getUserIdByDeviceId: vi.fn(),
}));

vi.mock("../../infra/device-pairing-db.js", () => ({
  verifyDeviceOwnership: vi.fn(),
}));

import { deviceMethods } from "./assistant-device.js";
import {
  listUserDevices,
  linkDevice,
  unlinkDevice,
  getDeviceQuota,
  setPrimaryDevice,
  updateDeviceAlias,
  checkDevicePaired,
  getDeviceInfo,
  getUserIdByDeviceId,
} from "../../assistant/device/index.js";
import { verifyDeviceOwnership } from "../../infra/device-pairing-db.js";

/** 创建已认证的 GatewayClient */
function makeAuthClient(userId: string): GatewayClient {
  return {
    connect: {} as GatewayClient["connect"],
    authenticatedUser: {
      userId,
      authenticatedAt: new Date(),
    },
  };
}

/** 创建未认证的 GatewayClient */
function makeUnauthClient(): GatewayClient {
  return {
    connect: {} as GatewayClient["connect"],
  };
}

/** 创建 mock context */
function makeContext() {
  return {
    logGateway: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as Parameters<(typeof deviceMethods)["device.list"]>[0]["context"];
}

describe("deviceMethods (assistant-device)", () => {
  let respond: ReturnType<typeof vi.fn>;
  let context: ReturnType<typeof makeContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    respond = vi.fn();
    context = makeContext();
  });

  // ==========================================================================
  // device.list
  // ==========================================================================
  describe("device.list", () => {
    const handler = deviceMethods["device.list"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        params: {},
        client: makeUnauthClient(),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(listUserDevices).not.toHaveBeenCalled();
    });

    it("uses server-side userId instead of params.userId", async () => {
      vi.mocked(listUserDevices).mockResolvedValue({
        success: true,
        devices: [],
        quota: { current: 0, max: 5 },
      } as never);

      await handler({
        params: { userId: "attacker-fake-id" },
        client: makeAuthClient("real-alice"),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      // 应使用 client.authenticatedUser.userId, 不是 params.userId
      expect(listUserDevices).toHaveBeenCalledWith("real-alice");
      expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({ success: true }));
    });
  });

  // ==========================================================================
  // device.link
  // ==========================================================================
  describe("device.link", () => {
    const handler = deviceMethods["device.link"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        params: { deviceId: "dev-1" },
        client: makeUnauthClient(),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(linkDevice).not.toHaveBeenCalled();
    });

    it("uses server-side userId for linking", async () => {
      vi.mocked(linkDevice).mockResolvedValue({
        success: true,
        device: { deviceId: "dev-1" },
      } as never);

      await handler({
        params: { userId: "fake-id", deviceId: "dev-1" },
        client: makeAuthClient("real-bob"),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(linkDevice).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "real-bob", deviceId: "dev-1" }),
      );
    });
  });

  // ==========================================================================
  // device.unlink
  // ==========================================================================
  describe("device.unlink", () => {
    const handler = deviceMethods["device.unlink"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        params: { deviceId: "dev-1" },
        client: makeUnauthClient(),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(unlinkDevice).not.toHaveBeenCalled();
    });

    it("uses server-side userId for unlinking", async () => {
      vi.mocked(unlinkDevice).mockResolvedValue({
        success: true,
        device: { deviceId: "dev-1" },
      } as never);

      await handler({
        params: { userId: "fake-id", deviceId: "dev-1" },
        client: makeAuthClient("real-carol"),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(unlinkDevice).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "real-carol", deviceId: "dev-1" }),
      );
    });
  });

  // ==========================================================================
  // device.quota
  // ==========================================================================
  describe("device.quota", () => {
    const handler = deviceMethods["device.quota"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        params: {},
        client: makeUnauthClient(),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(getDeviceQuota).not.toHaveBeenCalled();
    });

    it("uses server-side userId", async () => {
      vi.mocked(getDeviceQuota).mockResolvedValue({ current: 1, max: 5 } as never);

      await handler({
        params: { userId: "fake-id" },
        client: makeAuthClient("real-dave"),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(getDeviceQuota).toHaveBeenCalledWith("real-dave");
    });
  });

  // ==========================================================================
  // device.setPrimary
  // ==========================================================================
  describe("device.setPrimary", () => {
    const handler = deviceMethods["device.setPrimary"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        params: { deviceId: "dev-1" },
        client: makeUnauthClient(),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(setPrimaryDevice).not.toHaveBeenCalled();
    });

    it("uses server-side userId", async () => {
      vi.mocked(setPrimaryDevice).mockResolvedValue({
        success: true,
        device: { deviceId: "dev-1" },
      } as never);

      await handler({
        params: { userId: "fake-id", deviceId: "dev-1" },
        client: makeAuthClient("real-eve"),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(setPrimaryDevice).toHaveBeenCalledWith("real-eve", "dev-1");
    });
  });

  // ==========================================================================
  // device.updateAlias
  // ==========================================================================
  describe("device.updateAlias", () => {
    const handler = deviceMethods["device.updateAlias"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        params: { deviceId: "dev-1", alias: "my-pc" },
        client: makeUnauthClient(),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(updateDeviceAlias).not.toHaveBeenCalled();
    });

    it("uses server-side userId", async () => {
      vi.mocked(updateDeviceAlias).mockResolvedValue({
        success: true,
        device: { deviceId: "dev-1" },
      } as never);

      await handler({
        params: { userId: "fake-id", deviceId: "dev-1", alias: "my-pc" },
        client: makeAuthClient("real-frank"),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(updateDeviceAlias).toHaveBeenCalledWith("real-frank", "dev-1", "my-pc");
    });
  });

  // ==========================================================================
  // device.checkPaired
  // ==========================================================================
  describe("device.checkPaired", () => {
    const handler = deviceMethods["device.checkPaired"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        params: { deviceId: "dev-1" },
        client: makeUnauthClient(),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(checkDevicePaired).not.toHaveBeenCalled();
    });

    it("requires authentication but allows any deviceId check", async () => {
      vi.mocked(checkDevicePaired).mockResolvedValue(true);

      await handler({
        params: { deviceId: "dev-1" },
        client: makeAuthClient("alice"),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(checkDevicePaired).toHaveBeenCalledWith("dev-1");
      expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({ isPaired: true }));
    });
  });

  // ==========================================================================
  // device.info
  // ==========================================================================
  describe("device.info", () => {
    const handler = deviceMethods["device.info"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        params: { deviceId: "dev-1" },
        client: makeUnauthClient(),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(getDeviceInfo).not.toHaveBeenCalled();
    });

    it("requires authentication and verifies ownership", async () => {
      vi.mocked(verifyDeviceOwnership).mockResolvedValue(true);
      vi.mocked(getDeviceInfo).mockResolvedValue({ deviceId: "dev-1" } as never);

      await handler({
        params: { deviceId: "dev-1" },
        client: makeAuthClient("alice"),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(verifyDeviceOwnership).toHaveBeenCalledWith("dev-1", "alice");
      expect(getDeviceInfo).toHaveBeenCalledWith("dev-1");
    });

    it("rejects when device does not belong to user", async () => {
      vi.mocked(verifyDeviceOwnership).mockResolvedValue(false);

      await handler({
        params: { deviceId: "dev-1" },
        client: makeAuthClient("alice"),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(verifyDeviceOwnership).toHaveBeenCalledWith("dev-1", "alice");
      expect(getDeviceInfo).not.toHaveBeenCalled();
      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ message: expect.stringContaining("无权") }),
      );
    });
  });

  // ==========================================================================
  // device.getUser
  // ==========================================================================
  describe("device.getUser", () => {
    const handler = deviceMethods["device.getUser"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        params: { deviceId: "dev-1" },
        client: makeUnauthClient(),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(getUserIdByDeviceId).not.toHaveBeenCalled();
    });

    it("requires authentication and verifies ownership", async () => {
      vi.mocked(verifyDeviceOwnership).mockResolvedValue(true);
      vi.mocked(getUserIdByDeviceId).mockResolvedValue("alice");

      await handler({
        params: { deviceId: "dev-1" },
        client: makeAuthClient("alice"),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(verifyDeviceOwnership).toHaveBeenCalledWith("dev-1", "alice");
      expect(getUserIdByDeviceId).toHaveBeenCalledWith("dev-1");
    });

    it("rejects when device does not belong to user", async () => {
      vi.mocked(verifyDeviceOwnership).mockResolvedValue(false);

      await handler({
        params: { deviceId: "dev-1" },
        client: makeAuthClient("alice"),
        respond,
        context,
      } as unknown as Parameters<typeof handler>[0]);

      expect(verifyDeviceOwnership).toHaveBeenCalledWith("dev-1", "alice");
      expect(getUserIdByDeviceId).not.toHaveBeenCalled();
    });
  });
});
