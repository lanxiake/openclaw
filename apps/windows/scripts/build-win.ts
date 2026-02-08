/**
 * Windows 安装包构建脚本
 *
 * 用于构建 NSIS 安装程序、便携版和 ZIP 包
 *
 * 使用方法:
 *   npm run build:win        - 构建所有格式
 *   npm run build:win:nsis   - 仅构建 NSIS 安装程序
 *   npm run build:win:portable - 仅构建便携版
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 日志输出
 */
function log(message: string): void {
  console.log(`[build-win] ${message}`)
}

/**
 * 错误输出
 */
function error(message: string): void {
  console.error(`[build-win] ERROR: ${message}`)
}

/**
 * 检查必需的资源文件
 */
function checkRequiredAssets(): boolean {
  const assetsDir = path.join(__dirname, '../assets')
  const requiredFiles = ['icon.ico']
  const optionalFiles = ['icon.png', 'installer-header.bmp', 'installer-sidebar.bmp']

  log('检查资源文件...')

  // 检查必需文件
  for (const file of requiredFiles) {
    const filePath = path.join(assetsDir, file)
    if (!fs.existsSync(filePath)) {
      error(`缺少必需文件: ${file}`)
      error(`请参阅 assets/README.md 了解如何创建图标文件`)
      return false
    }
    log(`  ✓ ${file}`)
  }

  // 检查可选文件
  for (const file of optionalFiles) {
    const filePath = path.join(assetsDir, file)
    if (fs.existsSync(filePath)) {
      log(`  ✓ ${file} (可选)`)
    } else {
      log(`  - ${file} (可选，未找到，将使用默认样式)`)
    }
  }

  return true
}

/**
 * 检查构建目录中的必需文件
 */
function checkBuildResources(): boolean {
  const buildDir = path.join(__dirname, '../build')
  const requiredFiles = ['installer.nsh', 'license.txt']

  log('检查构建资源...')

  for (const file of requiredFiles) {
    const filePath = path.join(buildDir, file)
    if (!fs.existsSync(filePath)) {
      error(`缺少构建文件: ${file}`)
      return false
    }
    log(`  ✓ ${file}`)
  }

  return true
}

/**
 * 检查编译输出
 */
function checkBuildOutput(): boolean {
  const outDir = path.join(__dirname, '../out')

  log('检查编译输出...')

  if (!fs.existsSync(outDir)) {
    log('  未找到编译输出，开始编译...')
    try {
      execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
    } catch (e) {
      error('编译失败')
      return false
    }
  }

  // 检查 main 和 renderer 输出
  const mainEntry = path.join(outDir, 'main', 'index.js')
  const rendererEntry = path.join(outDir, 'renderer', 'index.html')

  if (!fs.existsSync(mainEntry)) {
    error(`缺少主进程入口: ${mainEntry}`)
    return false
  }

  if (!fs.existsSync(rendererEntry)) {
    error(`缺少渲染进程入口: ${rendererEntry}`)
    return false
  }

  log('  ✓ 编译输出已就绪')
  return true
}

/**
 * 执行构建
 */
function build(target?: string): void {
  log('开始构建 Windows 安装包...')

  // 前置检查
  if (!checkRequiredAssets()) {
    process.exit(1)
  }

  if (!checkBuildResources()) {
    process.exit(1)
  }

  if (!checkBuildOutput()) {
    process.exit(1)
  }

  // 构建命令
  let buildCmd = 'npx electron-builder --win'

  if (target === 'nsis') {
    buildCmd += ' --x64 --ia32 nsis'
  } else if (target === 'portable') {
    buildCmd += ' --x64 portable'
  } else if (target === 'zip') {
    buildCmd += ' --x64 zip'
  }

  log(`执行构建命令: ${buildCmd}`)

  try {
    execSync(buildCmd, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        // 禁用代码签名（开发阶段）
        CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      },
    })

    log('构建完成!')
    log(`输出目录: ${path.join(__dirname, '../release')}`)
  } catch (e) {
    error('构建失败')
    process.exit(1)
  }
}

/**
 * 列出构建产物
 */
function listArtifacts(): void {
  const releaseDir = path.join(__dirname, '../release')

  if (!fs.existsSync(releaseDir)) {
    log('没有找到构建产物')
    return
  }

  log('构建产物:')
  const files = fs.readdirSync(releaseDir)
    .filter(f => !f.startsWith('.') && !f.endsWith('.blockmap'))

  for (const file of files) {
    const filePath = path.join(releaseDir, file)
    const stats = fs.statSync(filePath)

    if (stats.isFile()) {
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
      log(`  ${file} (${sizeMB} MB)`)
    }
  }
}

// 主程序
const args = process.argv.slice(2)
const target = args[0]

if (target === 'list') {
  listArtifacts()
} else {
  build(target)
  listArtifacts()
}
