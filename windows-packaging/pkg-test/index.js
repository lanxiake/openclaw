#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

console.log("🦞 MtBot Gateway - PKG 打包测试版本");
console.log("=".repeat(50));

// 测试基本功能
console.log("\n✅ Node 版本:", process.version);
console.log("✅ 平台:", process.platform);
console.log("✅ 架构:", process.arch);
console.log("✅ 执行路径:", process.execPath);
console.log("✅ 当前目录:", process.cwd());

// 测试读取打包的资源文件
const assetPath = path.join(__dirname, "assets", "config.json");
try {
  if (fs.existsSync(assetPath)) {
    const config = JSON.parse(fs.readFileSync(assetPath, "utf8"));
    console.log("\n✅ 成功读取配置文件:", config);
  } else {
    console.log("\n⚠️  配置文件不存在");
  }
} catch (error) {
  console.error("\n❌ 读取配置文件失败:", error.message);
}

// 模拟 Gateway 服务
console.log("\n🚀 模拟启动 Gateway 服务...");
console.log("   监听端口: 18789");
console.log("   WebSocket: ws://127.0.0.1:18789");
console.log("   控制面板: http://127.0.0.1:18789/ui");

// 测试命令行参数
if (process.argv.length > 2) {
  console.log("\n📋 接收到的参数:", process.argv.slice(2));
}

console.log("\n✅ PKG 打包测试完成！");
console.log("   按任意键退出...");

// 等待用户输入（仅 Windows）
if (process.platform === "win32") {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", () => process.exit(0));
}
