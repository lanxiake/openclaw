#!/bin/sh
ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
echo "ROOT=$ROOT"
node -e "
const path = require('path');
const { spawnSync } = require('child_process');

// Check oxfmt
const binName = process.platform === 'win32' ? 'oxfmt.cmd' : 'oxfmt';
const local = path.join('$ROOT', 'node_modules', '.bin', binName);
const fs = require('fs');
console.log('oxfmt local path:', local, 'exists:', fs.existsSync(local));

// Get staged files
const result = spawnSync('git', ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], { encoding: 'utf-8' });
const files = result.stdout.split('\0').filter(Boolean);
console.log('Total staged files:', files.length);
const tsFiles = files.filter(f => f.startsWith('src/') || f.startsWith('test/')).filter(f => ['.ts','.tsx','.js','.mjs','.cjs','.json','.jsonc','.jsx'].some(e => f.endsWith(e)));
console.log('Formattable files:', tsFiles.length);

if (tsFiles.length > 0) {
  const fmtResult = spawnSync(local, ['--write', ...tsFiles], { stdio: 'inherit' });
  console.log('oxfmt status:', fmtResult.status, 'error:', fmtResult.error?.message);
}
" 2>&1
echo "EXIT=$?"
