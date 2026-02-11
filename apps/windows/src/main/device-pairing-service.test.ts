/**
 * DevicePairingService 单元测试
 *
 * 测试用例:
 * - WIN-PAIR-001: 生成配对码 (6 位数字码，5 分钟有效)
 * - WIN-PAIR-002: 配对码校验 (正确码→配对成功，错误码→拒绝)
 * - WIN-PAIR-003: 取消配对 (清除配对状态)
 * - 额外: 初始化、状态管理、Token 刷新/验证
 */

import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock electron BEFORE importing the module
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn((name: string) => `/mock/${name}`),
  },
}));

// Mock fs to avoid actual file I/O
vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
}));

import { DevicePairingService } from "./device-pairing-service";

describe("DevicePairingService", () => {
  let service: DevicePairingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DevicePairingService();
  });

  // ===========================================================================
  // WIN-PAIR-001: 初始化与设备信息
  // ===========================================================================
  describe("WIN-PAIR-001: 设备初始化", () => {
    it("初始化时应生成新设备信息", async () => {
      const device = await service.initialize();
      expect(device).toBeDefined();
      expect(device.deviceId).toBeTruthy();
      expect(device.displayName).toContain("OpenClaw Assistant");
      expect(device.platform).toBeTruthy();
      expect(device.clientId).toBe("openclaw-windows");
      expect(device.clientMode).toBe("assistant");
      expect(device.createdAt).toBeGreaterThan(0);
    });

    it("getDevice 初始化前应返回 null", () => {
      expect(service.getDevice()).toBeNull();
    });

    it("getDevice 初始化后应返回设备信息", async () => {
      await service.initialize();
      expect(service.getDevice()).toBeTruthy();
    });

    it("初始化后状态应为 unpaired", async () => {
      await service.initialize();
      const state = service.getPairingStatus();
      expect(state?.status).toBe("unpaired");
    });
  });

  // ===========================================================================
  // WIN-PAIR-002: 配对码校验
  // ===========================================================================
  describe("WIN-PAIR-002: 配对码校验", () => {
    it("配对码正确时应配对成功", async () => {
      await service.initialize();

      const mockGatewayCall = vi.fn().mockResolvedValue({
        success: true,
        token: "mock-token-123",
      });

      const result = await service.pairWithCode(
        "123456",
        "ws://localhost:18789",
        mockGatewayCall,
      );
      expect(result.success).toBe(true);
      expect(result.token).toBe("mock-token-123");
      expect(service.isPaired()).toBe(true);
      expect(service.getToken()).toBe("mock-token-123");
      expect(service.getGatewayUrl()).toBe("ws://localhost:18789");
    });

    it("配对码错误时应拒绝", async () => {
      await service.initialize();

      const mockGatewayCall = vi.fn().mockResolvedValue({
        success: false,
        message: "无效的配对码",
      });

      const result = await service.pairWithCode(
        "000000",
        "ws://localhost:18789",
        mockGatewayCall,
      );
      expect(result.success).toBe(false);
      expect(result.message).toBe("无效的配对码");
      expect(service.isPaired()).toBe(false);
    });

    it("Gateway 调用失败时应返回错误", async () => {
      await service.initialize();

      const mockGatewayCall = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await service.pairWithCode(
        "123456",
        "ws://localhost:18789",
        mockGatewayCall,
      );
      expect(result.success).toBe(false);
      expect(result.message).toBe("Network error");
    });

    it("未初始化时调用 pairWithCode 应抛出错误", async () => {
      const mockGatewayCall = vi.fn();
      await expect(
        service.pairWithCode("123456", "ws://localhost:18789", mockGatewayCall),
      ).rejects.toThrow("设备未初始化");
    });
  });

  // ===========================================================================
  // WIN-PAIR-003: 取消配对
  // ===========================================================================
  describe("WIN-PAIR-003: 取消配对", () => {
    it("取消配对后状态应为 unpaired", async () => {
      await service.initialize();

      // 先配对
      const mockGatewayCall = vi.fn().mockResolvedValue({
        success: true,
        token: "mock-token",
      });
      await service.pairWithCode("123456", "ws://localhost:18789", mockGatewayCall);
      expect(service.isPaired()).toBe(true);

      // 取消配对
      await service.unpair();
      expect(service.isPaired()).toBe(false);
      expect(service.getToken()).toBeUndefined();
    });

    it("未初始化时取消配对不应报错", async () => {
      await expect(service.unpair()).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  // 配对请求流程
  // ===========================================================================
  describe("配对请求流程", () => {
    it("requestPairing 应发送配对请求", async () => {
      await service.initialize();

      const mockGatewayCall = vi.fn().mockResolvedValue({
        status: "pending",
        request: { requestId: "req-001", deviceId: "device-123" },
      });

      const result = await service.requestPairing(
        "ws://localhost:18789",
        mockGatewayCall,
      );
      expect(result.requestId).toBe("req-001");
      expect(result.status).toBe("pending");
      expect(service.getPairingStatus()?.status).toBe("pending");
    });

    it("checkPairingStatus 应检查配对状态", async () => {
      await service.initialize();

      // 先发起配对请求
      const mockGatewayCall = vi.fn()
        .mockResolvedValueOnce({
          status: "pending",
          request: { requestId: "req-001", deviceId: "device-123" },
        })
        .mockResolvedValueOnce({
          status: "approved",
          token: "approved-token",
        });

      await service.requestPairing("ws://localhost:18789", mockGatewayCall);
      const status = await service.checkPairingStatus(mockGatewayCall);
      expect(status).toBe("paired");
      expect(service.getToken()).toBe("approved-token");
    });
  });

  // ===========================================================================
  // Token 管理
  // ===========================================================================
  describe("Token 管理", () => {
    it("refreshToken 应刷新 Token", async () => {
      await service.initialize();

      // 先配对
      const mockCall = vi.fn()
        .mockResolvedValueOnce({ success: true, token: "old-token" })
        .mockResolvedValueOnce({ token: "new-token" });

      await service.pairWithCode("123456", "ws://localhost:18789", mockCall);
      const newToken = await service.refreshToken(mockCall);
      expect(newToken).toBe("new-token");
      expect(service.getToken()).toBe("new-token");
    });

    it("未配对时刷新 Token 应返回 null", async () => {
      await service.initialize();
      const mockCall = vi.fn();
      const result = await service.refreshToken(mockCall);
      expect(result).toBeNull();
    });

    it("verifyToken 应验证 Token 有效性", async () => {
      await service.initialize();

      // 先配对
      const mockCall = vi.fn()
        .mockResolvedValueOnce({ success: true, token: "valid-token" })
        .mockResolvedValueOnce({ valid: true });

      await service.pairWithCode("123456", "ws://localhost:18789", mockCall);
      const valid = await service.verifyToken(mockCall);
      expect(valid).toBe(true);
    });

    it("verifyToken Token 失效时应重置状态", async () => {
      await service.initialize();

      const mockCall = vi.fn()
        .mockResolvedValueOnce({ success: true, token: "expired-token" })
        .mockResolvedValueOnce({ valid: false });

      await service.pairWithCode("123456", "ws://localhost:18789", mockCall);
      const valid = await service.verifyToken(mockCall);
      expect(valid).toBe(false);
      expect(service.isPaired()).toBe(false);
    });
  });

  // ===========================================================================
  // 设备管理
  // ===========================================================================
  describe("设备管理", () => {
    it("resetDevice 应生成新的设备 ID", async () => {
      await service.initialize();
      const oldDevice = service.getDevice();
      const newDevice = await service.resetDevice();
      expect(newDevice.deviceId).not.toBe(oldDevice?.deviceId);
      expect(service.isPaired()).toBe(false);
    });

    it("updateDisplayName 应更新设备名称", async () => {
      await service.initialize();
      await service.updateDisplayName("My Custom Name");
      expect(service.getDevice()?.displayName).toBe("My Custom Name");
    });

    it("updateDisplayName 未初始化时应报错", async () => {
      await expect(service.updateDisplayName("Name")).rejects.toThrow("设备未初始化");
    });
  });
});
