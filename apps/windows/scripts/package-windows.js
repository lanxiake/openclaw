const { execSync } = require('child_process')
const path = require('path')
const { cleanBuild } = require('./clean-build')

/**
 * 完整的打包流程：清理 -> 构建 -> 打包
 */
async function packageWindows() {
  console.log('📦 OpenClaw Windows 打包工具\n')
  console.log('=' .repeat(60) + '\n')

  try {
    // 步骤 1: 清理环境
    console.log('【步骤 1/3】清理构建环境')
    console.log('-'.repeat(60))
    cleanBuild()
    
    // 额外等待，确保文件系统释放
    console.log('\n  ⏳ 等待文件系统完全释放...')
    try {
      execSync('timeout /t 3 /nobreak >nul 2>&1', { stdio: 'ignore' })
    } catch (e) {
      // 忽略
    }
    console.log('  ✓ 准备就绪\n')

    // 步骤 2: 构建项目
    console.log('【步骤 2/3】构建项目')
    console.log('-'.repeat(60))
    console.log('正在编译 TypeScript 代码...\n')
    
    const cwd = path.resolve(__dirname, '..')
    execSync('pnpm build', {
      cwd,
      stdio: 'inherit'
    })
    
    console.log('\n✅ 构建完成\n')

    // 步骤 3: 打包应用
    console.log('【步骤 3/3】打包应用')
    console.log('-'.repeat(60))
    console.log('正在使用 electron-builder 打包...\n')
    console.log('提示: 此过程可能需要 3-5 分钟\n')

    // 清理 rcedit 缓存
    const rceditCache = path.join(
      process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local'),
      'electron-builder',
      'Cache',
      'winCodeSign'
    )
    console.log('  ℹ 清理 rcedit 缓存...\n')
    try {
      const fs = require('fs')
      if (fs.existsSync(rceditCache)) {
        fs.rmSync(rceditCache, { recursive: true, force: true })
        console.log('  ✓ 已清理 rcedit 缓存\n')
      }
    } catch (e) {
      console.log('  ⚠ 清理缓存失败（非致命）\n')
    }

    execSync('pnpm exec electron-builder --win --config electron-builder.json', {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        // 禁用代码签名（开发阶段）
        CSC_IDENTITY_AUTO_DISCOVERY: 'false',
        // 禁用发布检查
        ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'true'
      }
    })

    console.log('\n' + '='.repeat(60))
    console.log('✅ 打包成功！')
    console.log('='.repeat(60))
    console.log('\n📍 输出目录:')
    console.log(`   ${path.join(cwd, 'release')}\n`)
    console.log('📦 生成的文件:')
    console.log('   • NSIS 安装包 (x64/ia32)')
    console.log('   • 便携版 (x64)')
    console.log('   • ZIP 压缩包 (x64)\n')

  } catch (error) {
    console.error('\n' + '='.repeat(60))
    console.error('❌ 打包失败')
    console.error('='.repeat(60))
    console.error('\n错误信息:')
    console.error(error.message)
    console.error('\n可能的解决方案:')
    console.error('  1. 检查是否有 OpenClaw 进程正在运行，手动关闭后重试')
    console.error('  2. 以管理员权限运行终端')
    console.error('  3. 临时禁用 Windows Defender 实时保护')
    console.error('  4. 删除 release 和 out 目录后重试')
    console.error('  5. 检查磁盘空间是否充足 (至少需要 1GB)\n')
    process.exit(1)
  }
}

// 运行打包
packageWindows()
