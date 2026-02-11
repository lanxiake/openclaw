import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const OXFMT_EXTENSIONS = new Set([".cjs", ".js", ".json", ".jsonc", ".jsx", ".mjs", ".ts", ".tsx"]);

function getRepoRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..");
}

function runGitCommand(args, options = {}) {
  return spawnSync("git", args, {
    cwd: options.cwd,
    encoding: "utf-8",
    stdio: options.stdio ?? "pipe",
  });
}

function splitNullDelimited(value) {
  if (!value) {
    return [];
  }
  const text = String(value);
  return text.split("\0").filter(Boolean);
}

function normalizeGitPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function filterOxfmtTargets(paths) {
  return paths
    .map(normalizeGitPath)
    .filter(
      (filePath) =>
        (filePath.startsWith("src/") || filePath.startsWith("test/")) &&
        OXFMT_EXTENSIONS.has(path.posix.extname(filePath)),
    );
}

function findPartiallyStagedFiles(stagedFiles, unstagedFiles) {
  const unstaged = new Set(unstagedFiles.map(normalizeGitPath));
  return stagedFiles.filter((filePath) => unstaged.has(normalizeGitPath(filePath)));
}

function filterOutPartialTargets(targets, partialTargets) {
  if (partialTargets.length === 0) {
    return targets;
  }
  const partial = new Set(partialTargets.map(normalizeGitPath));
  return targets.filter((filePath) => !partial.has(normalizeGitPath(filePath)));
}

function resolveOxfmtCommand(repoRoot) {
  // On Windows, .cmd wrappers can fail with EINVAL when spawned from Git's sh.
  // Resolve the actual node script instead.
  if (process.platform === "win32") {
    const scriptPath = path.join(repoRoot, "node_modules", ".pnpm", "oxfmt@0.27.0", "node_modules", "oxfmt", "bin", "oxfmt");
    if (fs.existsSync(scriptPath)) {
      return { command: process.execPath, args: [scriptPath, "--write"] };
    }
    // Fallback: try the generic pnpm path
    const genericScript = path.join(repoRoot, "node_modules", "oxfmt", "bin", "oxfmt");
    if (fs.existsSync(genericScript)) {
      return { command: process.execPath, args: [genericScript, "--write"] };
    }
  }
  const binName = process.platform === "win32" ? "oxfmt.cmd" : "oxfmt";
  const local = path.join(repoRoot, "node_modules", ".bin", binName);
  if (fs.existsSync(local)) {
    return { command: local, args: ["--write"] };
  }

  const result = spawnSync("oxfmt", ["--version"], { stdio: "ignore" });
  if (result.status === 0) {
    return { command: "oxfmt", args: ["--write"] };
  }

  return null;
}

function getGitPaths(args, repoRoot) {
  const result = runGitCommand(args, { cwd: repoRoot });
  if (result.status !== 0) {
    return [];
  }
  return splitNullDelimited(result.stdout ?? "");
}

function chunkArray(arr, maxCharsPerChunk) {
  const chunks = [];
  let current = [];
  let currentLen = 0;
  for (const item of arr) {
    if (current.length > 0 && currentLen + item.length + 1 > maxCharsPerChunk) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(item);
    currentLen += item.length + 1;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

function formatFiles(repoRoot, oxfmt, files) {
  // On Windows, .cmd wrappers run via cmd.exe which has ~8191 char limit.
  // Batch files to stay under that limit.
  const maxChars = process.platform === "win32" ? 6000 : 30000;
  const chunks = chunkArray(files, maxChars);
  for (const chunk of chunks) {
    const result = spawnSync(oxfmt.command, [...oxfmt.args, ...chunk], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      return false;
    }
  }
  return true;
}

function stageFiles(repoRoot, files) {
  if (files.length === 0) {
    return true;
  }
  const maxChars = process.platform === "win32" ? 6000 : 30000;
  const chunks = chunkArray(files, maxChars);
  for (const chunk of chunks) {
    const result = runGitCommand(["add", "--", ...chunk], { cwd: repoRoot, stdio: "inherit" });
    if (result.status !== 0) {
      return false;
    }
  }
  return true;
}

function main() {
  const repoRoot = getRepoRoot();
  const staged = getGitPaths(
    ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"],
    repoRoot,
  );
  const targets = filterOxfmtTargets(staged);
  if (targets.length === 0) {
    return;
  }

  const unstaged = getGitPaths(["diff", "--name-only", "-z"], repoRoot);
  const partial = findPartiallyStagedFiles(targets, unstaged);
  if (partial.length > 0) {
    process.stderr.write("[pre-commit] Skipping partially staged files:\n");
    for (const filePath of partial) {
      process.stderr.write(`- ${filePath}\n`);
    }
    process.stderr.write("Stage full files to format them automatically.\n");
  }

  const filteredTargets = filterOutPartialTargets(targets, partial);
  if (filteredTargets.length === 0) {
    return;
  }

  const oxfmt = resolveOxfmtCommand(repoRoot);
  if (!oxfmt) {
    process.stderr.write("[pre-commit] oxfmt not found; skipping format.\n");
    return;
  }

  if (!formatFiles(repoRoot, oxfmt, filteredTargets)) {
    process.exitCode = 1;
    return;
  }

  if (!stageFiles(repoRoot, filteredTargets)) {
    process.exitCode = 1;
  }
}

export {
  filterOxfmtTargets,
  filterOutPartialTargets,
  findPartiallyStagedFiles,
  getRepoRoot,
  normalizeGitPath,
  resolveOxfmtCommand,
  splitNullDelimited,
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
