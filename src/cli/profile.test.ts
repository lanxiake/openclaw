import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "mtbot",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "mtbot", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "mtbot", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "mtbot", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "mtbot", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "mtbot", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "mtbot", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (dev first)", () => {
    const res = parseCliProfileArgs(["node", "mtbot", "--dev", "--profile", "work", "status"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (profile first)", () => {
    const res = parseCliProfileArgs(["node", "mtbot", "--profile", "work", "--dev", "status"]);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join("/home/peter", ".mtbot-dev");
    expect(env.MTBOT_PROFILE).toBe("dev");
    expect(env.MTBOT_STATE_DIR).toBe(expectedStateDir);
    expect(env.MTBOT_CONFIG_PATH).toBe(path.join(expectedStateDir, "mtbot.json"));
    expect(env.MTBOT_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      MTBOT_STATE_DIR: "/custom",
      MTBOT_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.MTBOT_STATE_DIR).toBe("/custom");
    expect(env.MTBOT_GATEWAY_PORT).toBe("19099");
    expect(env.MTBOT_CONFIG_PATH).toBe(path.join("/custom", "mtbot.json"));
  });
});

describe("formatCliCommand", () => {
  it("returns command unchanged when no profile is set", () => {
    expect(formatCliCommand("mtbot doctor --fix", {})).toBe("mtbot doctor --fix");
  });

  it("returns command unchanged when profile is default", () => {
    expect(formatCliCommand("mtbot doctor --fix", { MTBOT_PROFILE: "default" })).toBe(
      "mtbot doctor --fix",
    );
  });

  it("returns command unchanged when profile is Default (case-insensitive)", () => {
    expect(formatCliCommand("mtbot doctor --fix", { MTBOT_PROFILE: "Default" })).toBe(
      "mtbot doctor --fix",
    );
  });

  it("returns command unchanged when profile is invalid", () => {
    expect(formatCliCommand("mtbot doctor --fix", { MTBOT_PROFILE: "bad profile" })).toBe(
      "mtbot doctor --fix",
    );
  });

  it("returns command unchanged when --profile is already present", () => {
    expect(
      formatCliCommand("mtbot --profile work doctor --fix", { MTBOT_PROFILE: "work" }),
    ).toBe("mtbot --profile work doctor --fix");
  });

  it("returns command unchanged when --dev is already present", () => {
    expect(formatCliCommand("mtbot --dev doctor", { MTBOT_PROFILE: "dev" })).toBe(
      "mtbot --dev doctor",
    );
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("mtbot doctor --fix", { MTBOT_PROFILE: "work" })).toBe(
      "mtbot --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("mtbot doctor --fix", { MTBOT_PROFILE: "  jbmtbot  " })).toBe(
      "mtbot --profile jbmtbot doctor --fix",
    );
  });

  it("handles command with no args after mtbot", () => {
    expect(formatCliCommand("mtbot", { MTBOT_PROFILE: "test" })).toBe(
      "mtbot --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm mtbot doctor", { MTBOT_PROFILE: "work" })).toBe(
      "pnpm mtbot --profile work doctor",
    );
  });
});
