/**
 * Redis Session 缓存模块测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis
const mockPipeline = {
  setex: vi.fn().mockReturnThis(),
  sadd: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  del: vi.fn().mockReturnThis(),
  srem: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
};

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  ttl: vi.fn(),
  expire: vi.fn(),
  exists: vi.fn(),
  smembers: vi.fn(),
  mget: vi.fn(),
  pipeline: vi.fn().mockReturnValue(mockPipeline),
};

vi.mock("./connection.js", () => ({
  getRedis: () => mockRedis,
}));

vi.mock("../../logging/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  cacheSession,
  getCachedSession,
  touchSession,
  deleteCachedSession,
  getUserSessionIds,
  revokeAllUserSessions,
  sessionExists,
  getSessionTTL,
  extendSessionTTL,
  type CachedSession,
} from "./session-cache.js";

describe("Session Cache", () => {
  const testSession: CachedSession = {
    sessionId: "test-session-123",
    userId: "user-456",
    deviceId: "device-789",
    role: "user",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastActiveAt: new Date().toISOString(),
    ipAddress: "127.0.0.1",
    userAgent: "Test Agent",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cacheSession", () => {
    it("应该缓存会话", async () => {
      await cacheSession(testSession);

      expect(mockPipeline.setex).toHaveBeenCalled();
      expect(mockPipeline.sadd).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it("应该使用自定义 TTL", async () => {
      await cacheSession(testSession, 3600);

      expect(mockPipeline.setex).toHaveBeenCalled();
    });
  });

  describe("getCachedSession", () => {
    it("应该返回缓存的会话", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(testSession));

      const result = await getCachedSession(testSession.sessionId);

      expect(result).toEqual(testSession);
    });

    it("会话不存在时应返回 null", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getCachedSession("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("touchSession", () => {
    it("应该更新会话最后活动时间", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(testSession));
      mockRedis.ttl.mockResolvedValue(3600);
      mockRedis.setex.mockResolvedValue("OK");

      const result = await touchSession(testSession.sessionId);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it("会话不存在时应返回 false", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await touchSession("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("deleteCachedSession", () => {
    it("应该删除会话", async () => {
      await deleteCachedSession(testSession.sessionId, testSession.userId);

      expect(mockPipeline.del).toHaveBeenCalled();
      expect(mockPipeline.srem).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe("getUserSessionIds", () => {
    it("应该返回用户的所有会话 ID", async () => {
      const sessionIds = ["session-1", "session-2", "session-3"];
      mockRedis.smembers.mockResolvedValue(sessionIds);

      const result = await getUserSessionIds(testSession.userId);

      expect(result).toEqual(sessionIds);
    });

    it("无会话时应返回空数组", async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const result = await getUserSessionIds(testSession.userId);

      expect(result).toEqual([]);
    });
  });

  describe("revokeAllUserSessions", () => {
    it("应该吊销用户的所有会话", async () => {
      mockRedis.smembers.mockResolvedValue(["session-1", "session-2"]);

      const count = await revokeAllUserSessions(testSession.userId);

      expect(count).toBe(2);
      expect(mockPipeline.del).toHaveBeenCalledTimes(3); // 2 sessions + 1 user set
    });

    it("无会话时应返回 0", async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const count = await revokeAllUserSessions(testSession.userId);

      expect(count).toBe(0);
    });
  });

  describe("sessionExists", () => {
    it("会话存在时应返回 true", async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await sessionExists(testSession.sessionId);

      expect(result).toBe(true);
    });

    it("会话不存在时应返回 false", async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await sessionExists("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("getSessionTTL", () => {
    it("应该返回会话 TTL", async () => {
      mockRedis.ttl.mockResolvedValue(3600);

      const ttl = await getSessionTTL(testSession.sessionId);

      expect(ttl).toBe(3600);
    });
  });

  describe("extendSessionTTL", () => {
    it("应该延长会话 TTL", async () => {
      mockRedis.expire.mockResolvedValue(1);

      const result = await extendSessionTTL(testSession.sessionId, 7200);

      expect(result).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.stringContaining(testSession.sessionId),
        7200,
      );
    });
  });
});
