/**
 * 用户上下文存储
 *
 * 使用 AsyncLocalStorage 在异步调用链中传递用户上下文，
 * 使工具执行时可以访问当前用户的权限信息
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { UserAgentContext } from "./user-context.js";

/**
 * 用户上下文的 AsyncLocalStorage 实例
 *
 * 用于在 Agent 运行期间存储和访问用户上下文
 */
const userContextStorage = new AsyncLocalStorage<UserAgentContext>();

/**
 * 获取当前异步上下文中的用户上下文
 *
 * @returns 用户上下文，如果不在上下文中则返回 undefined
 */
export function getUserContext(): UserAgentContext | undefined {
  return userContextStorage.getStore();
}

/**
 * 在指定的用户上下文中运行函数
 *
 * @param context - 用户上下文
 * @param fn - 要运行的函数
 * @returns 函数的返回值
 */
export function runWithUserContext<T>(context: UserAgentContext, fn: () => T): T {
  return userContextStorage.run(context, fn);
}

/**
 * 在指定的用户上下文中运行异步函数
 *
 * @param context - 用户上下文
 * @param fn - 要运行的异步函数
 * @returns Promise，解析为函数的返回值
 */
export async function runWithUserContextAsync<T>(
  context: UserAgentContext,
  fn: () => Promise<T>,
): Promise<T> {
  return userContextStorage.run(context, fn);
}
