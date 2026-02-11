#!/usr/bin/env node
/**
 * Refactoring helper: move a directory and update all import paths.
 *
 * Usage: node scripts/refactor-move.mjs <old-dir> <new-dir>
 *   e.g. node scripts/refactor-move.mjs src/memory src/services/memory
 *
 * What it does:
 *   1. git mv <old-dir> <new-dir>
 *   2. Scans all .ts/.tsx files under src/ for imports referencing the old path
 *   3. Rewrites those imports to use the new relative path
 *   4. Also updates imports inside the moved files themselves (since their
 *      location changed, their relative imports to OTHER modules may break)
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, "src");

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node scripts/refactor-move.mjs <old-dir> <new-dir>");
  process.exit(1);
}

const oldDir = path.resolve(ROOT, args[0]);
const newDir = path.resolve(ROOT, args[1]);
const oldRel = path.relative(SRC, oldDir).replace(/\\/g, "/");
const newRel = path.relative(SRC, newDir).replace(/\\/g, "/");

console.log(`Moving: ${oldRel} -> ${newRel}`);

// Step 1: Ensure parent of newDir exists
fs.mkdirSync(path.dirname(newDir), { recursive: true });

// Step 2: git mv
try {
  execSync(`git mv "${oldDir}" "${newDir}"`, { cwd: ROOT, stdio: "inherit" });
} catch {
  console.error("git mv failed, trying manual move...");
  fs.renameSync(oldDir, newDir);
  execSync(`git add "${newDir}"`, { cwd: ROOT, stdio: "inherit" });
}

// Step 3: Collect all .ts/.tsx files under src/
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

const allFiles = collectTsFiles(SRC);

// Helpers
function toForwardSlash(p) {
  return p.replace(/\\/g, "/");
}

function computeRelativeImport(fromFile, toFile) {
  const fromDir = path.dirname(fromFile);
  let rel = toForwardSlash(path.relative(fromDir, toFile));
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

// Build a mapping of old file paths -> new file paths (for moved files)
function listFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

const movedFiles = listFiles(newDir);
const oldToNewMap = new Map();
for (const f of movedFiles) {
  const relFromNew = path.relative(newDir, f);
  const oldPath = path.join(oldDir, relFromNew);
  oldToNewMap.set(toForwardSlash(oldPath), toForwardSlash(f));
}

// Step 4: Update imports in ALL ts files
// Match: from "..." or from '...' with relative paths containing old module name
const importRegex = /(from\s+["'])(\.\.?\/[^"']+)(["'])/g;
const dynamicImportRegex = /(import\s*\(\s*["'])(\.\.?\/[^"']+)(["']\s*\))/g;

let totalUpdates = 0;

for (const file of allFiles) {
  const content = fs.readFileSync(file, "utf-8");
  let newContent = content;
  const fileDir = path.dirname(file);

  const replaceImport = (match, prefix, importPath, suffix) => {
    // Resolve the absolute path this import points to
    // importPath might end with .js, .ts, or have no extension
    let resolved = path.resolve(fileDir, importPath);
    let resolvedStr = toForwardSlash(resolved);

    // Check if this import points to something in the old directory
    const oldDirStr = toForwardSlash(oldDir);
    const newDirStr = toForwardSlash(newDir);

    // Case 1: Import points to a file that was in oldDir (now in newDir)
    if (resolvedStr.startsWith(oldDirStr + "/") || resolvedStr === oldDirStr) {
      const newResolved = resolvedStr.replace(oldDirStr, newDirStr);
      const newImportPath = computeRelativeImport(file, newResolved);
      totalUpdates++;
      return prefix + newImportPath + suffix;
    }

    // Case 2: This file is inside newDir, and its relative imports to OUTSIDE
    // modules may have changed (because the file moved)
    // This is handled inherently because the file is now at a different location,
    // but relative paths to unchanged modules are still valid IF the depth changed.
    // Actually, since we moved the whole directory, internal imports stay the same,
    // and external imports only break if the depth to src root changed.
    const fileStr = toForwardSlash(file);
    if (fileStr.startsWith(newDirStr + "/")) {
      // This file was moved. Check if the import resolves to something outside newDir
      if (!resolvedStr.startsWith(newDirStr + "/")) {
        // The import points outside the moved directory.
        // We need to recalculate the relative path from the NEW location
        // to the actual target (which hasn't moved).
        //
        // The old file location was: oldDir + relativeWithinDir
        const relWithin = toForwardSlash(path.relative(newDir, file));
        const oldFile = path.join(oldDir, relWithin);
        const oldFileDir = path.dirname(oldFile);
        const originalTarget = path.resolve(oldFileDir, importPath);
        const originalTargetStr = toForwardSlash(originalTarget);

        // Skip if original target was also in old dir (already handled above)
        if (originalTargetStr.startsWith(oldDirStr + "/")) {
          return match;
        }

        // Recalculate relative path from new location to original target
        const correctedImport = computeRelativeImport(file, originalTarget);
        if (correctedImport !== importPath) {
          totalUpdates++;
          return prefix + correctedImport + suffix;
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

console.log(`Done. Updated ${totalUpdates} import references.`);
