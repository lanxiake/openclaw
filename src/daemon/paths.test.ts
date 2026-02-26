import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveGatewayStateDir } from "./paths.js";

describe("resolveGatewayStateDir", () => {
  it("uses the default state dir when no overrides are set", () => {
    const env = { HOME: "/Users/test" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".mtbot"));
  });

  it("appends the profile suffix when set", () => {
    const env = { HOME: "/Users/test", MTBOT_PROFILE: "rescue" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".mtbot-rescue"));
  });

  it("treats default profiles as the base state dir", () => {
    const env = { HOME: "/Users/test", MTBOT_PROFILE: "Default" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".mtbot"));
  });

  it("uses MTBOT_STATE_DIR when provided", () => {
    const env = { HOME: "/Users/test", MTBOT_STATE_DIR: "/var/lib/mtbot" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/mtbot"));
  });

  it("expands ~ in MTBOT_STATE_DIR", () => {
    const env = { HOME: "/Users/test", MTBOT_STATE_DIR: "~/mtbot-state" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/Users/test/mtbot-state"));
  });

  it("preserves Windows absolute paths without HOME", () => {
    const env = { MTBOT_STATE_DIR: "C:\\State\\mtbot" };
    expect(resolveGatewayStateDir(env)).toBe("C:\\State\\mtbot");
  });
});
