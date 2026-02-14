const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * 清理构建目录和终止相关进程
 */
function cleanBuild() {
  console.log('🧹 清理构建环境...\n')

  // 1. 终止所有 Electron 和 OpenClaw 进程
  console.log('[1/4] 终止相关进程...')
  try {
    // 终止 OpenClaw Assistant.exe
    execSync('taskkill /F /IM "OpenClaw Assistant.exe" 2>nul', { stdio: 'ignore' })
    console.log('  ✓ 已终止 OpenClaw Assistant.exe')
  } catch (e) {
    // 进程不存在，忽略
  }

  try {
    // 终止所有 electron.exe
    execSync('taskkill /F /IM electron.exe 2>nul', { stdio: 'ignore' })
    console.log('  ✓ 已终止 electron.exe')
  } catch (e) {
    // 进程不存在，忽略
  }

  try {
    // 终止 rcedit 相关进程
    execSync('taskkill /F /IM rcedit-x64.exe 2>nul', { stdio: 'ignore' })
    console.log('  ✓ 已终止 rcedit-x64.exe')
  } catch (e) {
    // 进程不存在，忽略
  }

  // 等待进程完全终止
  console.log('  ⏳ 等待进程完全终止...')
  try {
    execSync('timeout /t 2 /nobreak >nul 2>&1', { stdio: 'ignore' })
  } catch (e) {
    // 忽略
  }
  console.log('  ✓ 进程清理完成\n')

  // 2. 清理输出目录
  console.log('[2/4] 清理输出目录...')
  const releaseDir = path.join(__dirname, '..', 'release')
  if (fs.existsSync(releaseDir)) {
    try {
      fs.rmSync(releaseDir, { recursive: true, force: true })
      console.log(`  ✓ 已删除 ${releaseDir}`)
    } catch (e) {
      console.error(`  ✗ 删除失败: ${e.message}`)
      console.log('  提示: 可能需要以管理员权限运行')
      process.exit(1)
    }
  } else {
    console.log('  ℹ 输出目录不存在，跳过')
  }
  console.log()

  // 3. 清理构建缓存
  console.log('[3/4] 清理构建缓存...')
  const outDir = path.join(__dirname, '..', 'out')
  if (fs.existsSync(outDir)) {
    try {
      fs.rmSync(outDir, { recursive: true, force: true })
      console.log(`  ✓ 已删除 ${outDir}`)
    } catch (e) {
      console.error(`  ✗ 删除失败: ${e.message}`)
    }
  } else {
    console.log('  ℹ 构建缓存不存在，跳过')
  }
  console.log()

  // 4. 清理 electron-builder 缓存（可选）
  console.log('[4/4] 清理 electron-builder 缓存...')
  const userCacheDir = path.join(
    process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local'),
    'electron-builder',
    'Cache'
  )
  
  if (fs.existsSync(userCacheDir)) {
    console.log(`  📍 缓存位置: ${userCacheDir}`)
    console.log('  ℹ 如需完全清理，请手动删除此目录')
  }
  console.log()

  console.log('✅ 清理完成！\n')
}

// 如果直接运行此脚本
if (require.main === module) {
  cleanBuild()
}

module.exports = { cleanBuild }
