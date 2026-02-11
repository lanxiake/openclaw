#!/usr/bin/env node
/**
 * Update imports after moving channels/* -> channels/core/*
 * This handles the case where files moved to a subdirectory within the same parent.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, "src");

function toForwardSlash(p) {
  return p.replace(/\\/g, "/");
}

function collectTsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      results.push(...collectTsFiles(full));
    } else if (/\.(ts|tsx|mts|cts)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// Files that WERE in channels/ and are NOW in channels/core/
const coreDir = path.join(SRC, "channels", "core");
const coreFiles = new Set();

function listAllFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listAllFiles(full);
    } else {
      coreFiles.add(toForwardSlash(full));
    }
  }
}
listAllFiles(coreDir);

// Map: old channels/X path -> new channels/core/X path
// E.g., channels/dock.ts -> channels/core/dock.ts
//        channels/plugins/index.ts -> channels/core/plugins/index.ts
const oldChannelsDir = toForwardSlash(path.join(SRC, "channels"));

const allFiles = collectTsFiles(SRC);
const importRegex = /(from\s+["'])(\.\.?\/[^"']+)(["'])/g;
const dynamicImportRegex = /(import\s*\(\s*["'])(\.\.?\/[^"']+)(["']\s*\))/g;

let totalUpdates = 0;

for (const file of allFiles) {
  const content = fs.readFileSync(file, "utf-8");
  let newContent = content;
  const fileDir = path.dirname(file);
  const fileStr = toForwardSlash(file);
  const isInCore = fileStr.startsWith(toForwardSlash(coreDir) + "/");

  const replaceImport = (match, prefix, importPath, suffix) => {
    const resolved = path.resolve(fileDir, importPath);
    const resolvedStr = toForwardSlash(resolved);

    if (isInCore) {
      // This file is in channels/core/. Its relative imports to things that WERE
      // in channels/ (now also in channels/core/) should still work since they moved together.
      // But imports to things OUTSIDE channels may be wrong because depth increased by 1.
      // The old file was at channels/X, now it's at channels/core/X
      const relInCore = toForwardSlash(path.relative(coreDir, file));
      const oldFilePath = path.join(SRC, "channels", relInCore);
      const oldFileDir = path.dirname(oldFilePath);
      const originalTarget = path.resolve(oldFileDir, importPath);
      const originalTargetStr = toForwardSlash(originalTarget);

      // Check if original target was also in channels/ (i.e., now in channels/core/)
      const wasInChannelsRoot = originalTargetStr.startsWith(oldChannelsDir + "/");
      if (wasInChannelsRoot) {
        // Check if original target is NOT something that stayed at channels level
        // (like a future channels/telegram/ etc.) - at this point only core/ exists
        const relFromChannels = originalTargetStr.substring(oldChannelsDir.length + 1);
        // If the target resolves to a file now in core/, the import is fine (same relative path)
        // But let's verify - resolve using NEW location
        const newResolved = path.resolve(fileDir, importPath);
        const newResolvedStr = toForwardSlash(newResolved);
        if (
          coreFiles.has(newResolvedStr) ||
          coreFiles.has(newResolvedStr + ".ts") ||
          coreFiles.has(newResolvedStr + ".js")
        ) {
          return match; // Still valid
        }
        // Check if it resolves correctly by looking for the .js -> actual .ts mapping
        const withoutExt = newResolvedStr.replace(/\.js$/, ".ts");
        if (coreFiles.has(withoutExt)) {
          return match; // Still valid
        }
      }

      // For imports pointing outside channels/, recalculate
      if (
        !originalTargetStr.startsWith(oldChannelsDir + "/") ||
        !resolvedStr.startsWith(toForwardSlash(coreDir) + "/")
      ) {
        const correctedImport = toForwardSlash(path.relative(fileDir, originalTarget));
        const correctedPath = correctedImport.startsWith(".")
          ? correctedImport
          : "./" + correctedImport;
        if (correctedPath !== importPath) {
          totalUpdates++;
          return prefix + correctedPath + suffix;
        }
      }
    } else {
      // This file is NOT in channels/core/. Check if its import pointed to
      // something that was in channels/ (now in channels/core/)
      // old: from "../channels/dock.js"
      // new: from "../channels/core/dock.js"

      // Check if resolved path matches something that used to be directly in channels/
      // The resolved path currently points to channels/X (old location, file doesn't exist there)
      // We need to check if channels/core/X exists instead
      if (resolvedStr.startsWith(oldChannelsDir + "/")) {
        const relFromChannels = resolvedStr.substring(oldChannelsDir.length + 1);
        // Skip if already pointing to core/
        if (relFromChannels.startsWith("core/")) {
          return match;
        }
        // Check if this should now be channels/core/X
        const newTarget = path.join(coreDir, relFromChannels);
        const newTargetStr = toForwardSlash(newTarget);
        const newTargetTs = newTargetStr.replace(/\.js$/, ".ts");
        if (
          coreFiles.has(newTargetStr) ||
          coreFiles.has(newTargetTs) ||
          fs.existsSync(newTarget) ||
          fs.existsSync(newTargetTs)
        ) {
          const newImportPath = toForwardSlash(path.relative(fileDir, newTarget));
          const finalPath = newImportPath.startsWith(".") ? newImportPath : "./" + newImportPath;
          if (finalPath !== importPath) {
            totalUpdates++;
            return prefix + finalPath + suffix;
          }
        }
        // Also check if it's a directory with index
        const asDir = path.join(coreDir, relFromChannels.replace(/\.js$/, ""));
        if (fs.existsSync(asDir) && fs.statSync(asDir).isDirectory()) {
          const indexPath = path.join(asDir, "index.ts");
          if (fs.existsSync(indexPath)) {
            // Rewrite to point to core/
            const newTarget2 = path.join(coreDir, relFromChannels);
            const newImportPath = toForwardSlash(path.relative(fileDir, newTarget2));
            const finalPath = newImportPath.startsWith(".") ? newImportPath : "./" + newImportPath;
            if (finalPath !== importPath) {
              totalUpdates++;
              return prefix + finalPath + suffix;
            }
          }
        }
      }
    }

    return match;
  };

  newContent = newContent.replace(importRegex, replaceImport);
  newContent = newContent.replace(dynamicImportRegex, replaceImport);

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, "utf-8");
  }
}

console.log(`Done. Updated ${totalUpdates} import references for channels -> channels/core.`);
