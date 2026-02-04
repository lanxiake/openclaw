const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function build() {
  console.log('📦 开始 Electron 打包...\n');

  // 1. 创建 assets 目录（图标占位符）
  const assetsDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  console.log('✅ 创建资源目录');

  // 2. 复制用户配置到打包目录
  console.log('\n📋 复制用户配置...');
  const userConfigDir = path.join(os.homedir(), '.openclaw');
  const userConfigPath = path.join(userConfigDir, 'openclaw.json');
  const bundledConfigDir = path.join(__dirname, 'bundled-config');
  const bundledConfigPath = path.join(bundledConfigDir, 'openclaw.json');

  if (!fs.existsSync(bundledConfigDir)) {
    fs.mkdirSync(bundledConfigDir, { recursive: true });
  }

  if (fs.existsSync(userConfigPath)) {
    fs.copyFileSync(userConfigPath, bundledConfigPath);
    console.log('✅ 已复制用户配置到打包目录');
  } else {
    // 创建默认配置
    const crypto = require('crypto');
    const defaultToken = crypto.randomBytes(32).toString('hex');
    const defaultConfig = {
      gateway: {
        port: 18789,
        bind: 'loopback',
        auth: {
          mode: 'token',
          token: defaultToken
        },
        controlUi: {
          enabled: true
        }
      }
    };
    fs.writeFileSync(bundledConfigPath, JSON.stringify(defaultConfig, null, 2));
    console.log('✅ 已创建默认配置（随机生成 Gateway Token）');
  }

  // 3. 确保 dist 目录存在
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // 4. 配置国内镜像源加速下载
  console.log('\n⚡ 配置国内镜像源...');
  process.env.npm_config_registry = 'https://registry.npmmirror.com';
  process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/';
  console.log('✅ 镜像源配置完成\n');

  // 5. 安装依赖
  console.log('\n📥 检查依赖...\n');

  try {
    // 检查是否已安装 electron
    try {
      require.resolve('electron');
      console.log('✅ Electron 已安装');
    } catch {
      console.log('📥 安装 Electron 和 electron-builder...');
      console.log('🔍 使用淘宝镜像加速下载...');
      execSync('npm install --save-dev electron electron-builder', {
        cwd: __dirname,
        stdio: 'inherit'
      });
    }

    // 6. 执行 electron-builder 打包
    console.log('\n🔨 执行 Electron 打包命令...\n');
    console.log('⚠️  如果遇到 EBUSY 错误，将自动重试...\n');

    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
      try {
        execSync('npx electron-builder --win --x64', {
          cwd: __dirname,
          stdio: 'inherit',
          env: {
            ...process.env,
            // 禁用并行构建，避免资源竞争
            ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'true'
          }
        });
        success = true;
      } catch (error) {
        retries--;
        if (retries > 0 && error.message.includes('EBUSY')) {
          console.log(`\n⚠️  检测到 EBUSY 错误，等待 3 秒后重试... (剩余 ${retries} 次)\n`);
          // 等待 3 秒
          execSync('timeout /t 3 /nobreak', { stdio: 'inherit' });
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ Electron 打包完成！');
    console.log('\n📂 输出目录:');
    console.log(`   ${distDir}`);

    // 列出打包文件
    const files = fs.readdirSync(distDir);
    console.log('\n📦 打包文件:');
    for (const file of files) {
      const filePath = path.join(distDir, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        console.log(`   - ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      } else {
        console.log(`   - ${file}/ (目录)`);
      }
    }

    console.log('\n🎯 测试命令:');
    console.log('   方式1: npm start (开发模式)');
    console.log('   方式2: 运行 dist/win-unpacked 中的 exe');
    console.log('   方式3: 安装 dist 中的 NSIS 安装包');

  } catch (error) {
    console.error('\n❌ 打包失败:', error.message);
    console.log('\n💡 提示: 首次打包需要下载依赖，可能需要较长时间');
    process.exit(1);
  }
}

build();
