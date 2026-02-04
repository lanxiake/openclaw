const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async function build() {
  console.log('📦 开始 NEXE 打包...\n');

  // 1. 创建 resources 目录和测试资源
  const resourcesDir = path.join(__dirname, 'resources');
  await fs.ensureDir(resourcesDir);
  
  const logo = `
   ____                   ____ _                
  / __ \\                 / __ \\ |               
 | |  | |_ __   ___ _ __ | |  | | | __ ___      __
 | |  | | '_ \\ / _ \\ '_ \\| |  | | |/ _\` \\ \\ /\\ / /
 | |__| | |_) |  __/ | | | |__| | | (_| |\\ V  V / 
  \\____/| .__/ \\___|_| |_|\\___\\_\\_|\\__,_| \\_/\\_/  
        | |                                        
        |_|                          NEXE Edition
  `;
  
  await fs.writeFile(path.join(resourcesDir, 'logo.txt'), logo.trim());
  console.log('✅ 创建测试资源文件');

  // 2. 确保 dist 目录存在
  const distDir = path.join(__dirname, 'dist');
  await fs.ensureDir(distDir);

  // 3. 配置国内镜像源加速下载
  console.log('⚡ 配置国内镜像源...');
  process.env.npm_config_registry = 'https://registry.npmmirror.com';
  process.env.npm_config_node_mirror = 'https://npmmirror.com/mirrors/node/';
  console.log('✅ 镜像源配置完成\n');

  // 4. 执行 nexe 打包
  console.log('\n🔨 执行 nexe 打包命令...\n');
  console.log('⚠️  使用 Node 16.20.2 (经典稳定版)\n');
  
  try {
    execSync('npx nexe index.js --target windows-x64-16.20.2 --output dist/openclaw.exe --resource resources/**/*', {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    console.log('\n✅ NEXE 打包完成！');
    console.log('\n📂 输出文件:');
    console.log(`   ${path.join(distDir, 'openclaw.exe')}`);
    
    // 检查文件大小
    const stats = await fs.stat(path.join(distDir, 'openclaw.exe'));
    console.log(`   大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('\n🎯 测试命令:');
    console.log('   cd windows-packaging/nexe-test');
    console.log('   dist\\openclaw.exe');
    
  } catch (error) {
    console.error('\n❌ 打包失败:', error.message);
    process.exit(1);
  }
}

build();
