/**
 * package-portable.js
 *
 * 打包 Windows 便携版 EXE 的辅助脚本。
 * 解决 electron-builder 在 Windows 上解压 winCodeSign 时因 macOS 符号链接
 * 导致 7za.exe exit code 2 的问题。
 *
 * 使用方式: node scripts/package-portable.js
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const SEVEN_ZIP_DIR = path.resolve(__dirname, '..', '..', '..', 'node_modules', '.pnpm', '7zip-bin@5.2.0', 'node_modules', '7zip-bin', 'win', 'x64')
const ORIGINAL_7ZA = path.join(SEVEN_ZIP_DIR, '7za.exe')
const BACKUP_7ZA = path.join(SEVEN_ZIP_DIR, '7za-real.exe')
const WRAPPER_7ZA = path.join(__dirname, '7za-wrapper.exe')

/**
 * 安装 7za wrapper（将 exit code 2 转为 0）
 */
function installWrapper() {
  if (!fs.existsSync(WRAPPER_7ZA)) {
    console.log('[package] Compiling 7za wrapper...')
    const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'
    const csFile = path.join(__dirname, '7za-wrapper.cs')
    execSync(`"${cscPath}" /nologo /out:"${WRAPPER_7ZA}" /target:exe "${csFile}"`, { stdio: 'inherit' })
  }

  if (!fs.existsSync(BACKUP_7ZA)) {
    console.log('[package] Installing 7za wrapper (exit code 2 -> 0)...')
    fs.copyFileSync(ORIGINAL_7ZA, BACKUP_7ZA)
    fs.copyFileSync(WRAPPER_7ZA, ORIGINAL_7ZA)
    console.log('[package] 7za wrapper installed')
  } else {
    console.log('[package] 7za wrapper already installed')
  }
}

/**
 * 恢复原始 7za.exe
 */
function restoreOriginal() {
  if (fs.existsSync(BACKUP_7ZA)) {
    console.log('[package] Restoring original 7za.exe...')
    fs.copyFileSync(BACKUP_7ZA, ORIGINAL_7ZA)
    fs.unlinkSync(BACKUP_7ZA)
    console.log('[package] Original 7za.exe restored')
  }
}

/**
 * 运行 electron-builder 构建便携版
 */
function build() {
  console.log('[package] Building portable EXE...')
  const cwd = path.resolve(__dirname, '..')
  execSync('npx electron-builder --win portable --x64 --config electron-builder.json', {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    },
  })
}

/**
 * 主流程
 */
function main() {
  console.log('[package] === OpenClaw Windows Portable Packager ===')
  console.log('')

  try {
    installWrapper()
    build()

    // 验证产物
    const releaseDir = path.resolve(__dirname, '..', 'release')
    const files = fs.readdirSync(releaseDir).filter(f => f.endsWith('-portable.exe'))
    if (files.length > 0) {
      const filePath = path.join(releaseDir, files[0])
      const stat = fs.statSync(filePath)
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1)
      console.log('')
      console.log(`[package] ✓ Portable EXE: ${files[0]} (${sizeMB} MB)`)
      console.log(`[package] ✓ Location: ${filePath}`)
    }
  } finally {
    restoreOriginal()
  }

  console.log('')
  console.log('[package] Done!')
}

main()
