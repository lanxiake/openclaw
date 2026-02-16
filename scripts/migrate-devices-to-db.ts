#!/usr/bin/env tsx
/**
 * 设备数据迁移脚本
 *
 * 将 JSON 文件存储的设备数据迁移到 PostgreSQL 数据库
 *
 * 用法:
 *   pnpm tsx scripts/migrate-devices-to-db.ts [options]
 *
 * 选项:
 *   --dry-run     模拟运行，不实际写入数据库
 *   --base-dir    指定设备数据目录 (默认: ~/.openclaw/devices)
 *   --verbose     显示详细日志
 *
 * @author OpenClaw
 */

import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { getDatabase } from "../src/db/connection.js";
import { devices, devicePairingRequests } from "../src/db/schema/devices.js";
import type { NewDevice, NewDevicePairingRequest } from "../src/db/schema/devices.js";
import { resolveStateDir } from "../src/config/paths.js";

// ============================================================================
// 类型定义 (从 device-pairing.ts 复制)
// ============================================================================

interface DeviceAuthToken {
  token: string;
  role: string;
  scopes: string[];
  createdAtMs: number;
  rotatedAtMs?: number;
  revokedAtMs?: number;
  lastUsedAtMs?: number;
}

interface DevicePairingPendingRequest {
  requestId: string;
  deviceId: string;
  publicKey: string;
  userId?: string;
  displayName?: string;
  platform?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  silent?: boolean;
  isRepair?: boolean;
  ts: number;
}

interface PairedDevice {
  deviceId: string;
  publicKey: string;
  userId?: string;
  displayName?: string;
  platform?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  tokens?: Record<string, DeviceAuthToken>;
  createdAtMs: number;
  approvedAtMs: number;
}

// ============================================================================
// 迁移统计
// ============================================================================

interface MigrationStats {
  totalPairedDevices: number;
  totalPendingRequests: number;
  migratedDevices: number;
  migratedRequests: number;
  skippedDevices: number;
  skippedRequests: number;
  failedDevices: number;
  failedRequests: number;
  errors: Array<{ type: string; id: string; message: string }>;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 读取 JSON 文件
 */
async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * 日志输出
 */
function log(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

/**
 * 将 PairedDevice 转换为 NewDevice
 */
function convertPairedDeviceToNewDevice(device: PairedDevice): NewDevice {
  return {
    id: randomUUID(),
    deviceId: device.deviceId,
    publicKey: device.publicKey,
    userId: device.userId || null,
    displayName: device.displayName || null,
    platform: device.platform as NewDevice["platform"],
    clientId: device.clientId || null,
    clientMode: device.clientMode || null,
    role: device.role || null,
    roles: device.roles || null,
    scopes: device.scopes || null,
    tokens: device.tokens || null,
    remoteIp: device.remoteIp || null,
    isActive: true,
    createdAt: new Date(device.createdAtMs),
    approvedAt: new Date(device.approvedAtMs),
    lastActiveAt: device.tokens
      ? new Date(
          Math.max(
            ...Object.values(device.tokens).map((t) => t.lastUsedAtMs || t.createdAtMs)
          )
        )
      : null,
    revokedAt: null,
  };
}

/**
 * 将 DevicePairingPendingRequest 转换为 NewDevicePairingRequest
 */
function convertPendingRequestToNewRequest(
  request: DevicePairingPendingRequest
): NewDevicePairingRequest {
  const PENDING_TTL_MS = 5 * 60 * 1000; // 5 分钟过期
  return {
    id: randomUUID(),
    requestId: request.requestId,
    deviceId: request.deviceId,
    publicKey: request.publicKey,
    userId: request.userId || null,
    displayName: request.displayName || null,
    platform: request.platform as NewDevicePairingRequest["platform"],
    clientId: request.clientId || null,
    clientMode: request.clientMode || null,
    requestedRole: request.role || null,
    requestedScopes: request.scopes || null,
    remoteIp: request.remoteIp || null,
    silent: request.silent || false,
    isRepair: request.isRepair || false,
    status: "pending",
    createdAt: new Date(request.ts),
    expiresAt: new Date(request.ts + PENDING_TTL_MS),
  };
}

// ============================================================================
// 主迁移逻辑
// ============================================================================

/**
 * 执行迁移
 */
async function migrate(options: {
  dryRun: boolean;
  baseDir: string;
  verbose: boolean;
}): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalPairedDevices: 0,
    totalPendingRequests: 0,
    migratedDevices: 0,
    migratedRequests: 0,
    skippedDevices: 0,
    skippedRequests: 0,
    failedDevices: 0,
    failedRequests: 0,
    errors: [],
  };

  log("开始设备数据迁移", {
    dryRun: options.dryRun,
    baseDir: options.baseDir,
  });

  // 1. 读取 JSON 文件
  const devicesDir = path.join(options.baseDir, "devices");
  const pairedPath = path.join(devicesDir, "paired.json");
  const pendingPath = path.join(devicesDir, "pending.json");

  log(`读取配对设备文件: ${pairedPath}`);
  const pairedByDeviceId = await readJSON<Record<string, PairedDevice>>(pairedPath);

  log(`读取待处理请求文件: ${pendingPath}`);
  const pendingById = await readJSON<Record<string, DevicePairingPendingRequest>>(
    pendingPath
  );

  const pairedDevices = pairedByDeviceId ? Object.values(pairedByDeviceId) : [];
  const pendingRequests = pendingById ? Object.values(pendingById) : [];

  stats.totalPairedDevices = pairedDevices.length;
  stats.totalPendingRequests = pendingRequests.length;

  log("发现数据", {
    pairedDevices: stats.totalPairedDevices,
    pendingRequests: stats.totalPendingRequests,
  });

  if (stats.totalPairedDevices === 0 && stats.totalPendingRequests === 0) {
    log("没有数据需要迁移");
    return stats;
  }

  // 2. 获取数据库连接
  const db = getDatabase();

  // 3. 迁移配对设备
  log("开始迁移配对设备...");
  for (const device of pairedDevices) {
    try {
      // 检查是否已存在
      const existing = await db
        .select()
        .from(devices)
        .where(eq(devices.deviceId, device.deviceId))
        .limit(1);

      if (existing.length > 0) {
        if (options.verbose) {
          log(`设备已存在，跳过: ${device.deviceId}`);
        }
        stats.skippedDevices++;
        continue;
      }

      // 转换并插入
      const newDevice = convertPairedDeviceToNewDevice(device);

      if (options.dryRun) {
        if (options.verbose) {
          log(`[DRY-RUN] 将插入设备: ${device.deviceId}`, newDevice);
        }
        stats.migratedDevices++;
      } else {
        await db.insert(devices).values(newDevice);
        if (options.verbose) {
          log(`设备迁移成功: ${device.deviceId}`);
        }
        stats.migratedDevices++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log(`设备迁移失败: ${device.deviceId}`, { error: message });
      stats.failedDevices++;
      stats.errors.push({
        type: "device",
        id: device.deviceId,
        message,
      });
    }
  }

  // 4. 迁移待处理请求
  log("开始迁移待处理请求...");
  for (const request of pendingRequests) {
    try {
      // 检查是否已存在
      const existing = await db
        .select()
        .from(devicePairingRequests)
        .where(eq(devicePairingRequests.requestId, request.requestId))
        .limit(1);

      if (existing.length > 0) {
        if (options.verbose) {
          log(`请求已存在，跳过: ${request.requestId}`);
        }
        stats.skippedRequests++;
        continue;
      }

      // 检查是否已过期
      const PENDING_TTL_MS = 5 * 60 * 1000;
      if (Date.now() - request.ts > PENDING_TTL_MS) {
        if (options.verbose) {
          log(`请求已过期，跳过: ${request.requestId}`);
        }
        stats.skippedRequests++;
        continue;
      }

      // 转换并插入
      const newRequest = convertPendingRequestToNewRequest(request);

      if (options.dryRun) {
        if (options.verbose) {
          log(`[DRY-RUN] 将插入请求: ${request.requestId}`, newRequest);
        }
        stats.migratedRequests++;
      } else {
        await db.insert(devicePairingRequests).values(newRequest);
        if (options.verbose) {
          log(`请求迁移成功: ${request.requestId}`);
        }
        stats.migratedRequests++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log(`请求迁移失败: ${request.requestId}`, { error: message });
      stats.failedRequests++;
      stats.errors.push({
        type: "request",
        id: request.requestId,
        message,
      });
    }
  }

  return stats;
}

// ============================================================================
// CLI 入口
// ============================================================================

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      "base-dir": { type: "string" },
      verbose: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    console.log(`
设备数据迁移脚本

将 JSON 文件存储的设备数据迁移到 PostgreSQL 数据库

用法:
  pnpm tsx scripts/migrate-devices-to-db.ts [options]

选项:
  --dry-run     模拟运行，不实际写入数据库
  --base-dir    指定设备数据目录 (默认: ~/.openclaw)
  --verbose     显示详细日志
  --help        显示帮助信息
`);
    process.exit(0);
  }

  const baseDir = values["base-dir"] || resolveStateDir();

  log("=".repeat(60));
  log("设备数据迁移脚本");
  log("=".repeat(60));

  try {
    const stats = await migrate({
      dryRun: values["dry-run"] || false,
      baseDir,
      verbose: values.verbose || false,
    });

    log("=".repeat(60));
    log("迁移完成", stats);
    log("=".repeat(60));

    // 输出摘要
    console.log("\n迁移摘要:");
    console.log(`  配对设备: ${stats.totalPairedDevices} 总计`);
    console.log(`    - 迁移: ${stats.migratedDevices}`);
    console.log(`    - 跳过: ${stats.skippedDevices}`);
    console.log(`    - 失败: ${stats.failedDevices}`);
    console.log(`  待处理请求: ${stats.totalPendingRequests} 总计`);
    console.log(`    - 迁移: ${stats.migratedRequests}`);
    console.log(`    - 跳过: ${stats.skippedRequests}`);
    console.log(`    - 失败: ${stats.failedRequests}`);

    if (stats.errors.length > 0) {
      console.log("\n错误详情:");
      for (const error of stats.errors) {
        console.log(`  [${error.type}] ${error.id}: ${error.message}`);
      }
    }

    if (values["dry-run"]) {
      console.log("\n注意: 这是模拟运行，没有实际写入数据库");
    }

    // 退出码
    const hasErrors = stats.failedDevices > 0 || stats.failedRequests > 0;
    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log("迁移失败", { error: message });
    process.exit(1);
  }
}

main();
