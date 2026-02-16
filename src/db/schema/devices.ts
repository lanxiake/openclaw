/**
 * 设备表 Schema
 *
 * 统一存储设备信息 (PostgreSQL)
 */

import { pgTable, text, timestamp, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { users } from "./users.js";

/**
 * 设备认证令牌类型
 */
export interface DeviceAuthToken {
  /** 令牌值 */
  token: string;
  /** 角色 */
  role: string;
  /** 权限范围 */
  scopes: string[];
  /** 创建时间 (ms) */
  createdAtMs: number;
  /** 轮换时间 (ms) */
  rotatedAtMs?: number;
  /** 撤销时间 (ms) */
  revokedAtMs?: number;
  /** 最后使用时间 (ms) */
  lastUsedAtMs?: number;
}

/**
 * 设备平台枚举
 */
export type DevicePlatform = "iOS" | "Android" | "macOS" | "Windows" | "Web" | "Linux";

/**
 * 配对请求状态枚举
 */
export type PairingRequestStatus = "pending" | "approved" | "rejected" | "expired";

/**
 * 设备表
 *
 * 存储已配对的设备信息
 */
export const devices = pgTable(
  "devices",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 设备 ID (唯一标识) */
    deviceId: text("device_id").notNull(),
    /** 设备公钥 */
    publicKey: text("public_key").notNull(),
    /** 所属用户 ID (外键，可为空表示未关联用户) */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** 设备名称 */
    displayName: text("display_name"),
    /** 平台 */
    platform: text("platform").$type<DevicePlatform>(),
    /** 客户端 ID */
    clientId: text("client_id"),
    /** 客户端模式 */
    clientMode: text("client_mode"),
    /** 角色 */
    role: text("role"),
    /** 角色列表 (支持多角色) */
    roles: jsonb("roles").$type<string[]>(),
    /** 权限范围 */
    scopes: jsonb("scopes").$type<string[]>(),
    /** 认证令牌 (JSON, 按角色存储) */
    tokens: jsonb("tokens").$type<Record<string, DeviceAuthToken>>(),
    /** 设备指纹 */
    fingerprint: text("fingerprint"),
    /** 远程 IP */
    remoteIp: text("remote_ip"),
    /** 是否激活 */
    isActive: boolean("is_active").default(true).notNull(),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 批准时间 */
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull(),
    /** 最后活跃时间 */
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    /** 撤销时间 */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    // 唯一索引: deviceId
    uniqueIndex("devices_device_id_unique_idx").on(table.deviceId),
    // 索引: userId
    index("devices_user_id_idx").on(table.userId),
    // 索引: 激活状态
    index("devices_is_active_idx").on(table.isActive),
    // 索引: 创建时间
    index("devices_created_at_idx").on(table.createdAt),
  ],
);

/**
 * 设备配对请求表
 *
 * 存储待处理的配对请求
 */
export const devicePairingRequests = pgTable(
  "device_pairing_requests",
  {
    /** 主键 UUID */
    id: text("id").primaryKey(),
    /** 请求 ID (唯一) */
    requestId: text("request_id").notNull().unique(),
    /** 设备 ID */
    deviceId: text("device_id").notNull(),
    /** 设备公钥 */
    publicKey: text("public_key").notNull(),
    /** 发起用户 ID (可为空) */
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** 设备名称 */
    displayName: text("display_name"),
    /** 平台 */
    platform: text("platform").$type<DevicePlatform>(),
    /** 客户端 ID */
    clientId: text("client_id"),
    /** 客户端模式 */
    clientMode: text("client_mode"),
    /** 请求角色 */
    requestedRole: text("requested_role"),
    /** 请求权限 */
    requestedScopes: jsonb("requested_scopes").$type<string[]>(),
    /** 远程 IP */
    remoteIp: text("remote_ip"),
    /** 是否静默配对 */
    silent: boolean("silent").default(false),
    /** 是否为重新配对 */
    isRepair: boolean("is_repair").default(false),
    /** 状态 */
    status: text("status").$type<PairingRequestStatus>().default("pending").notNull(),
    /** 批准/拒绝原因 */
    reason: text("reason"),
    /** 批准者 ID */
    approvedBy: text("approved_by"),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** 过期时间 */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** 处理时间 */
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    // 索引: userId
    index("device_pairing_requests_user_id_idx").on(table.userId),
    // 索引: 状态
    index("device_pairing_requests_status_idx").on(table.status),
    // 索引: 过期时间
    index("device_pairing_requests_expires_at_idx").on(table.expiresAt),
    // 索引: deviceId
    index("device_pairing_requests_device_id_idx").on(table.deviceId),
  ],
);

/**
 * 设备表关系定义
 */
export const devicesRelations = relations(devices, ({ one }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
}));

/**
 * 设备配对请求表关系定义
 */
export const devicePairingRequestsRelations = relations(devicePairingRequests, ({ one }) => ({
  user: one(users, {
    fields: [devicePairingRequests.userId],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertDeviceSchema = createInsertSchema(devices);
export const selectDeviceSchema = createSelectSchema(devices);
export const insertDevicePairingRequestSchema = createInsertSchema(devicePairingRequests);
export const selectDevicePairingRequestSchema = createSelectSchema(devicePairingRequests);

// 类型导出
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type DevicePairingRequest = typeof devicePairingRequests.$inferSelect;
export type NewDevicePairingRequest = typeof devicePairingRequests.$inferInsert;
