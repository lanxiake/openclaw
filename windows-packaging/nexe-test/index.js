#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🦞 OpenClaw Gateway - NEXE 打包测试版本');
console.log('=' .repeat(50));

// 测试基本功能
console.log('\n✅ Node 版本:', process.version);
console.log('✅ 平台:', process.platform);
console.log('✅ 架构:', process.arch);
console.log('✅ 执行路径:', process.execPath);
console.log('✅ 当前目录:', process.cwd());

// Nexe 特性：资源打包测试
console.log('\n📦 Nexe 资源打包测试:');
const resourcePath = path.join(__dirname, 'resources', 'logo.txt');
try {
  if (fs.existsSync(resourcePath)) {
    const logo = fs.readFileSync(resourcePath, 'utf8');
    console.log(logo);
  } else {
    console.log('⚠️  Logo 文件不存在');
  }
} catch (error) {
  console.error('❌ 读取 Logo 失败:', error.message);
}

// 测试环境变量
console.log('\n🔧 环境变量测试:');
console.log('   OPENCLAW_DATA:', process.env.OPENCLAW_DATA || '(未设置)');
console.log('   APPDATA:', process.env.APPDATA || '(未设置)');

// 模拟轻量级服务
console.log('\n🚀 Nexe 轻量级打包优势:');
console.log('   • 打包速度快');
console.log('   • 文件体积较小');
console.log('   • 适合简单场景');

// 测试命令行参数
if (process.argv.length > 2) {
  console.log('\n📋 接收到的参数:', process.argv.slice(2));
}

console.log('\n✅ NEXE 打包测试完成！');
console.log('   按任意键退出...');

// 等待用户输入（仅 Windows）
if (process.platform === 'win32') {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => process.exit(0));
}
