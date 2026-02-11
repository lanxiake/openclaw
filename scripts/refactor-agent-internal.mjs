/**
 * Move files from src/agent/ root into a subdirectory of src/agent/.
 * Usage: node scripts/refactor-agent-internal.mjs <subdir> <pattern1> [pattern2] ...
 * Patterns: exact filenames or prefixes with * (e.g. "sandbox*", "model-auth.ts")
 *
 * Handles:
 * 1. git mv files from src/agent/<file> to src/agent/<subdir>/<file>
 * 2. Update imports INSIDE moved files (depth changed)
 * 3. Update external references TO moved files
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SRC = "src";
const AGENT = "agent";

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

function posix(p) {
  return p.replace(/\\/g, "/");
}

function main() {
  const [subdir, ...patterns] = process.argv.slice(2);
  if (!subdir || patterns.length === 0) {
    console.error("Usage: node refactor-agent-internal.mjs <subdir> <pattern1> ...");
    process.exit(1);
  }

  const agentRoot = posix(path.join(SRC, AGENT));
  const targetDir = posix(path.join(agentRoot, subdir));
  fs.mkdirSync(targetDir, { recursive: true });

  // Collect files to move (only from agent/ root, not subdirs)
  const rootFiles = fs.readdirSync(agentRoot, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);

  const toMove = new Set();
  for (const pat of patterns) {
    if (pat.endsWith("*")) {
      const pfx = pat.slice(0, -1);
      rootFiles.filter((f) => f.startsWith(pfx)).forEach((f) => toMove.add(f));
    } else {
      rootFiles.filter((f) => f === pat || f.startsWith(pat + ".")).forEach((f) => toMove.add(f));
    }
  }
  const files = [...toMove].sort();
  if (files.length === 0) {
    console.log("No files matched.");
    return;
  }
  console.log(`Moving ${files.length} files to ${AGENT}/${subdir}/`);

  // git mv
  for (const f of files) {
    try {
      execSync(`git mv "${agentRoot}/${f}" "${targetDir}/${f}"`, { stdio: "pipe" });
    } catch (e) {
      console.error(`  SKIP ${f}: ${e.stderr?.toString().trim()}`);
    }
  }

  // Build a map: old posix path (no ext) -> new posix path (no ext)
  // e.g. "src/agent/sandbox" -> "src/agent/sandbox/sandbox"
  const moveMap = new Map();
  for (const f of files) {
    const base = f.replace(/\.(ts|tsx|json)$/, "");
    moveMap.set(`${agentRoot}/${base}`, `${targetDir}/${base}`);
  }

  // Also map with .js extension for resolution
  const moveMapJs = new Map();
  for (const f of files) {
    const base = f.replace(/\.(ts|tsx)$/, ".js");
    moveMapJs.set(`${agentRoot}/${base}`, `${targetDir}/${base}`);
  }

  const allFiles = walk(SRC);
  const importRe = /(from\s+["'])([^"']+)(["'])|(\bimport\(["'])([^"']+)(["']\))/g;
  let totalUpdated = 0;

  for (const filePath of allFiles) {
    if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) continue;
    const fp = posix(filePath);
    const dir = path.posix.dirname(fp);
    const content = fs.readFileSync(filePath, "utf-8");
    let changed = false;

    const newContent = content.replace(importRe, (...m) => {
      const full = m[0];
      const prefix = m[1] || m[4];
      const importPath = m[2] || m[5];
      const suffix = m[3] || m[6];
      if (!importPath.startsWith(".")) return full;

      // Resolve import to posix abs path
      const resolved = path.posix.normalize(path.posix.join(dir, importPath));

      // Where does this file ACTUALLY live now?
      // If the current file was moved, its 'dir' is already the new location (targetDir)
      // because we did git mv before this pass.

      // Check if the import target was moved
      const resolvedNoExt = resolved.replace(/\.js$/, "");
      let newTarget = null;
      if (moveMap.has(resolvedNoExt)) {
        // The import target was moved
        newTarget = moveMapJs.get(resolved) || moveMap.get(resolvedNoExt) + ".js";
      }

      if (newTarget) {
        // Recompute relative path from current file's dir to new target
        const rel = path.posix.relative(dir, path.posix.dirname(newTarget));
        const base = path.posix.basename(importPath);
        let newPath = (rel || ".") + "/" + base;
        if (!newPath.startsWith(".")) newPath = "./" + newPath;
        if (newPath !== importPath) {
          changed = true;
          return prefix + newPath + suffix;
        }
      }

      return full;
    });

    // For moved files: also fix imports to non-moved targets
    // The file was moved from agent/ to agent/<subdir>/, so all relative paths
    // to things outside the subdir need adjustment.
    const basename = path.posix.basename(fp);
    if (files.includes(basename) && fp.startsWith(targetDir + "/")) {
      // This is a moved file. Re-resolve all its imports from OLD location.
      const oldDir = agentRoot;
      const newDir = targetDir;
      let content2 = changed ? newContent : content;
      let changed2 = false;

      const result = content2.replace(importRe, (...m) => {
        const full = m[0];
        const prefix = m[1] || m[4];
        const importPath = m[2] || m[5];
        const suffix = m[3] || m[6];
        if (!importPath.startsWith(".")) return full;

        // Resolve from NEW dir (current location)
        const resolvedFromNew = path.posix.normalize(path.posix.join(newDir, importPath));
        // Check if target was also moved - if so, it's already correct
        const resolvedNoExt = resolvedFromNew.replace(/\.js$/, "");
        if (moveMap.has(resolvedNoExt)) return full;

        // Resolve what the import SHOULD point to (from old location)
        const resolvedFromOld = path.posix.normalize(path.posix.join(oldDir, importPath));

        // Compute new relative path from new dir to old target
        const rel = path.posix.relative(newDir, path.posix.dirname(resolvedFromOld));
        const base = path.posix.basename(importPath);
        let newPath = (rel || ".") + "/" + base;
        if (!newPath.startsWith(".")) newPath = "./" + newPath;
        if (newPath !== importPath) {
          changed2 = true;
          return prefix + newPath + suffix;
        }
        return full;
      });

      if (changed2) {
        fs.writeFileSync(filePath, result);
        totalUpdated++;
        continue;
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, newContent);
      totalUpdated++;
    }
  }

  console.log(`Done. Updated ${totalUpdated} files.`);
}

main();
