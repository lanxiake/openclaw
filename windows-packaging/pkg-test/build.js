const { execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

async function build() {
  console.log("📦 开始 PKG 打包...\n");

  // 1. 创建 assets 目录和测试配置
  const assetsDir = path.join(__dirname, "assets");
  await fs.ensureDir(assetsDir);

  const config = {
    name: "MtBot",
    version: "2026.1.30",
    gateway: {
      port: 18789,
      bind: "loopback",
    },
  };

  await fs.writeJson(path.join(assetsDir, "config.json"), config, { spaces: 2 });
  console.log("✅ 创建测试配置文件");

  // 2. 确保 dist 目录存在
  const distDir = path.join(__dirname, "dist");
  await fs.ensureDir(distDir);

  // 3. 配置国内镜像源加速下载
  console.log("⚡ 配置国内镜像源...");
  process.env.npm_config_registry = "https://registry.npmmirror.com";
  process.env.npm_config_node_mirror = "https://npmmirror.com/mirrors/node/";
  // PKG 缓存目录
  process.env.PKG_CACHE_PATH = path.join(require("os").homedir(), ".pkg-cache");
  console.log("✅ 镜像源配置完成\n");

  // 4. 执行 pkg 打包
  console.log("\n🔨 执行 pkg 打包命令...\n");
  console.log("⚠️  注意：首次打包可能需要较长时间下载 Node.js 运行时\n");

  try {
    // 使用 node14 替代 node16，更稳定
    execSync("npx pkg@5.8.1 . --target node14-win-x64 --output dist/mtbot.exe", {
      cwd: __dirname,
      stdio: "inherit",
    });

    console.log("\n✅ PKG 打包完成！");
    console.log("\n📂 输出文件:");
    console.log(`   ${path.join(distDir, "mtbot.exe")}`);

    // 检查文件大小
    const stats = await fs.stat(path.join(distDir, "mtbot.exe"));
    console.log(`   大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    console.log("\n🎯 测试命令:");
    console.log("   cd windows-packaging/pkg-test");
    console.log("   dist\\mtbot.exe");
  } catch (error) {
    console.error("\n❌ 打包失败:", error.message);
    process.exit(1);
  }
}

build();
