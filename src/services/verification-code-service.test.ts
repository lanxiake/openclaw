/**
 * 验证码服务单元测试
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  sendVerificationCode,
  verifyCode,
  cleanupExpiredCodes,
  type TargetType,
  type VerificationPurpose,
} from "./verification-code-service.js";

// Mock getDatabase
vi.mock("../db/connection.js", () => ({
  getDatabase: vi.fn(() => ({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "test-id", code: "123456" }])),
      })),
    })),
    query: {
      verificationCodes: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  })),
}));

// Mock logger
vi.mock("../logging/logger.js", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe("verification-code-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendVerificationCode", () => {
    it("应该成功发送验证码", async () => {
      const result = await sendVerificationCode(
