import { describe, expect, it } from "vitest";
import {
  isAcpSessionKey,
  isSubagentSessionKey,
  parseAgentSessionKey,
  resolveThreadParentSessionKey,
} from "./session-key-utils.js";

describe("parseAgentSessionKey", () => {
  // --- 旧格式 agent:{agentId}:{rest} ---
  it("parses old format agent:main:main", () => {
    expect(parseAgentSessionKey("agent:main:main")).toEqual({
      agentId: "main",
      rest: "main",
    });
  });

  it("parses old format with subagent rest", () => {
    expect(parseAgentSessionKey("agent:main:subagent:task1")).toEqual({
      agentId: "main",
      rest: "subagent:task1",
    });
  });

  it("parses old format with dm peer", () => {
    expect(parseAgentSessionKey("agent:main:dm:+15551234567")).toEqual({
      agentId: "main",
      rest: "dm:+15551234567",
    });
  });

  // --- 新格式 user:{userId}:agent:{agentId}:{rest} ---
  it("parses new format user:alice:agent:main:main", () => {
    expect(parseAgentSessionKey("user:alice:agent:main:main")).toEqual({
      agentId: "main",
      rest: "main",
    });
  });

  it("parses new format with subagent rest", () => {
    expect(parseAgentSessionKey("user:alice:agent:main:subagent:task1")).toEqual({
      agentId: "main",
      rest: "subagent:task1",
    });
  });

  it("parses new format with complex rest", () => {
    expect(parseAgentSessionKey("user:alice:agent:helper:dm:+15551234567")).toEqual({
      agentId: "helper",
      rest: "dm:+15551234567",
    });
  });

  it("parses new format with thread rest", () => {
    expect(parseAgentSessionKey("user:bob:agent:main:main:thread:t1")).toEqual({
      agentId: "main",
      rest: "main:thread:t1",
    });
  });

  // --- 边界情况 ---
  it("returns null for empty input", () => {
    expect(parseAgentSessionKey("")).toBeNull();
    expect(parseAgentSessionKey(null)).toBeNull();
    expect(parseAgentSessionKey(undefined)).toBeNull();
  });

  it("returns null for non-agent non-user keys", () => {
    expect(parseAgentSessionKey("global")).toBeNull();
    expect(parseAgentSessionKey("unknown")).toBeNull();
    expect(parseAgentSessionKey("some:random:key")).toBeNull();
  });

  it("returns null for user: prefix without agent segment", () => {
    expect(parseAgentSessionKey("user:alice:something:else")).toBeNull();
  });

  it("returns null for user: prefix with too few parts", () => {
    expect(parseAgentSessionKey("user:alice:agent:main")).toBeNull();
  });
});

describe("isSubagentSessionKey", () => {
  it("detects subagent in old format", () => {
    expect(isSubagentSessionKey("agent:main:subagent:task1")).toBe(true);
  });

  it("detects subagent in new format", () => {
    expect(isSubagentSessionKey("user:alice:agent:main:subagent:task1")).toBe(true);
  });

  it("returns false for non-subagent key", () => {
    expect(isSubagentSessionKey("agent:main:main")).toBe(false);
    expect(isSubagentSessionKey("user:alice:agent:main:main")).toBe(false);
  });
});

describe("isAcpSessionKey", () => {
  it("detects acp in old format", () => {
    expect(isAcpSessionKey("agent:main:acp:xxx")).toBe(true);
  });

  it("detects acp in new format", () => {
    expect(isAcpSessionKey("user:alice:agent:main:acp:xxx")).toBe(true);
  });

  it("returns false for non-acp key", () => {
    expect(isAcpSessionKey("agent:main:main")).toBe(false);
    expect(isAcpSessionKey("user:alice:agent:main:main")).toBe(false);
  });
});

describe("resolveThreadParentSessionKey", () => {
  it("resolves thread parent from old format", () => {
    expect(resolveThreadParentSessionKey("agent:main:main:thread:t1")).toBe("agent:main:main");
  });

  it("resolves thread parent from new format", () => {
    expect(resolveThreadParentSessionKey("user:alice:agent:main:main:thread:t1")).toBe(
      "user:alice:agent:main:main",
    );
  });

  it("returns null for non-thread key", () => {
    expect(resolveThreadParentSessionKey("agent:main:main")).toBeNull();
    expect(resolveThreadParentSessionKey("user:alice:agent:main:main")).toBeNull();
  });
});
