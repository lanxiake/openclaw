import { describe, expect, it } from "vitest";
import {
  buildUserAgentSessionKey,
  extractUserIdFromSessionKey,
  rewriteSessionKeyForUser,
  stripUserPrefix,
} from "./session-key.js";

describe("rewriteSessionKeyForUser", () => {
  it("rewrites old format agent key with userId", () => {
    const result = rewriteSessionKeyForUser({
      sessionKey: "agent:main:main",
      userId: "alice",
    });
    expect(result).toEqual({ ok: true, sessionKey: "user:alice:agent:main:main" });
  });

  it("rewrites old format with complex rest", () => {
    const result = rewriteSessionKeyForUser({
      sessionKey: "agent:main:subagent:task1",
      userId: "alice",
    });
    expect(result).toEqual({ ok: true, sessionKey: "user:alice:agent:main:subagent:task1" });
  });

  it("rewrites old format with dm peer", () => {
    const result = rewriteSessionKeyForUser({
      sessionKey: "agent:main:dm:+15551234567",
      userId: "bob",
    });
    expect(result).toEqual({ ok: true, sessionKey: "user:bob:agent:main:dm:+15551234567" });
  });

  it("passes through when user prefix already matches", () => {
    const result = rewriteSessionKeyForUser({
      sessionKey: "user:alice:agent:main:main",
      userId: "alice",
    });
    expect(result).toEqual({ ok: true, sessionKey: "user:alice:agent:main:main" });
  });

  it("rejects mismatched user prefix", () => {
    const result = rewriteSessionKeyForUser({
      sessionKey: "user:bob:agent:main:main",
      userId: "alice",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("mismatch");
    }
  });

  it("passes through when no userId (backward compat)", () => {
    const result = rewriteSessionKeyForUser({
      sessionKey: "agent:main:main",
      userId: undefined,
    });
    expect(result).toEqual({ ok: true, sessionKey: "agent:main:main" });
  });

  it("passes through global key unchanged", () => {
    const result = rewriteSessionKeyForUser({
      sessionKey: "global",
      userId: "alice",
    });
    expect(result).toEqual({ ok: true, sessionKey: "global" });
  });

  it("passes through unknown key unchanged", () => {
    const result = rewriteSessionKeyForUser({
      sessionKey: "unknown",
      userId: "alice",
    });
    expect(result).toEqual({ ok: true, sessionKey: "unknown" });
  });

  it("handles empty sessionKey", () => {
    const result = rewriteSessionKeyForUser({
      sessionKey: "",
      userId: "alice",
    });
    expect(result).toEqual({ ok: true, sessionKey: "" });
  });

  it("normalizes userId during rewrite", () => {
    const result = rewriteSessionKeyForUser({
      sessionKey: "agent:main:main",
      userId: "Alice-Test",
    });
    expect(result).toEqual({ ok: true, sessionKey: "user:alice-test:agent:main:main" });
  });
});

describe("stripUserPrefix", () => {
  it("strips user prefix from new format", () => {
    expect(stripUserPrefix("user:alice:agent:main:main")).toBe("agent:main:main");
  });

  it("strips user prefix with complex rest", () => {
    expect(stripUserPrefix("user:alice:agent:main:subagent:task1")).toBe(
      "agent:main:subagent:task1",
    );
  });

  it("returns old format unchanged", () => {
    expect(stripUserPrefix("agent:main:main")).toBe("agent:main:main");
  });

  it("returns global unchanged", () => {
    expect(stripUserPrefix("global")).toBe("global");
  });

  it("returns unknown unchanged", () => {
    expect(stripUserPrefix("unknown")).toBe("unknown");
  });

  it("handles user prefix without agent segment", () => {
    // No :agent: found, return as-is
    expect(stripUserPrefix("user:alice:something")).toBe("user:alice:something");
  });
});

describe("round-trip: build → extract → strip", () => {
  it("extractUserIdFromSessionKey works with buildUserAgentSessionKey", () => {
    const key = buildUserAgentSessionKey({ userId: "alice", agentId: "main", mainKey: "main" });
    expect(extractUserIdFromSessionKey(key)).toBe("alice");
  });

  it("stripUserPrefix undoes the user prefix from buildUserAgentSessionKey", () => {
    const key = buildUserAgentSessionKey({ userId: "alice", agentId: "main", mainKey: "main" });
    expect(stripUserPrefix(key)).toBe("agent:main:main");
  });

  it("rewrite then strip is identity for old format", () => {
    const original = "agent:main:main";
    const rewritten = rewriteSessionKeyForUser({ sessionKey: original, userId: "alice" });
    expect(rewritten.ok).toBe(true);
    if (rewritten.ok) {
      expect(stripUserPrefix(rewritten.sessionKey)).toBe(original);
    }
  });
});
