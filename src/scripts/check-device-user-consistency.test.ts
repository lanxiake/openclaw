/**
 * 数据一致性检查工具测试
 *
 * 注意: 由于 loadState 是内部函数,这里主要测试修复逻辑
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fixConsistency, printReport } from "../../scripts/check-device-user-consistency.js";
import * as connection from "../db/connection.js";
import type { ConsistencyReport } from "../../scripts/check-device-user-consistency.js";

describe("printReport", () => {
  it("应该正确打印一致性报告", () => {
    const report: ConsistencyReport = {
      totalDevicesInDb: 5,
      totalDevicesInPairing: 5,
      issues: [],
      isConsistent: true,
    };

    // 只验证函数不抛出错误
    expect(() => printReport(report)).not.toThrow();
  });

  it("应该正确打印包含问题的报告", () => {
    const report: ConsistencyReport = {
      totalDevicesInDb: 3,
      totalDevicesInPairing: 2,
      issues: [
        {
          type: "missing_in_pairing",
          deviceId: "device-001",
          userId: "user-1",
          details: "测试问题",
        },
      ],
      isConsistent: false,
    };

    expect(() => printReport(report)).not.toThrow();
  });
});

describe("fixConsistency", () => {
  const mockDb = {
    select: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(connection, "getDatabase").mockReturnValue(mockDb as any);
  });

  it("数据一致时不应该执行任何操作", async () => {
    const report: ConsistencyReport = {
      totalDevicesInDb: 1,
      totalDevicesInPairing: 1,
      issues: [],
      isConsistent: true,
    };

    await fixConsistency(report);

    expect(mockDb.delete).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("应该删除 missing_in_pairing 的设备", async () => {
    const report: ConsistencyReport = {
      totalDevicesInDb: 1,
      totalDevicesInPairing: 0,
      issues: [
        {
          type: "missing_in_pairing",
          deviceId: "device-001",
          userId: "user-1",
          details: "test",
        },
      ],
      isConsistent: false,
    };

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await fixConsistency(report);

    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("应该添加 missing_in_db 的设备", async () => {
    const report: ConsistencyReport = {
      totalDevicesInDb: 0,
      totalDevicesInPairing: 1,
      issues: [
        {
          type: "missing_in_db",
          deviceId: "device-001",
          userId: "user-1",
          details: "test",
        },
      ],
      isConsistent: false,
    };

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    await fixConsistency(report);

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("应该更新 user_id_mismatch 的设备", async () => {
    const report: ConsistencyReport = {
      totalDevicesInDb: 1,
      totalDevicesInPairing: 1,
      issues: [
        {
          type: "user_id_mismatch",
          deviceId: "device-001",
          dbUserId: "user-1",
          pairingUserId: "user-2",
          details: "test",
        },
      ],
      isConsistent: false,
    };

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await fixConsistency(report);

    expect(mockDb.update).toHaveBeenCalled();
  });

  it("应该删除孤立的设备记录", async () => {
    const report: ConsistencyReport = {
      totalDevicesInDb: 1,
      totalDevicesInPairing: 1,
      issues: [
        {
          type: "orphaned_device",
          deviceId: "device-001",
          userId: "user-1",
          details: "test",
        },
      ],
      isConsistent: false,
    };

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await fixConsistency(report);

    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("应该处理多个问题", async () => {
    const report: ConsistencyReport = {
      totalDevicesInDb: 2,
      totalDevicesInPairing: 2,
      issues: [
        {
          type: "missing_in_pairing",
          deviceId: "device-001",
          userId: "user-1",
          details: "test1",
        },
        {
          type: "missing_in_db",
          deviceId: "device-002",
          userId: "user-2",
          details: "test2",
        },
      ],
      isConsistent: false,
    };

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    await fixConsistency(report);

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});
