import { describe, expect, it } from "vitest";
import { resolveEffectiveSessionKey } from "./session-key-rewrite.js";
import type { GatewayClient } from "./types.js";

/**
 * resolveEffectiveSessionKey 测试
 *
 * 验证网关层从 RPC 请求中解析有效会话键的逻辑
 * 核心职责：提取 client.authenticatedUser.userId 并委托给 rewriteSessionKeyForUser
 */
describe("resolveEffectiveSessionKey", () => {
  // --- 已认证客户端 → 自动注入 user: 前缀 ---

  it("rewrites agent key for authenticated client", () => {
    const client: GatewayClient = {
      connect: {} as GatewayClient["connect"],
      authenticatedUser: {
        userId: "alice",
        authenticatedAt: new Date(),
      },
    };
    const result = resolveEffectiveSessionKey({
      sessionKey: "agent:main:main",
      client,
    });
    expect(result).toEqual({ ok: true, sessionKey: "user:alice:agent:main:main" });
  });

  it("passes through matching user-prefixed key for authenticated client", () => {
    const client: GatewayClient = {
      connect: {} as GatewayClient["connect"],
      authenticatedUser: {
        userId: "alice",
        authenticatedAt: new Date(),
      },
    };
    const result = resolveEffectiveSessionKey({
      sessionKey: "user:alice:agent:main:main",
      client,
    });
    expect(result).toEqual({ ok: true, sessionKey: "user:alice:agent:main:main" });
  });

  it("rejects mismatched user prefix for authenticated client", () => {
    const client: GatewayClient = {
      connect: {} as GatewayClient["connect"],
      authenticatedUser: {
        userId: "alice",
        authenticatedAt: new Date(),
      },
    };
    const result = resolveEffectiveSessionKey({
      sessionKey: "user:bob:agent:main:main",
      client,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("mismatch");
    }
  });

  // --- 未认证客户端 → 原样返回（向后兼容）---

  it("passes through when client is null (backward compat)", () => {
    const result = resolveEffectiveSessionKey({
      sessionKey: "agent:main:main",
      client: null,
    });
    expect(result).toEqual({ ok: true, sessionKey: "agent:main:main" });
  });

  it("passes through when client has no authenticatedUser", () => {
    const client: GatewayClient = {
      connect: {} as GatewayClient["connect"],
    };
    const result = resolveEffectiveSessionKey({
      sessionKey: "agent:main:main",
      client,
    });
    expect(result).toEqual({ ok: true, sessionKey: "agent:main:main" });
  });

  // --- 特殊键值不改写 ---

  it("passes through global key unchanged for authenticated client", () => {
    const client: GatewayClient = {
      connect: {} as GatewayClient["connect"],
      authenticatedUser: {
        userId: "alice",
        authenticatedAt: new Date(),
      },
    };
    const result = resolveEffectiveSessionKey({
      sessionKey: "global",
      client,
    });
    expect(result).toEqual({ ok: true, sessionKey: "global" });
  });

  it("passes through empty key unchanged for authenticated client", () => {
    const client: GatewayClient = {
      connect: {} as GatewayClient["connect"],
      authenticatedUser: {
        userId: "alice",
        authenticatedAt: new Date(),
      },
    };
    const result = resolveEffectiveSessionKey({
      sessionKey: "",
      client,
    });
    expect(result).toEqual({ ok: true, sessionKey: "" });
  });

  // --- 复杂会话键 ---

  it("rewrites complex agent key with subagent for authenticated client", () => {
    const client: GatewayClient = {
      connect: {} as GatewayClient["connect"],
      authenticatedUser: {
        userId: "bob",
        authenticatedAt: new Date(),
      },
    };
    const result = resolveEffectiveSessionKey({
      sessionKey: "agent:main:subagent:task1",
      client,
    });
    expect(result).toEqual({ ok: true, sessionKey: "user:bob:agent:main:subagent:task1" });
  });

  it("rewrites dm peer key for authenticated client", () => {
    const client: GatewayClient = {
      connect: {} as GatewayClient["connect"],
      authenticatedUser: {
        userId: "carol",
        authenticatedAt: new Date(),
      },
    };
    const result = resolveEffectiveSessionKey({
      sessionKey: "agent:main:dm:+15551234567",
      client,
    });
    expect(result).toEqual({
      ok: true,
      sessionKey: "user:carol:agent:main:dm:+15551234567",
    });
  });
});
