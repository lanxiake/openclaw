import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const hashFile = path.join(rootDir, "src/canvas-host/a2ui/.bundle.hash");
const outputFile = path.join(rootDir, "src/canvas-host/a2ui/a2ui.bundle.js");
const a2uiRendererDir = path.join(rootDir, "vendor/a2ui/renderers/lit");
const a2uiAppDir = path.join(rootDir, "apps/shared/MtBotKit/Tools/CanvasA2UI");
const inputPaths = [
  path.join(rootDir, "package.json"),
  path.join(rootDir, "pnpm-lock.yaml"),
  a2uiRendererDir,
  a2uiAppDir,
];

/**
 * Normalize path separators to ensure cross-platform hash stability.
 */
function normalizePath(inputPath: string): string {
  return inputPath.split(path.sep).join("/");
}

/**
 * Recursively collects file paths for a deterministic hash input list.
 */
async function collectFiles(entryPath: string): Promise<string[]> {
  const entryStat = await stat(entryPath);
  if (!entryStat.isDirectory()) {
    return [entryPath];
  }

  const entries = await readdir(entryPath);
  const files: string[] = [];
  for (const entry of entries) {
    const childPath = path.join(entryPath, entry);
    files.push(...(await collectFiles(childPath)));
  }
  return files;
}

/**
 * Computes a content hash from all bundle inputs to support smart skip logic.
 */
async function computeBundleHash(): Promise<string> {
  const files: string[] = [];
  for (const inputPath of inputPaths) {
    files.push(...(await collectFiles(inputPath)));
  }

  files.sort((a, b) => normalizePath(a).localeCompare(normalizePath(b)));

  const hash = createHash("sha256");
  for (const filePath of files) {
    const relativePath = normalizePath(path.relative(rootDir, filePath));
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(filePath));
    hash.update("\0");
  }

  return hash.digest("hex");
}

/**
 * Runs a command synchronously and throws if it exits with a non-zero code.
 */
function runOrThrow(command: string, args: string[]): void {
  const result =
    process.platform === "win32"
      ? spawnSync([command, ...args].join(" "), {
          cwd: rootDir,
          stdio: "inherit",
          shell: true,
        })
      : spawnSync(command, args, {
          cwd: rootDir,
          stdio: "inherit",
          shell: false,
        });

  if ((result.status ?? 1) !== 0) {
    const errorCode = result.error && "code" in result.error ? String(result.error.code) : "none";
    throw new Error(
      `${command} ${args.join(" ")} failed with code ${result.status ?? "unknown"} (spawn error: ${errorCode})`,
    );
  }
}

/**
 * Main entry point for cross-platform A2UI bundle orchestration.
 */
async function main(): Promise<void> {
  if (!existsSync(a2uiRendererDir) || !existsSync(a2uiAppDir)) {
    console.log("A2UI sources missing; keeping prebuilt bundle.");
    return;
  }

  const currentHash = await computeBundleHash();
  if (existsSync(hashFile) && existsSync(outputFile)) {
    const previousHash = (await readFile(hashFile, "utf8")).trim();
    if (previousHash === currentHash) {
      console.log("A2UI bundle up to date; skipping.");
      return;
    }
  }

  runOrThrow("pnpm", ["-s", "exec", "tsc", "-p", path.join(a2uiRendererDir, "tsconfig.json")]);
  runOrThrow("pnpm", [
    "-s",
    "exec",
    "rolldown",
    "-c",
    path.join(a2uiAppDir, "rolldown.config.mjs"),
  ]);

  await mkdir(path.dirname(hashFile), { recursive: true });
  await writeFile(hashFile, `${currentHash}\n`, "utf8");
}

main().catch((error) => {
  console.error("A2UI bundling failed. Re-run with: pnpm canvas:a2ui:bundle");
  console.error("If this persists, verify pnpm deps and try again.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
