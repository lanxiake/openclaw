/**
 * Fix broken import paths after internal reorganization of src/agent/.
 * Scans all .ts files, finds imports that resolve to non-existing files,
 * then searches for the actual file location and repairs the import path.
 */

import fs from "node:fs";
import path from "node:path";

const SRC = "src";

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

function posix(p) {
  return p.replace(/\\/g, "/");
}

// Build a map of all .ts/.tsx files: basename (without ext) -> full posix path
function buildFileIndex(rootDir) {
  const index = new Map();
  const allFiles = walk(rootDir);
  for (const f of allFiles) {
    const fp = posix(f);
    const base = path.posix.basename(fp).replace(/\.(ts|tsx)$/, "");
    if (!index.has(base)) {
      index.set(base, []);
    }
    index.get(base).push(fp);
  }
  // Also index .json files
  for (const e of walkAll(rootDir)) {
    if (e.endsWith(".json")) {
      const fp = posix(e);
      const base = path.posix.basename(fp).replace(/\.json$/, "");
      if (!index.has(base)) index.set(base, []);
      index.get(base).push(fp);
    }
  }
  return index;
}

function walkAll(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkAll(p));
    else out.push(p);
  }
  return out;
}

function fileExists(resolved) {
  // resolved is like "src/agent/auth-profiles.js"
  // Check for .ts, .tsx, .js, and the exact path
  const tsPath = resolved.replace(/\.js$/, ".ts");
  const tsxPath = resolved.replace(/\.js$/, ".tsx");
  const indexTs = resolved.replace(/\.js$/, "") + "/index.ts";
  return (
    fs.existsSync(tsPath) ||
    fs.existsSync(tsxPath) ||
    fs.existsSync(resolved) ||
    fs.existsSync(indexTs)
  );
}

function main() {
  const fileIndex = buildFileIndex(SRC);
  const allTsFiles = walk(SRC);
  const importRe = /(from\s+["'])([^"']+)(["'])|(\bimport\(["'])([^"']+)(["']\))/g;
  let totalFixed = 0;
  let totalFiles = 0;

  for (const filePath of allTsFiles) {
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

      const resolved = path.posix.normalize(path.posix.join(dir, importPath));
      if (fileExists(resolved)) return full;

      // Import is broken. Try to find the actual file.
      const basename = path.posix.basename(importPath).replace(/\.js$/, "");
      const candidates = fileIndex.get(basename) || [];

      if (candidates.length === 0) {
        // Maybe it's a directory import (index.ts)?
        return full;
      }

      // Find the best candidate - prefer files in the same general area
      let best = null;
      let bestScore = -1;

      for (const cand of candidates) {
        // Score: how many path segments match from the root
        const candParts = cand.split("/");
        const resolvedParts = resolved.replace(/\.js$/, ".ts").split("/");
        let score = 0;
        for (let i = 0; i < Math.min(candParts.length, resolvedParts.length); i++) {
          if (candParts[i] === resolvedParts[i]) score++;
          else break;
        }
        // Bonus for being in agent/ area if the original was too
        if (cand.startsWith("src/agent/") && resolved.startsWith("src/agent/")) {
          score += 10;
        }
        if (score > bestScore) {
          bestScore = score;
          best = cand;
        }
      }

      if (!best) return full;

      // Compute new relative path
      const bestDir = path.posix.dirname(best);
      const rel = path.posix.relative(dir, bestDir);
      const ext = importPath.endsWith(".json") ? ".json" : ".js";
      let newImportPath = (rel || ".") + "/" + basename + ext;
      if (!newImportPath.startsWith(".")) {
        newImportPath = "./" + newImportPath;
      }

      if (newImportPath !== importPath) {
        changed = true;
        totalFixed++;
        return prefix + newImportPath + suffix;
      }
      return full;
    });

    if (changed) {
      fs.writeFileSync(filePath, newContent);
      totalFiles++;
    }
  }

  console.log(`Fixed ${totalFixed} broken imports in ${totalFiles} files.`);
}

main();
