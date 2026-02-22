import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { authorizeGatewayConnect, authorizeDeviceConnect, authorizeAdminConnect } from "./auth.js";
import { enableMockDatabase, clearMockDatabase } from "../db/mock-connection.js";
import {
  requestDevicePairing,
  approveDevicePairing,
  getPairedDevice,
} from "../infra/device-pairing-db.js";
import { generateAdminAccessToken } from "../assistant/admin-auth/admin-jwt.js";

describe("gateway auth", () => {
  it("does not throw when req is missing socket", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: { token: "secret" },
      // Regression: avoid crashing on req.socket.remoteAddress when callers pass a non-IncomingMessage.
      req: {} as never,
    });
    expect(res.ok).toBe(true);
  });

  it("reports missing and mismatched token reasons", async () => {
    const missing = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: null,
    });
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe("token_missing");

    const mismatch = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: { token: "wrong" },
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toBe("token_mismatch");
  });

  it("reports missing token config reason", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", allowTailscale: false },
      connectAuth: { token: "anything" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("token_missing_config");
  });

  it("reports missing and mismatched password reasons", async () => {
    const missing = await authorizeGatewayConnect({
      auth: { mode: "password", password: "secret", allowTailscale: false },
      connectAuth: null,
    });
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe("password_missing");

    const mismatch = await authorizeGatewayConnect({
      auth: { mode: "password", password: "secret", allowTailscale: false },
      connectAuth: { password: "wrong" },
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toBe("password_mismatch");
  });

  it("reports missing password config reason", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "password", allowTailscale: false },
      connectAuth: { password: "secret" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("password_missing_config");
  });

  it("treats local tailscale serve hostnames as direct", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: true },
      connectAuth: { token: "secret" },
      req: {
        socket: { remoteAddress: "127.0.0.1" },
        headers: { host: "gateway.tailnet-1234.ts.net:443" },
      } as never,
    });

    expect(res.ok).toBe(true);
    expect(res.method).toBe("token");
  });

  it("allows tailscale identity to satisfy token mode auth", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: true },
      connectAuth: null,
      tailscaleWhois: async () => ({ login: "peter", name: "Peter" }),
      req: {
        socket: { remoteAddress: "127.0.0.1" },
        headers: {
          host: "gateway.local",
          "x-forwarded-for": "100.64.0.1",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "ai-hub.bone-egret.ts.net",
          "tailscale-user-login": "peter",
          "tailscale-user-name": "Peter",
        },
      } as never,
    });

    expect(res.ok).toBe(true);
    expect(res.method).toBe("tailscale");
    expect(res.user).toBe("peter");
  });
});

describe("authorizeDeviceConnect", () => {
  beforeEach(() => {
    enableMockDatabase();
  });

  afterEach(() => {
    clearMockDatabase();
  });

  it("returns device-not-bound when device has no userId", async () => {
    // 配对设备（mock 环境不设置 userId）
    const pairResult = await requestDevicePairing({
      deviceId: "dev-auth-1",
      publicKey: "pk-auth-1",
      role: "operator",
      scopes: ["operator.admin"],
    });
    const approved = await approveDevicePairing(pairResult.request.requestId);
    expect(approved).not.toBeNull();

    // 获取设备 token
    const device = await getPairedDevice("dev-auth-1");
    const tokenInfo = device!.tokens?.["operator"];
    expect(tokenInfo).toBeTruthy();

    // 验证 — 设备未绑定用户，应返回 device-not-bound
    const result = await authorizeDeviceConnect({
      deviceId: "dev-auth-1",
      token: tokenInfo!.token,
      role: "operator",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("device-not-bound");
  });

  it("rejects wrong token", async () => {
    // 配对设备
    const pairResult = await requestDevicePairing({
      deviceId: "dev-auth-2",
      publicKey: "pk-auth-2",
      role: "operator",
      scopes: ["operator.admin"],
    });
    await approveDevicePairing(pairResult.request.requestId);

    const result = await authorizeDeviceConnect({
      deviceId: "dev-auth-2",
      token: "wrong-token",
      role: "operator",
    });
    expect(result.ok).toBe(false);
    expect(result.method).toBe("device-token");
  });

  it("rejects non-existent device", async () => {
    const result = await authorizeDeviceConnect({
      deviceId: "non-existent",
      token: "any-token",
    });
    expect(result.ok).toBe(false);
    expect(result.method).toBe("device-token");
  });
});

describe("authorizeAdminConnect", () => {
  it("returns admin-token-invalid for invalid JWT", async () => {
    const result = await authorizeAdminConnect("invalid-jwt-token");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("admin-token-invalid");
  });

  it("returns admin-token-invalid for empty token", async () => {
    const result = await authorizeAdminConnect("");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("admin-token-invalid");
  });

  it("returns ok with userId for valid admin JWT", async () => {
    // 生成有效的 Admin JWT
    const adminId = "test-admin-001";
    const { accessToken } = generateAdminAccessToken(adminId, "admin");

    const result = await authorizeAdminConnect(accessToken);
    expect(result.ok).toBe(true);
    expect(result.method).toBe("admin-token");
    expect(result.userId).toBe(adminId);
  });

  it("returns admin-token-invalid for expired JWT", async () => {
    // 生成已过期的 Admin JWT（有效期 0 秒）
    const { accessToken } = generateAdminAccessToken("expired-admin", "admin", {
      expiresIn: "0s",
    });

    // 等 1ms 确保过期
    await new Promise((r) => setTimeout(r, 10));

    const result = await authorizeAdminConnect(accessToken);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("admin-token-invalid");
  });
});
