const { app, BrowserWindow, ipcMain, Menu, Tray, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

let mainWindow = null;
let tray = null;
let gatewayProcess = null;
let gatewayPort = 18789;
let gatewayToken = null;
let gatewayStatus = {
  running: false,
  port: 18789,
  version: null,
  error: null,
  startTime: null,
  url: null
};

// 日志缓冲区
let logBuffer = [];
const MAX_LOG_LINES = 1000;
let logFilePath = null;

// 写入日志
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  const fullMessage = args.length > 0 ? `${logMessage} ${JSON.stringify(args)}` : logMessage;
  
  // 输出到控制台
  console.log(fullMessage);
  
  // 添加到缓冲区
  logBuffer.push(fullMessage);
  if (logBuffer.length > MAX_LOG_LINES) {
    logBuffer.shift();
  }
  
  // 写入文件
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, fullMessage + '\n');
    } catch (err) {
      console.error('Failed to write log file:', err);
    }
  }
}

// 初始化日志文件
function initLogFile() {
  const logDir = path.join(getConfigDir(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  logFilePath = path.join(logDir, `openclaw-${timestamp}.log`);
  log('INFO', 'Log file initialized:', logFilePath);
  
  // 清理旧日志（保留最近10个）
  cleanOldLogs(logDir, 10);
}

// 清理旧日志文件
function cleanOldLogs(logDir, keepCount) {
  try {
    const files = fs.readdirSync(logDir)
      .filter(f => f.startsWith('openclaw-') && f.endsWith('.log'))
      .map(f => ({ name: f, path: path.join(logDir, f), time: fs.statSync(path.join(logDir, f)).mtime }))
      .sort((a, b) => b.time - a.time);
    
    // 删除超过保留数量的日志
    files.slice(keepCount).forEach(f => {
      try {
        fs.unlinkSync(f.path);
        log('INFO', 'Deleted old log file:', f.name);
      } catch (err) {
        log('ERROR', 'Failed to delete log file:', f.name, err.message);
      }
    });
  } catch (err) {
    log('ERROR', 'Failed to clean old logs:', err.message);
  }
}

// 生成随机 token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 获取配置目录
function getConfigDir() {
  return path.join(os.homedir(), '.openclaw');
}

// 获取配置文件路径
function getConfigPath() {
  return path.join(getConfigDir(), 'openclaw.json');
}

// 确保配置目录存在
function ensureConfigDir() {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// 加载或创建配置
function loadOrCreateConfig() {
  ensureConfigDir();
  const configPath = getConfigPath();

  log('INFO', 'Loading configuration from:', configPath);

  // 如果配置文件不存在，尝试从打包的默认配置复制
  if (!fs.existsSync(configPath)) {
    // 尝试从 bundled-config 复制默认配置
    const bundledConfigPath = getBundledConfigPath();
    if (bundledConfigPath && fs.existsSync(bundledConfigPath)) {
      try {
        fs.copyFileSync(bundledConfigPath, configPath);
        log('INFO', 'Copied bundled config to user directory');
      } catch (err) {
        log('ERROR', 'Failed to copy bundled config:', err.message);
      }
    }
  }

  // 如果配置文件仍不存在，创建默认配置
  if (!fs.existsSync(configPath)) {
    // 生成随机 token
    gatewayToken = generateToken();

    const defaultConfig = {
      gateway: {
        port: gatewayPort,
        bind: 'loopback',
        auth: {
          mode: 'token',
          token: gatewayToken
        },
        controlUi: {
          enabled: true
        }
      }
    };

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    log('INFO', 'Created default config with token');
  } else {
    // 读取现有配置
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      gatewayToken = config.gateway?.auth?.token || generateToken();
      gatewayPort = config.gateway?.port || 18789;

      // 如果没有 token，添加一个
      if (!config.gateway?.auth?.token) {
        config.gateway = config.gateway || {};
        config.gateway.auth = config.gateway.auth || {};
        config.gateway.auth.token = gatewayToken;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        log('INFO', 'Added token to existing config');
      }

      log('INFO', 'Loaded existing config successfully');
    } catch (err) {
      log('ERROR', 'Failed to read config:', err.message);
      gatewayToken = generateToken();
    }
  }

  return gatewayToken;
}

// 获取打包的默认配置路径
function getBundledConfigPath() {
  // 在打包后的应用中，资源目录在 process.resourcesPath
  if (process.resourcesPath) {
    const bundledPath = path.join(process.resourcesPath, 'bundled-config', 'openclaw.json');
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }
  }
  // 开发模式下，从当前目录查找
  const devPath = path.join(__dirname, 'bundled-config', 'openclaw.json');
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  return null;
}

// 查找 OpenClaw 项目根目录
function findProjectRoot() {
  // 从当前目录向上查找，直到找到 package.json 和 openclaw.mjs
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    const parentDir = path.dirname(dir);
    if (parentDir === dir) break; // 到达根目录
    
    const packageJsonPath = path.join(parentDir, 'package.json');
    const openclawMjs = path.join(parentDir, 'openclaw.mjs');
    
    if (fs.existsSync(packageJsonPath) && fs.existsSync(openclawMjs)) {
      // 验证是否是 OpenClaw 项目
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (pkg.name === 'openclaw') {
          return parentDir;
        }
      } catch (err) {
        // 继续查找
      }
    }
    
    dir = parentDir;
  }
  
  return null;
}

// 检测 Gateway 是否已经运行
async function checkGatewayRunning() {
  const port = gatewayPort;
  return new Promise((resolve) => {
    const net = require('net');
    const client = new net.Socket();
    
    client.setTimeout(2000);
    
    client.on('connect', () => {
      client.destroy();
      // 尝试通过 WebSocket 连接验证
      const WebSocket = require('ws');
      const ws = new WebSocket(`ws://localhost:${port}`);
      
      ws.on('open', () => {
        ws.close();
        resolve(true);
      });
      
      ws.on('error', () => {
        resolve(false);
      });
      
      setTimeout(() => {
        ws.close();
        resolve(false);
      }, 2000);
    });
    
    client.on('error', () => {
      resolve(false);
    });
    
    client.on('timeout', () => {
      client.destroy();
      resolve(false);
    });
    
    client.connect(port, 'localhost');
  });
}

// 启动 Gateway
async function startGateway() {
  // 首先检查 Gateway 是否已经运行
  log('INFO', 'Checking if Gateway is already running...');
  const alreadyRunning = await checkGatewayRunning();
  
  if (alreadyRunning) {
    log('INFO', 'Gateway is already running, connecting to it...');
    gatewayStatus.running = true;
    gatewayStatus.url = `http://localhost:${gatewayPort}`;
    gatewayStatus.error = null;
    updateTrayMenu();
    return { success: true, message: '已连接到运行中的 Gateway' };
  }
  
  if (gatewayProcess) {
    log('WARN', 'Gateway process already started');
    return { success: true, message: 'Gateway 已在运行' };
  }
  
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    const error = '无法找到 OpenClaw 项目根目录';
    log('ERROR', error);
    gatewayStatus.error = error;
    return { success: false, message: error };
  }
  
  const openclawMjs = path.join(projectRoot, 'openclaw.mjs');
  if (!fs.existsSync(openclawMjs)) {
    const error = `OpenClaw 入口文件不存在: ${openclawMjs}`;
    log('ERROR', error);
    gatewayStatus.error = error;
    return { success: false, message: error };
  }
  
  log('INFO', 'Starting Gateway from:', projectRoot);
  gatewayStatus.error = null;
  gatewayStatus.startTime = Date.now();
  
  const configPath = getConfigPath();
  log('INFO', 'Using config:', configPath);
  log('INFO', 'Gateway port:', gatewayPort);
  
  return new Promise((resolve) => {
    gatewayProcess = spawn(process.execPath, [
      openclawMjs,
      'gateway',
      'run',
      '--bind', 'loopback',
      '--port', String(gatewayPort),
      '--force'
    ], {
      cwd: projectRoot,
      env: {
        ...process.env,
        OPENCLAW_CONFIG_PATH: configPath,
        OPENCLAW_SKIP_CHANNELS: '1',
        NODE_OPTIONS: '--disable-warning=ExperimentalWarning'
      },
      stdio: 'pipe'
    });
    
    let startupOutput = '';
    let resolved = false;
    
    gatewayProcess.stdout.on('data', (data) => {
      const output = data.toString();
      startupOutput += output;
      log('GATEWAY', output.trim());
      
      // 检测 Gateway 是否启动成功
      if (!resolved && output.includes('listening on ws://')) {
        gatewayStatus.running = true;
        gatewayStatus.url = `http://localhost:${gatewayPort}`;
        log('INFO', 'Gateway started successfully on port', gatewayPort);
        updateTrayMenu();
        resolved = true;
        resolve({ success: true, message: 'Gateway 启动成功' });
      }
    });
    
    gatewayProcess.stderr.on('data', (data) => {
      const errorOutput = data.toString();
      log('GATEWAY-ERROR', errorOutput.trim());
    });
    
    gatewayProcess.on('error', (error) => {
      log('ERROR', 'Failed to start gateway:', error.message);
      gatewayStatus.error = error.message;
      gatewayStatus.running = false;
      updateTrayMenu();
      if (!resolved) {
        resolved = true;
        resolve({ success: false, message: error.message });
      }
    });
    
    gatewayProcess.on('exit', (code) => {
      log('INFO', `Gateway process exited with code ${code}`);
      gatewayStatus.running = false;
      gatewayStatus.error = code !== 0 ? `Gateway 退出，代码: ${code}` : null;
      gatewayProcess = null;
      updateTrayMenu();
      if (!resolved) {
        resolved = true;
        const errorMsg = `Gateway 启动失败，退出代码: ${code}`;
        log('ERROR', errorMsg);
        log('ERROR', 'Startup output:', startupOutput);
        resolve({ success: false, message: errorMsg, output: startupOutput });
      }
    });
    
    // 30秒超时
    setTimeout(() => {
      if (!resolved) {
        const error = 'Gateway 启动超时 (30秒)';
        log('ERROR', error);
        log('ERROR', 'Startup output:', startupOutput);
        gatewayStatus.error = error;
        resolved = true;
        resolve({ success: false, message: error, output: startupOutput });
      }
    }, 30000);
  });
}

// 停止 Gateway
async function stopGateway() {
  if (!gatewayProcess) {
    return { success: true, message: 'Gateway 未运行' };
  }
  
  return new Promise((resolve) => {
    console.log('Stopping Gateway...');
    
    const timeout = setTimeout(() => {
      if (gatewayProcess) {
        console.log('Force killing gateway...');
        gatewayProcess.kill('SIGKILL');
      }
      gatewayStatus.running = false;
      gatewayProcess = null;
      updateTrayMenu();
      resolve({ success: true, message: 'Gateway 已强制停止' });
    }, 5000);
    
    gatewayProcess.once('exit', () => {
      clearTimeout(timeout);
      gatewayStatus.running = false;
      gatewayProcess = null;
      updateTrayMenu();
      console.log('Gateway stopped');
      resolve({ success: true, message: 'Gateway 已停止' });
    });
    
    gatewayProcess.kill('SIGTERM');
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'OpenClaw',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true  // 启用 webview
    }
  });

  mainWindow.loadFile('index.html');

  // 开发模式下打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  
  // 如果图标不存在，就不创建托盘图标
  if (!fs.existsSync(iconPath)) {
    console.warn('Tray icon not found, skipping tray creation');
    return;
  }
  
  try {
    tray = new Tray(iconPath);
    updateTrayMenu();
    tray.setToolTip('OpenClaw Gateway');
  } catch (err) {
    console.error('Failed to create tray:', err);
  }
}

function updateTrayMenu() {
  if (!tray) return;
  
  const statusLabel = gatewayStatus.running 
    ? `● 运行中 (端口: ${gatewayPort})` 
    : '○ 未运行';
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: '打开 OpenClaw', 
      click: () => {
        if (mainWindow === null) {
          createWindow();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    { 
      label: 'Gateway 状态', 
      enabled: false 
    },
    { 
      label: statusLabel, 
      enabled: false 
    },
    { type: 'separator' },
    {
      label: gatewayStatus.running ? '停止 Gateway' : '启动 Gateway',
      click: async () => {
        if (gatewayStatus.running) {
          await stopGateway();
        } else {
          await startGateway();
        }
      }
    },
    { type: 'separator' },
    { 
      label: '退出', 
      click: async () => {
        await stopGateway();
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

// IPC 通信
ipcMain.handle('get-gateway-status', async () => {
  const projectRoot = findProjectRoot();
  return {
    ...gatewayStatus,
    platform: process.platform,
    projectRoot,
    token: gatewayToken,
    logFilePath
  };
});

ipcMain.handle('get-logs', async () => {
  return {
    logs: logBuffer,
    logFilePath
  };
});

ipcMain.handle('get-diagnostic-info', async () => {
  const projectRoot = findProjectRoot();
  const configPath = getConfigPath();
  const configDir = getConfigDir();
  
  return {
    projectRoot,
    configPath,
    configDir,
    configExists: fs.existsSync(configPath),
    openclawMjsExists: projectRoot ? fs.existsSync(path.join(projectRoot, 'openclaw.mjs')) : false,
    distExists: projectRoot ? fs.existsSync(path.join(projectRoot, 'dist')) : false,
    gatewayPort,
    gatewayToken: gatewayToken ? '****' + gatewayToken.slice(-8) : null,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    logFilePath,
    error: gatewayStatus.error
  };
});

ipcMain.handle('open-log-file', async () => {
  if (logFilePath && fs.existsSync(logFilePath)) {
    await shell.openPath(logFilePath);
    return { success: true };
  }
  return { success: false, message: '日志文件不存在' };
});

ipcMain.handle('start-gateway', async () => {
  return await startGateway();
});

ipcMain.handle('stop-gateway', async () => {
  return await stopGateway();
});

ipcMain.handle('restart-gateway', async () => {
  await stopGateway();
  await new Promise(resolve => setTimeout(resolve, 1000));
  return await startGateway();
});

ipcMain.handle('open-config-dir', async () => {
  const configDir = getConfigDir();
  if (fs.existsSync(configDir)) {
    await shell.openPath(configDir);
    return { success: true };
  }
  return { success: false, message: '配置目录不存在' };
});

// 获取配置
ipcMain.handle('get-config', async () => {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { success: true, config };
    }
    return { success: false, message: '配置文件不存在' };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// 保存配置
ipcMain.handle('save-config', async (event, newConfig) => {
  const configPath = getConfigPath();
  try {
    ensureConfigDir();

    // 读取现有配置
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    // 合并新配置
    config = { ...config, ...newConfig };

    // 保存
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    log('INFO', 'Config saved successfully');

    return { success: true };
  } catch (err) {
    log('ERROR', 'Failed to save config:', err.message);
    return { success: false, message: err.message };
  }
});

// 更新 Gateway Token
ipcMain.handle('update-gateway-token', async (event, token) => {
  const configPath = getConfigPath();
  try {
    ensureConfigDir();

    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    config.gateway = config.gateway || {};
    config.gateway.auth = config.gateway.auth || {};
    config.gateway.auth.token = token;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    gatewayToken = token;

    log('INFO', 'Gateway token updated');
    return { success: true };
  } catch (err) {
    log('ERROR', 'Failed to update gateway token:', err.message);
    return { success: false, message: err.message };
  }
});

app.whenReady().then(async () => {
  // 初始化日志文件
  initLogFile();
  log('INFO', 'OpenClaw Desktop Application starting...');
  log('INFO', 'Node version:', process.version);
  log('INFO', 'Platform:', process.platform, process.arch);
  
  // 加载或创建配置
  loadOrCreateConfig();
  
  createWindow();
  createTray();
  
  // 自动启动 Gateway
  log('INFO', 'Auto-starting Gateway...');
  await startGateway();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Windows: 关闭窗口不退出，保持托盘运行
  if (process.platform !== 'darwin') {
    // 不退出，继续后台运行
  }
});

app.on('before-quit', async (event) => {
  if (gatewayProcess) {
    event.preventDefault();
    await stopGateway();
    app.exit(0);
  }
});
