import { describe, expect, it, vi, beforeEach } from "vitest";
import type { GatewayClient } from "./types.js";

/**
 * devices.ts handler 测试
 *
 * 验证基础设施层 device.pair.* / device.token.* 方法的
 * 用户认证和归属校验逻辑。
 */

// Mock 依赖模块
vi.mock("../../infra/device-pairing-db.js", () => ({
  listDevicePairingByUserId: vi.fn(),
  listDevicePairing: vi.fn(),
  approveDevicePairing: vi.fn(),
  rejectDevicePairing: vi.fn(),
  rotateDeviceToken: vi.fn(),
  revokeDeviceToken: vi.fn(),
  summarizeDeviceTokens: vi.fn((tokens) => tokens),
  verifyDeviceOwnership: vi.fn(),
  verifyPairingRequestOwnership: vi.fn(),
}));

vi.mock("../protocol/index.js", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    // 让 validate* 函数始终返回 true
    validateDevicePairListParams: Object.assign(() => true, { errors: null }),
    validateDevicePairApproveParams: Object.assign(() => true, { errors: null }),
    validateDevicePairRejectParams: Object.assign(() => true, { errors: null }),
    validateDeviceTokenRotateParams: Object.assign(() => true, { errors: null }),
    validateDeviceTokenRevokeParams: Object.assign(() => true, { errors: null }),
  };
});

import { deviceHandlers } from "./devices.js";
import {
  listDevicePairingByUserId,
  approveDevicePairing,
  rejectDevicePairing,
  rotateDeviceToken,
  revokeDeviceToken,
  verifyDeviceOwnership,
  verifyPairingRequestOwnership,
} from "../../infra/device-pairing-db.js";

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
    broadcast: vi.fn(),
    dedupe: new Map(),
  } as unknown as Parameters<(typeof deviceHandlers)["device.pair.list"]>[0]["context"];
}

describe("deviceHandlers", () => {
  let respond: ReturnType<typeof vi.fn>;
  let context: ReturnType<typeof makeContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    respond = vi.fn();
    context = makeContext();
  });

  // ==========================================================================
  // device.pair.list
  // ==========================================================================
  describe("device.pair.list", () => {
    const handler = deviceHandlers["device.pair.list"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        req: { id: "1", method: "device.pair.list" },
        params: {},
        client: makeUnauthClient(),
        respond,
        context,
        isWebchatConnect: () => false,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(listDevicePairingByUserId).not.toHaveBeenCalled();
    });

    it("returns user-scoped devices for authenticated client", async () => {
      const mockList = { pending: [], paired: [{ deviceId: "dev-1" }] };
      vi.mocked(listDevicePairingByUserId).mockResolvedValue(mockList as never);

      await handler({
        req: { id: "1", method: "device.pair.list" },
        params: {},
        client: makeAuthClient("alice"),
        respond,
        context,
        isWebchatConnect: () => false,
      } as unknown as Parameters<typeof handler>[0]);

      expect(listDevicePairingByUserId).toHaveBeenCalledWith("alice");
      expect(respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ pending: [], paired: expect.any(Array) }),
        undefined,
      );
    });
  });

  // ==========================================================================
  // device.pair.approve
  // ==========================================================================
  describe("device.pair.approve", () => {
    const handler = deviceHandlers["device.pair.approve"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        req: { id: "1", method: "device.pair.approve" },
        params: { requestId: "req-1" },
        client: makeUnauthClient(),
        respond,
        context,
        isWebchatConnect: () => false,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(approveDevicePairing).not.toHaveBeenCalled();
    });

    it("rejects when pairing request does not belong to user", async () => {
      vi.mocked(verifyPairingRequestOwnership).mockResolvedValue(false);

      await handler({
        req: { id: "1", method: "device.pair.approve" },
        params: { requestId: "req-1" },
        client: makeAuthClient("alice"),
        respond,
        context,
        isWebchatConnect: () => false,
      } as unknown as Parameters<typeof handler>[0]);

      expect(verifyPairingRequestOwnership).toHaveBeenCalledWith("req-1", "alice");
      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ message: expect.stringContaining("无权") }),
      );
      expect(approveDevicePairing).not.toHaveBeenCalled();
    });

    it("approves when request belongs to user", async () => {
      vi.mocked(verifyPairingRequestOwnership).mockResolvedValue(true);
      vi.mocked(approveDevicePairing).mockResolvedValue({
        requestId: "req-1",
        device: { deviceId: "dev-1", tokens: {} },
      } as never);

      await handler({
        req: { id: "1", method: "device.pair.approve" },
        params: { requestId: "req-1" },
        client: makeAuthClient("alice"),
        respond,
        context,
        isWebchatConnect: () => false,
      } as unknown as Parameters<typeof handler>[0]);

      expect(approveDevicePairing).toHaveBeenCalledWith("req-1");
      expect(respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ requestId: "req-1" }),
        undefined,
      );
    });
  });

  // ==========================================================================
  // device.pair.reject
  // ==========================================================================
  describe("device.pair.reject", () => {
    const handler = deviceHandlers["device.pair.reject"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        req: { id: "1", method: "device.pair.reject" },
        params: { requestId: "req-1" },
        client: makeUnauthClient(),
        respond,
        context,
        isWebchatConnect: () => false,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(rejectDevicePairing).not.toHaveBeenCalled();
    });

    it("rejects when pairing request does not belong to user", async () => {
      vi.mocked(verifyPairingRequestOwnership).mockResolvedValue(false);

      await handler({
        req: { id: "1", method: "device.pair.reject" },
        params: { requestId: "req-1" },
        client: makeAuthClient("bob"),
        respond,
        context,
        isWebchatConnect: () => false,
      } as unknown as Parameters<typeof handler>[0]);

      expect(verifyPairingRequestOwnership).toHaveBeenCalledWith("req-1", "bob");
      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ message: expect.stringContaining("无权") }),
      );
    });
  });

  // ==========================================================================
  // device.token.rotate
  // ==========================================================================
  describe("device.token.rotate", () => {
    const handler = deviceHandlers["device.token.rotate"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        req: { id: "1", method: "device.token.rotate" },
        params: { deviceId: "dev-1", role: "node" },
        client: makeUnauthClient(),
        respond,
        context,
        isWebchatConnect: () => false,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(rotateDeviceToken).not.toHaveBeenCalled();
    });

    it("rejects when device does not belong to user", async () => {
      vi.mocked(verifyDeviceOwnership).mockResolvedValue(false);

      await handler({
        req: { id: "1", method: "device.token.rotate" },
        params: { deviceId: "dev-1", role: "node" },
        client: makeAuthClient("alice"),
        respond,
        context,
        isWebchatConnect: () => false,
      } as unknown as Parameters<typeof handler>[0]);

      expect(verifyDeviceOwnership).toHaveBeenCalledWith("dev-1", "alice");
      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ message: expect.stringContaining("无权") }),
      );
    });

    it("rotates token when device belongs to user", async () => {
      vi.mocked(verifyDeviceOwnership).mockResolvedValue(true);
      vi.mocked(rotateDeviceToken).mockResolvedValue({
        token: "new-token",
        role: "node",
        scopes: ["chat"],
        createdAtMs: Date.now(),
      } as never);

      await handler({
        req: { id: "1", method: "device.token.rotate" },
        params: { deviceId: "dev-1", role: "node" },
        client: makeAuthClient("alice"),
        respond,
        context,
        isWebchatConnect: () => false,
      } as unknown as Parameters<typeof handler>[0]);

      expect(rotateDeviceToken).toHaveBeenCalledWith({
        deviceId: "dev-1",
        role: "node",
        scopes: undefined,
      });
      expect(respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ deviceId: "dev-1", token: "new-token" }),
        undefined,
      );
    });
  });

  // ==========================================================================
  // device.token.revoke
  // ==========================================================================
  describe("device.token.revoke", () => {
    const handler = deviceHandlers["device.token.revoke"]!;

    it("rejects unauthenticated client", async () => {
      await handler({
        req: { id: "1", method: "device.token.revoke" },
        params: { deviceId: "dev-1", role: "node" },
        client: makeUnauthClient(),
        respond,
        context,
        isWebchatConnect: () => false,
      } as unknown as Parameters<typeof handler>[0]);

      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ code: "INVALID_REQUEST" }),
      );
      expect(revokeDeviceToken).not.toHaveBeenCalled();
    });

    it("rejects when device does not belong to user", async () => {
      vi.mocked(verifyDeviceOwnership).mockResolvedValue(false);

      await handler({
        req: { id: "1", method: "device.token.revoke" },
        params: { deviceId: "dev-1", role: "node" },
        client: makeAuthClient("alice"),
        respond,
        context,
        isWebchatConnect: () => false,
      } as unknown as Parameters<typeof handler>[0]);

      expect(verifyDeviceOwnership).toHaveBeenCalledWith("dev-1", "alice");
      expect(respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ message: expect.stringContaining("无权") }),
      );
    });
  });
});
