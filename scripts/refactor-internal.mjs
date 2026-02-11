/**
 * Generic version: Move individual files from a source dir into a subdirectory.
 * Usage: node scripts/refactor-internal.mjs <sourceDir> <subdir> <pattern1> [pattern2] ...
 * Example: node scripts/refactor-internal.mjs src/infra network/bonjour "bonjour*"
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SRC = "src";

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

function posix(p) { return p.replace(/\\/g, "/"); }

function fileExists(resolved) {
  const tsPath = resolved.replace(/\.js$/, ".ts");
  const tsxPath = resolved.replace(/\.js$/, ".tsx");
  const indexTs = resolved.replace(/\.js$/, "") + "/index.ts";
  return fs.existsSync(tsPath) || fs.existsSync(tsxPath) || fs.existsSync(resolved) || fs.existsSync(indexTs);
}

function main() {
  const [sourceDir, subdir, ...patterns] = process.argv.slice(2);
  if (!sourceDir || !subdir || patterns.length === 0) {
    console.error("Usage: node refactor-internal.mjs <sourceDir> <subdir> <pattern1> ...");
    process.exit(1);
  }

  const targetDir = posix(path.join(sourceDir, subdir));
  fs.mkdirSync(targetDir, { recursive: true });

  // Collect files to move (only from sourceDir root, not subdirs)
  const rootFiles = fs.readdirSync(sourceDir, { withFileTypes: true })
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
  if (files.length === 0) { console.log("No files matched."); return; }
  console.log(`Moving ${files.length} files to ${targetDir}/`);

  // git mv
  for (const f of files) {
    const src = posix(path.join(sourceDir, f));
    const dst = posix(path.join(targetDir, f));
    try { execSync(`git mv "${src}" "${dst}"`, { stdio: "pipe" }); }
    catch (e) { console.error(`  SKIP ${f}`); }
  }

  // Build map: old path (no ext) -> new path (no ext)
  const moveMap = new Map();
  for (const f of files) {
    const base = f.replace(/\.(ts|tsx|json)$/, "");
    moveMap.set(posix(path.join(sourceDir, base)), posix(path.join(targetDir, base)));
  }

  // Update imports in all .ts files
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

      const resolved = path.posix.normalize(path.posix.join(dir, importPath));
      const resolvedNoExt = resolved.replace(/\.(js|json)$/, "");

      if (moveMap.has(resolvedNoExt)) {
        const newTarget = moveMap.get(resolvedNoExt);
        const ext = importPath.endsWith(".json") ? ".json" : ".js";
        const base = path.posix.basename(newTarget);
        const newTargetDir = path.posix.dirname(newTarget + ext);
        const rel = path.posix.relative(dir, newTargetDir);
        let newPath = (rel || ".") + "/" + base + ext;
        if (!newPath.startsWith(".")) newPath = "./" + newPath;
        if (newPath !== importPath) {
          changed = true;
          return prefix + newPath + suffix;
        }
      }
      return full;
    });

    if (changed) {
      fs.writeFileSync(filePath, newContent);
      totalUpdated++;
    }
  }

  // Fix moved files' internal imports that now point to wrong depth
  for (const f of files) {
    if (!f.endsWith(".ts") && !f.endsWith(".tsx")) continue;
    const fp = posix(path.join(targetDir, f));
    if (!fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, "utf-8");
    const dir = path.posix.dirname(fp);
    const oldDir = posix(sourceDir);
    let changed = false;

    const newContent = content.replace(importRe, (...m) => {
      const full = m[0];
      const prefix = m[1] || m[4];
      const importPath = m[2] || m[5];
      const suffix = m[3] || m[6];
      if (!importPath.startsWith(".")) return full;

      // Check if import resolves to existing file from new location
      const resolvedNew = path.posix.normalize(path.posix.join(dir, importPath));
      if (fileExists(resolvedNew)) return full;

      // Try resolving from old location
      const resolvedOld = path.posix.normalize(path.posix.join(oldDir, importPath));
      if (fileExists(resolvedOld)) {
        const rel = path.posix.relative(dir, path.posix.dirname(resolvedOld));
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

    if (changed) {
      fs.writeFileSync(fp, newContent);
      totalUpdated++;
    }
  }

  console.log(`Done. Updated ${totalUpdated} files.`);
}

main();
