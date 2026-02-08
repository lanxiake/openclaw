const { execSync, exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// 递归复制目录
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // 跳过一些不需要的目录
    if (entry.name === ".git" || entry.name === ".cache" || entry.name === "__pycache__") {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      // 处理符号链接
      try {
        const linkTarget = fs.readlinkSync(srcPath);
        // 如果是相对路径的符号链接，尝试复制实际文件
        const resolvedTarget = path.isAbsolute(linkTarget)
          ? linkTarget
          : path.resolve(path.dirname(srcPath), linkTarget);

        if (fs.existsSync(resolvedTarget)) {
          const stat = fs.statSync(resolvedTarget);
          if (stat.isDirectory()) {
            copyDirSync(resolvedTarget, destPath);
          } else {
            fs.copyFileSync(resolvedTarget, destPath);
          }
        }
      } catch (err) {
        // 忽略无法处理的符号链接
        console.log(`⚠️  跳过符号链接: ${srcPath}`);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 强制结束 Electron 进程
function killElectronProcesses() {
  console.log("\n🔄 正在结束残留的 Electron 进程...");
  try {
    if (process.platform === "win32") {
      // Windows: 结束所有 electron.exe 进程
      try {
        execSync("taskkill /F /IM electron.exe /T 2>nul", { stdio: "ignore" });
        console.log("✅ 已结束 Electron 进程");
      } catch (err) {
        // 如果没有进程在运行，忽略错误
      }
    } else {
      // macOS/Linux
      try {
        execSync("pkill -9 electron", { stdio: "ignore" });
        console.log("✅ 已结束 Electron 进程");
      } catch (err) {
        // 如果没有进程在运行，忽略错误
      }
    }
  } catch (err) {
    console.log("⚠️  结束进程时出现问题，继续执行...");
  }
}

// 删除 dist 目录（带重试）
function cleanDistDirectory() {
  const distDir = path.join(__dirname, "dist");

  if (!fs.existsSync(distDir)) {
    return;
  }

  console.log("\n🧹 清理旧的打包文件...");

  let retries = 3;
  while (retries > 0) {
    try {
      fs.rmSync(distDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
      console.log("✅ 已清理 dist 目录");
      break;
    } catch (err) {
      retries--;
      if (retries > 0) {
        console.log(`⚠️  清理失败，等待 2 秒后重试... (剩余 ${retries} 次)`);
        // 等待 2 秒
        try {
          if (process.platform === "win32") {
            execSync("timeout /t 2 /nobreak >nul 2>&1", { stdio: "ignore" });
          } else {
            execSync("sleep 2", { stdio: "ignore" });
          }
        } catch (e) {
          // 忽略 timeout 命令错误
        }
      } else {
        console.log("⚠️  无法完全清理 dist 目录，将尝试继续...");
      }
    }
  }
}

// 清理 electron-builder 缓存
function cleanElectronBuilderCache() {
  console.log("\n🧹 清理 electron-builder 缓存...");

  // 清理本地 node_modules/.cache
  const localCacheDir = path.join(__dirname, "node_modules", ".cache");
  if (fs.existsSync(localCacheDir)) {
    try {
      fs.rmSync(localCacheDir, { recursive: true, force: true });
      console.log("✅ 已清理 node_modules/.cache");
    } catch (err) {
      console.log("⚠️  清理 node_modules/.cache 失败:", err.message);
    }
  }

  // 清理用户目录下的 electron-builder 缓存（可选，较大）
  const userCacheDir = path.join(os.homedir(), "AppData", "Local", "electron-builder", "Cache");
  if (process.platform === "win32" && fs.existsSync(userCacheDir)) {
    console.log("📍 用户缓存目录:", userCacheDir);
    console.log("   如需完全清理，可手动删除此目录");
  }
}

function build() {
  console.log("📦 开始 Electron 打包...\n");

  // 0. 先结束残留进程和清理旧文件
  killElectronProcesses();

  // 等待 1 秒确保进程完全结束
  try {
    if (process.platform === "win32") {
      execSync("timeout /t 1 /nobreak >nul 2>&1", { stdio: "ignore" });
    } else {
      execSync("sleep 1", { stdio: "ignore" });
    }
  } catch (e) {
    // 忽略
  }

  cleanDistDirectory();
  cleanElectronBuilderCache();

  // 1. 创建 assets 目录（图标占位符）
  const assetsDir = path.join(__dirname, "assets");
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  console.log("✅ 创建资源目录");

  // 2. 复制用户配置到打包目录
  console.log("\n📋 复制用户配置...");
  const userConfigDir = path.join(os.homedir(), ".openclaw");
  const userConfigPath = path.join(userConfigDir, "openclaw.json");
  const bundledConfigDir = path.join(__dirname, "bundled-config");
  const bundledConfigPath = path.join(bundledConfigDir, "openclaw.json");

  if (!fs.existsSync(bundledConfigDir)) {
    fs.mkdirSync(bundledConfigDir, { recursive: true });
  }

  if (fs.existsSync(userConfigPath)) {
    fs.copyFileSync(userConfigPath, bundledConfigPath);
    console.log("✅ 已复制用户配置到打包目录");
  } else {
    // 创建默认配置
    const crypto = require("crypto");
    const defaultToken = crypto.randomBytes(32).toString("hex");
    const defaultConfig = {
      gateway: {
        port: 18789,
        bind: "loopback",
        auth: {
          mode: "token",
          token: defaultToken,
        },
        controlUi: {
          enabled: true,
        },
      },
    };
    fs.writeFileSync(bundledConfigPath, JSON.stringify(defaultConfig, null, 2));
    console.log("✅ 已创建默认配置（随机生成 Gateway Token）");
  }

  // 2.5 复制 OpenClaw 核心文件到打包目录
  console.log("\n📦 复制 OpenClaw 核心文件...");
  const openclawProjectRoot = path.resolve(__dirname, "..", "..");
  const bundledOpenclawDir = path.join(__dirname, "bundled-openclaw");

  // 清理旧的 bundled-openclaw 目录
  if (fs.existsSync(bundledOpenclawDir)) {
    fs.rmSync(bundledOpenclawDir, { recursive: true, force: true });
  }
  fs.mkdirSync(bundledOpenclawDir, { recursive: true });

  // 复制 openclaw.mjs 入口文件
  const openclawMjsPath = path.join(openclawProjectRoot, "openclaw.mjs");
  if (fs.existsSync(openclawMjsPath)) {
    fs.copyFileSync(openclawMjsPath, path.join(bundledOpenclawDir, "openclaw.mjs"));
    console.log("✅ 已复制 openclaw.mjs");
  } else {
    console.log("⚠️  未找到 openclaw.mjs，跳过 OpenClaw 核心文件复制");
  }

  // 复制 dist 目录
  const openclawDistDir = path.join(openclawProjectRoot, "dist");
  const bundledDistDir = path.join(bundledOpenclawDir, "dist");
  if (fs.existsSync(openclawDistDir)) {
    console.log("📂 正在复制 OpenClaw dist 目录（这可能需要一些时间）...");
    copyDirSync(openclawDistDir, bundledDistDir);
    console.log("✅ 已复制 OpenClaw dist 目录");
  } else {
    console.log("⚠️  未找到 OpenClaw dist 目录");
  }

  // 复制 package.json（用于依赖信息）
  const openclawPackageJson = path.join(openclawProjectRoot, "package.json");
  if (fs.existsSync(openclawPackageJson)) {
    fs.copyFileSync(openclawPackageJson, path.join(bundledOpenclawDir, "package.json"));
    console.log("✅ 已复制 package.json");
  }

  // 复制 node_modules（只复制 dependencies 中的包）
  const openclawNodeModules = path.join(openclawProjectRoot, "node_modules");
  const bundledNodeModules = path.join(bundledOpenclawDir, "node_modules");
  if (fs.existsSync(openclawNodeModules)) {
    console.log("📂 正在复制 node_modules（这可能需要较长时间）...");
    copyDirSync(openclawNodeModules, bundledNodeModules);
    console.log("✅ 已复制 node_modules");
  } else {
    console.log("⚠️  未找到 node_modules 目录");
  }

  // 3. 确保 dist 目录存在
  const distDir = path.join(__dirname, "dist");
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    console.log("\n✅ 创建 dist 目录");
  }

  // 4. 配置国内镜像源加速下载
  console.log("\n⚡ 配置国内镜像源...");
  process.env.npm_config_registry = "https://registry.npmmirror.com";
  process.env.ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/";
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
    "https://npmmirror.com/mirrors/electron-builder-binaries/";
  console.log("✅ 镜像源配置完成\n");

  // 5. 安装依赖（始终运行以确保依赖完整且最新）
  console.log("\n📥 安装/更新依赖...\n");

  try {
    // 始终运行 npm install 确保依赖完整
    console.log("📥 运行 npm install 确保依赖完整...");
    console.log("🔍 使用淘宝镜像加速下载...");
    execSync("npm install", {
      cwd: __dirname,
      stdio: "inherit",
    });
    console.log("✅ 依赖安装完成");

    // 6. 执行 electron-builder 打包
    console.log("\n🔨 执行 Electron 打包命令...\n");
    console.log("⚠️  如果遇到文件占用错误，将自动重试...\n");

    let retries = 5; // 增加重试次数
    let success = false;
    let lastError = null;

    while (retries > 0 && !success) {
      try {
        execSync("npx electron-builder --win --x64", {
          cwd: __dirname,
          stdio: "inherit",
          env: {
            ...process.env,
            // 禁用并行构建，避免资源竞争
            ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: "true",
            // 设置较长的超时时间
            ELECTRON_BUILDER_TIMEOUT: "300000",
          },
        });
        success = true;
      } catch (error) {
        lastError = error;
        retries--;

        const errorMsg = error.message || error.toString();
        const isFileLockedError =
          errorMsg.includes("EBUSY") ||
          errorMsg.includes("Access is denied") ||
          errorMsg.includes("remove") ||
          errorMsg.includes("d3dcompiler");

        if (retries > 0 && isFileLockedError) {
          console.log(`\n⚠️  检测到文件被占用，尝试修复... (剩余 ${retries} 次)\n`);

          // 再次结束进程
          killElectronProcesses();

          // 等待 5 秒
          console.log("⏳ 等待 5 秒让系统释放文件...");
          try {
            if (process.platform === "win32") {
              execSync("timeout /t 5 /nobreak >nul 2>&1", { stdio: "ignore" });
            } else {
              execSync("sleep 5", { stdio: "ignore" });
            }
          } catch (e) {
            // 忽略
          }

          // 尝试清理 dist/win-unpacked
          const winUnpackedDir = path.join(distDir, "win-unpacked");
          if (fs.existsSync(winUnpackedDir)) {
            console.log("🧹 清理 dist/win-unpacked 目录...");
            try {
              fs.rmSync(winUnpackedDir, {
                recursive: true,
                force: true,
                maxRetries: 5,
                retryDelay: 2000,
              });
              console.log("✅ 清理成功\n");
            } catch (cleanErr) {
              console.log("⚠️  清理失败，但将继续尝试\n");
            }
          }
        } else {
          throw error;
        }
      }
    }

    console.log("\n✅ Electron 打包完成！");
    console.log("\n📂 输出目录:");
    console.log(`   ${distDir}`);

    // 列出打包文件
    const files = fs.readdirSync(distDir);
    console.log("\n📦 打包文件:");
    for (const file of files) {
      const filePath = path.join(distDir, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        console.log(`   - ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      } else {
        console.log(`   - ${file}/ (目录)`);
      }
    }

    console.log("\n🎯 测试命令:");
    console.log("   方式1: npm start (开发模式)");
    console.log("   方式2: 运行 dist/win-unpacked 中的 exe");
    console.log("   方式3: 安装 dist 中的 NSIS 安装包");
  } catch (error) {
    console.error("\n❌ 打包失败:", error.message);
    console.log("\n💡 解决方案:");
    console.log("   1. 确保所有 Electron 进程已经关闭");
    console.log("   2. 手动删除 dist 目录： rmdir /s /q dist");
    console.log("   3. 重启计算机后再次尝试");
    console.log("   4. 关闭杀毒软件/防火墙后重试");
    console.log("   5. 以管理员身份运行命令提示符");
    console.log("\n📝 详细错误信息:");
    console.log(error.stack || error);
    process.exit(1);
  }
}

build();
