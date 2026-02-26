import { describe, expect, it } from "vitest";

import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it("detects help/version flags", () => {
    expect(hasHelpOrVersion(["node", "mtbot", "--help"])).toBe(true);
    expect(hasHelpOrVersion(["node", "mtbot", "-V"])).toBe(true);
    expect(hasHelpOrVersion(["node", "mtbot", "status"])).toBe(false);
  });

  it("extracts command path ignoring flags and terminator", () => {
    expect(getCommandPath(["node", "mtbot", "status", "--json"], 2)).toEqual(["status"]);
    expect(getCommandPath(["node", "mtbot", "agents", "list"], 2)).toEqual(["agents", "list"]);
    expect(getCommandPath(["node", "mtbot", "status", "--", "ignored"], 2)).toEqual(["status"]);
  });

  it("returns primary command", () => {
    expect(getPrimaryCommand(["node", "mtbot", "agents", "list"])).toBe("agents");
    expect(getPrimaryCommand(["node", "mtbot"])).toBeNull();
  });

  it("parses boolean flags and ignores terminator", () => {
    expect(hasFlag(["node", "mtbot", "status", "--json"], "--json")).toBe(true);
    expect(hasFlag(["node", "mtbot", "--", "--json"], "--json")).toBe(false);
  });

  it("extracts flag values with equals and missing values", () => {
    expect(getFlagValue(["node", "mtbot", "status", "--timeout", "5000"], "--timeout")).toBe(
      "5000",
    );
    expect(getFlagValue(["node", "mtbot", "status", "--timeout=2500"], "--timeout")).toBe(
      "2500",
    );
    expect(getFlagValue(["node", "mtbot", "status", "--timeout"], "--timeout")).toBeNull();
    expect(getFlagValue(["node", "mtbot", "status", "--timeout", "--json"], "--timeout")).toBe(
      null,
    );
    expect(getFlagValue(["node", "mtbot", "--", "--timeout=99"], "--timeout")).toBeUndefined();
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "mtbot", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "mtbot", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "mtbot", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it("parses positive integer flag values", () => {
    expect(getPositiveIntFlagValue(["node", "mtbot", "status"], "--timeout")).toBeUndefined();
    expect(
      getPositiveIntFlagValue(["node", "mtbot", "status", "--timeout"], "--timeout"),
    ).toBeNull();
    expect(
      getPositiveIntFlagValue(["node", "mtbot", "status", "--timeout", "5000"], "--timeout"),
    ).toBe(5000);
    expect(
      getPositiveIntFlagValue(["node", "mtbot", "status", "--timeout", "nope"], "--timeout"),
    ).toBeUndefined();
  });

  it("builds parse argv from raw args", () => {
    const nodeArgv = buildParseArgv({
      programName: "mtbot",
      rawArgs: ["node", "mtbot", "status"],
    });
    expect(nodeArgv).toEqual(["node", "mtbot", "status"]);

    const versionedNodeArgv = buildParseArgv({
      programName: "mtbot",
      rawArgs: ["node-22", "mtbot", "status"],
    });
    expect(versionedNodeArgv).toEqual(["node-22", "mtbot", "status"]);

    const versionedNodeWindowsArgv = buildParseArgv({
      programName: "mtbot",
      rawArgs: ["node-22.2.0.exe", "mtbot", "status"],
    });
    expect(versionedNodeWindowsArgv).toEqual(["node-22.2.0.exe", "mtbot", "status"]);

    const versionedNodePatchlessArgv = buildParseArgv({
      programName: "mtbot",
      rawArgs: ["node-22.2", "mtbot", "status"],
    });
    expect(versionedNodePatchlessArgv).toEqual(["node-22.2", "mtbot", "status"]);

    const versionedNodeWindowsPatchlessArgv = buildParseArgv({
      programName: "mtbot",
      rawArgs: ["node-22.2.exe", "mtbot", "status"],
    });
    expect(versionedNodeWindowsPatchlessArgv).toEqual(["node-22.2.exe", "mtbot", "status"]);

    const versionedNodeWithPathArgv = buildParseArgv({
      programName: "mtbot",
      rawArgs: ["/usr/bin/node-22.2.0", "mtbot", "status"],
    });
    expect(versionedNodeWithPathArgv).toEqual(["/usr/bin/node-22.2.0", "mtbot", "status"]);

    const nodejsArgv = buildParseArgv({
      programName: "mtbot",
      rawArgs: ["nodejs", "mtbot", "status"],
    });
    expect(nodejsArgv).toEqual(["nodejs", "mtbot", "status"]);

    const nonVersionedNodeArgv = buildParseArgv({
      programName: "mtbot",
      rawArgs: ["node-dev", "mtbot", "status"],
    });
    expect(nonVersionedNodeArgv).toEqual(["node", "mtbot", "node-dev", "mtbot", "status"]);

    const directArgv = buildParseArgv({
      programName: "mtbot",
      rawArgs: ["mtbot", "status"],
    });
    expect(directArgv).toEqual(["node", "mtbot", "status"]);

    const bunArgv = buildParseArgv({
      programName: "mtbot",
      rawArgs: ["bun", "src/entry.ts", "status"],
    });
    expect(bunArgv).toEqual(["bun", "src/entry.ts", "status"]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "mtbot",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "mtbot", "status"]);
  });

  it("decides when to migrate state", () => {
    expect(shouldMigrateState(["node", "mtbot", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "mtbot", "health"])).toBe(false);
    expect(shouldMigrateState(["node", "mtbot", "sessions"])).toBe(false);
    expect(shouldMigrateState(["node", "mtbot", "memory", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "mtbot", "agent", "--message", "hi"])).toBe(false);
    expect(shouldMigrateState(["node", "mtbot", "agents", "list"])).toBe(true);
    expect(shouldMigrateState(["node", "mtbot", "message", "send"])).toBe(true);
  });

  it("reuses command path for migrate state decisions", () => {
    expect(shouldMigrateStateFromPath(["status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["agents", "list"])).toBe(true);
  });
});
