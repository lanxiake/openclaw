/**
 * 数据一致性检查工具
 *
 * 检查 user_devices 表和 device-pairing.json 文件之间的一致性
 * 检测问题:
 * 1. user_devices 中存在但 device-pairing 中不存在的设备
 * 2. device-pairing 中存在但 user_devices 中不存在的设备
 * 3. userId 不匹配的设备
 * 4. 孤立的 user_devices 记录(用户不存在)
 */

import { getDatabase } from "../src/db/connection.js";
import { userDevices, users } from "../src/db/schema/users.js";
import { eq, inArray } from "drizzle-orm";
import { loadState } from "../src/infra/device-pairing.js";
import type { PairedDevice } from "../src/infra/device-pairing.js";

export interface ConsistencyIssue {
  type:
    | "missing_in_pairing"
    | "missing_in_db"
    | "user_id_mismatch"
    | "orphaned_device"
    | "user_not_found";
  deviceId: string;
  userId?: string;
  dbUserId?: string;
  pairingUserId?: string;
  details: string;
}

export interface ConsistencyReport {
  totalDevicesInDb: number;
  totalDevicesInPairing: number;
  issues: ConsistencyIssue[];
  isConsistent: boolean;
}

/**
 * 检查数据一致性
 */
export async function checkConsistency(baseDir?: string): Promise<ConsistencyReport> {
  console.log("开始检查数据一致性...\n");

  const db = getDatabase();
  const issues: ConsistencyIssue[] = [];

  // 1. 加载 device-pairing 数据
  console.log("加载 device-pairing 数据...");
  const pairingState = await loadState(baseDir);
  const pairingDevices: Map<string, PairedDevice> = new Map(
    Object.entries(pairingState.pairedByDeviceId),
  );
  console.log(`找到 ${pairingDevices.size} 个已配对设备\n`);

  // 2. 加载数据库中的 user_devices 数据
  console.log("加载数据库中的 user_devices 数据...");
  const dbDevices = await db.select().from(userDevices);
  console.log(`找到 ${dbDevices.length} 条 user_devices 记录\n`);

  // 3. 检查 user_devices 中的设备是否在 device-pairing 中存在
  console.log("检查 user_devices 中的设备...");
  for (const dbDevice of dbDevices) {
    const pairingDevice = pairingDevices.get(dbDevice.deviceId);

    if (!pairingDevice) {
      // 设备在数据库中但不在 device-pairing 中
      issues.push({
        type: "missing_in_pairing",
        deviceId: dbDevice.deviceId,
        userId: dbDevice.userId,
        details: `设备 ${dbDevice.deviceId} 在 user_devices 表中存在,但在 device-pairing 中不存在`,
      });
    } else if (pairingDevice.userId && pairingDevice.userId !== dbDevice.userId) {
      // userId 不匹配
      issues.push({
        type: "user_id_mismatch",
        deviceId: dbDevice.deviceId,
        dbUserId: dbDevice.userId,
        pairingUserId: pairingDevice.userId,
        details: `设备 ${dbDevice.deviceId} 的 userId 不匹配: DB=${dbDevice.userId}, Pairing=${pairingDevice.userId}`,
      });
    }
  }

  // 4. 检查 device-pairing 中的设备是否在 user_devices 中存在
  console.log("检查 device-pairing 中的设备...");
  const dbDeviceIds = new Set(dbDevices.map((d) => d.deviceId));
  for (const [deviceId, pairingDevice] of pairingDevices) {
    if (pairingDevice.userId && !dbDeviceIds.has(deviceId)) {
      // 设备在 device-pairing 中有 userId,但不在数据库中
      issues.push({
        type: "missing_in_db",
        deviceId,
        userId: pairingDevice.userId,
        details: `设备 ${deviceId} 在 device-pairing 中有 userId (${pairingDevice.userId}),但在 user_devices 表中不存在`,
      });
    }
  }

  // 5. 检查孤立的 user_devices 记录(用户不存在)
  console.log("检查孤立的 user_devices 记录...");
  const userIds = [...new Set(dbDevices.map((d) => d.userId))];
  if (userIds.length > 0) {
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, userIds));
    const existingUserIds = new Set(existingUsers.map((u) => u.id));

    for (const dbDevice of dbDevices) {
      if (!existingUserIds.has(dbDevice.userId)) {
        issues.push({
          type: "orphaned_device",
          deviceId: dbDevice.deviceId,
          userId: dbDevice.userId,
          details: `设备 ${dbDevice.deviceId} 关联的用户 ${dbDevice.userId} 不存在`,
        });
      }
    }
  }

  // 6. 生成报告
  const report: ConsistencyReport = {
    totalDevicesInDb: dbDevices.length,
    totalDevicesInPairing: pairingDevices.size,
    issues,
    isConsistent: issues.length === 0,
  };

  return report;
}

/**
 * 打印一致性报告
 */
export function printReport(report: ConsistencyReport): void {
  console.log("\n========== 数据一致性检查报告 ==========\n");
  console.log(`数据库中的设备数: ${report.totalDevicesInDb}`);
  console.log(`device-pairing 中的设备数: ${report.totalDevicesInPairing}`);
  console.log(`发现的问题数: ${report.issues.length}\n`);

  if (report.isConsistent) {
    console.log("✅ 数据一致性检查通过,未发现问题!\n");
    return;
  }

  console.log("❌ 发现以下问题:\n");

  // 按类型分组显示问题
  const issuesByType = new Map<string, ConsistencyIssue[]>();
  for (const issue of report.issues) {
    const issues = issuesByType.get(issue.type) || [];
    issues.push(issue);
    issuesByType.set(issue.type, issues);
  }

  const typeLabels: Record<string, string> = {
    missing_in_pairing: "设备在数据库中但不在 device-pairing 中",
    missing_in_db: "设备在 device-pairing 中但不在数据库中",
    user_id_mismatch: "userId 不匹配",
    orphaned_device: "孤立的设备记录(用户不存在)",
    user_not_found: "用户不存在",
  };

  for (const [type, issues] of issuesByType) {
    console.log(`\n【${typeLabels[type]}】(${issues.length} 个)`);
    for (const issue of issues) {
      console.log(`  - ${issue.details}`);
    }
  }

  console.log("\n========================================\n");
}

/**
 * 修复数据一致性问题
 *
 * 修复策略:
 * 1. missing_in_pairing: 从数据库中删除(因为 device-pairing 是权威数据源)
 * 2. missing_in_db: 从 device-pairing 同步到数据库
 * 3. user_id_mismatch: 以 device-pairing 为准更新数据库
 * 4. orphaned_device: 从数据库中删除
 */
export async function fixConsistency(
  report: ConsistencyReport,
  baseDir?: string,
): Promise<void> {
  if (report.isConsistent) {
    console.log("数据一致,无需修复");
    return;
  }

  console.log("\n开始修复数据一致性问题...\n");

  const db = getDatabase();
  let fixedCount = 0;

  for (const issue of report.issues) {
    try {
      switch (issue.type) {
        case "missing_in_pairing":
        case "orphaned_device":
          // 从数据库中删除
          console.log(`删除数据库中的设备记录: ${issue.deviceId}`);
          await db.delete(userDevices).where(eq(userDevices.deviceId, issue.deviceId));
          fixedCount++;
          break;

        case "missing_in_db":
          // 从 device-pairing 同步到数据库
          if (issue.userId) {
            console.log(`添加设备到数据库: ${issue.deviceId} -> ${issue.userId}`);
            await db.insert(userDevices).values({
              id: crypto.randomUUID(),
              userId: issue.userId,
              deviceId: issue.deviceId,
              linkedAt: new Date(),
            });
            fixedCount++;
          }
          break;

        case "user_id_mismatch":
          // 以 device-pairing 为准更新数据库
          if (issue.pairingUserId) {
            console.log(
              `更新设备的 userId: ${issue.deviceId} -> ${issue.pairingUserId}`,
            );
            await db
              .update(userDevices)
              .set({ userId: issue.pairingUserId })
              .where(eq(userDevices.deviceId, issue.deviceId));
            fixedCount++;
          }
          break;
      }
    } catch (error) {
      console.error(`修复失败: ${issue.deviceId}`, error);
    }
  }

  console.log(`\n✅ 修复完成,共修复 ${fixedCount} 个问题\n`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes("--fix");
  const baseDir = args.find((arg) => arg.startsWith("--base-dir="))?.split("=")[1];

  try {
    // 检查一致性
    const report = await checkConsistency(baseDir);
    printReport(report);

    // 如果指定了 --fix 参数,则执行修复
    if (shouldFix && !report.isConsistent) {
      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question("是否执行修复? (yes/no): ", resolve);
      });
      rl.close();

      if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
        await fixConsistency(report, baseDir);

        // 再次检查
        console.log("\n重新检查数据一致性...");
        const newReport = await checkConsistency(baseDir);
        printReport(newReport);
      } else {
        console.log("取消修复");
      }
    }

    process.exit(report.isConsistent ? 0 : 1);
  } catch (error) {
    console.error("执行失败:", error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
