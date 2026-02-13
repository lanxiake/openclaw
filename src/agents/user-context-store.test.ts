/**
 * user-context-store.ts 单元测试
 *
 * 测试 AsyncLocalStorage 用户上下文存储功能
 */

import { describe, it, expect } from "vitest";
import {
  getUserContext,
  runWithUserContext,
  runWithUserContextAsync,
} from "./user-context-store.js";
import type { UserAgentContext } from "./user-context.js";

/**
 * 创建测试用的用户上下文
 */
function createTestUserContext(userId: string): UserAgentContext {
  return {
    userId,
    isDefaultUser: false,
    devices: [],
    assistantConfig: undefined,
    quotas: [],
    loadedAt: new Date(),
  };
}

describe("user-context-store", () => {
  describe("getUserContext", () => {
    it("应该在无上下文时返回 undefined", () => {
      const result = getUserContext();
      expect(result).toBeUndefined();
    });

    it("应该在上下文中返回正确的用户上下文", () => {
      const context = createTestUserContext("user-123");

      const result = runWithUserContext(context, () => {
        return getUserContext();
      });

      expect(result).toBeDefined();
      expect(result?.userId).toBe("user-123");
    });
  });

  describe("runWithUserContext", () => {
    it("应该在上下文中运行同步函数", () => {
      const context = createTestUserContext("user-456");

      const result = runWithUserContext(context, () => {
        const ctx = getUserContext();
        return ctx?.userId;
      });

      expect(result).toBe("user-456");
    });

    it("应该正确返回函数的返回值", () => {
      const context = createTestUserContext("user-789");

      const result = runWithUserContext(context, () => {
        return { value: 42, message: "test" };
      });

      expect(result).toEqual({ value: 42, message: "test" });
    });

    it("应该在函数执行后清除上下文", () => {
      const context = createTestUserContext("user-temp");

      runWithUserContext(context, () => {
        expect(getUserContext()?.userId).toBe("user-temp");
      });

      // 函数执行后，上下文应该被清除
      expect(getUserContext()).toBeUndefined();
    });

    it("应该支持嵌套上下文", () => {
      const outerContext = createTestUserContext("outer-user");
      const innerContext = createTestUserContext("inner-user");

      runWithUserContext(outerContext, () => {
        expect(getUserContext()?.userId).toBe("outer-user");

        runWithUserContext(innerContext, () => {
          expect(getUserContext()?.userId).toBe("inner-user");
        });

        // 内层上下文结束后，应该恢复外层上下文
        expect(getUserContext()?.userId).toBe("outer-user");
      });
    });
  });

  describe("runWithUserContextAsync", () => {
    it("应该在上下文中运行异步函数", async () => {
      const context = createTestUserContext("async-user");

      const result = await runWithUserContextAsync(context, async () => {
        // 模拟异步操作
        await new Promise((resolve) => setTimeout(resolve, 10));
        const ctx = getUserContext();
        return ctx?.userId;
      });

      expect(result).toBe("async-user");
    });

    it("应该正确返回异步函数的返回值", async () => {
      const context = createTestUserContext("async-user-2");

      const result = await runWithUserContextAsync(context, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { async: true, value: 100 };
      });

      expect(result).toEqual({ async: true, value: 100 });
    });

    it("应该在异步函数执行后清除上下文", async () => {
      const context = createTestUserContext("async-temp");

      await runWithUserContextAsync(context, async () => {
        expect(getUserContext()?.userId).toBe("async-temp");
        await new Promise((resolve) => setTimeout(resolve, 5));
      });

      // 函数执行后，上下文应该被清除
      expect(getUserContext()).toBeUndefined();
    });

    it("应该在异步操作中保持上下文", async () => {
      const context = createTestUserContext("persistent-user");

      await runWithUserContextAsync(context, async () => {
        expect(getUserContext()?.userId).toBe("persistent-user");

        // 第一次异步操作
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(getUserContext()?.userId).toBe("persistent-user");

        // 第二次异步操作
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(getUserContext()?.userId).toBe("persistent-user");
      });
    });

    it("应该支持嵌套异步上下文", async () => {
      const outerContext = createTestUserContext("async-outer");
      const innerContext = createTestUserContext("async-inner");

      await runWithUserContextAsync(outerContext, async () => {
        expect(getUserContext()?.userId).toBe("async-outer");

        await runWithUserContextAsync(innerContext, async () => {
          expect(getUserContext()?.userId).toBe("async-inner");
          await new Promise((resolve) => setTimeout(resolve, 5));
          expect(getUserContext()?.userId).toBe("async-inner");
        });

        // 内层上下文结束后，应该恢复外层上下文
        expect(getUserContext()?.userId).toBe("async-outer");
      });
    });

    it("应该正确处理异步函数中的错误", async () => {
      const context = createTestUserContext("error-user");

      await expect(
        runWithUserContextAsync(context, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          throw new Error("Test error");
        }),
      ).rejects.toThrow("Test error");

      // 错误后上下文应该被清除
      expect(getUserContext()).toBeUndefined();
    });
  });

  describe("并发场景", () => {
    it("应该在并发异步操作中隔离上下文", async () => {
      const context1 = createTestUserContext("concurrent-1");
      const context2 = createTestUserContext("concurrent-2");

      const results = await Promise.all([
        runWithUserContextAsync(context1, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return getUserContext()?.userId;
        }),
        runWithUserContextAsync(context2, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return getUserContext()?.userId;
        }),
      ]);

      expect(results[0]).toBe("concurrent-1");
      expect(results[1]).toBe("concurrent-2");
    });

    it("应该在多个并发操作中保持各自的上下文", async () => {
      const contexts = Array.from({ length: 5 }, (_, i) =>
        createTestUserContext(`concurrent-user-${i}`),
      );

      const results = await Promise.all(
        contexts.map((ctx, i) =>
          runWithUserContextAsync(ctx, async () => {
            // 随机延迟以模拟真实场景
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
            const currentCtx = getUserContext();
            return {
              expected: `concurrent-user-${i}`,
              actual: currentCtx?.userId,
            };
          }),
        ),
      );

      for (const result of results) {
        expect(result.actual).toBe(result.expected);
      }
    });
  });
});
