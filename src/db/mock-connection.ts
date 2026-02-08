/**
 * Mock 数据库连接模块
 *
 * 用于单元测试，无需真实 PostgreSQL 连接
 * 基于内存 Map 实现基本的 CRUD 操作
 */

import type { Database } from "./connection.js";

// 内存存储
const mockStorage = new Map<string, Map<string, unknown>>();

/**
 * 初始化 Mock 表
 *
 * @param tableName 表名
 */
function ensureTable(tableName: string): Map<string, unknown> {
  if (!mockStorage.has(tableName)) {
    mockStorage.set(tableName, new Map());
  }
  return mockStorage.get(tableName)!;
}

/**
 * 生成 Mock UUID
 */
function generateMockId(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 解析 Drizzle ORM 条件对象为过滤函数
 *
 * @param condition Drizzle 条件对象或函数
 * @returns 过滤函数
 */
function parseCondition(condition: unknown): (row: unknown) => boolean {
  // 如果已经是函数，直接返回
  if (typeof condition === "function") {
    return condition as (row: unknown) => boolean;
  }

  // 如果是 Drizzle 条件对象
  if (condition && typeof condition === "object") {
    const cond = condition as Record<string, unknown>;

    // 调试：打印条件对象结构（禁用，因为Drizzle对象有循环引用）
    // console.log("[mock-db] Parsing condition:", cond);

    // 处理 SQL 对象（Drizzle ORM 的内部结构）
    if (cond._) {
      const sql = cond._ as Record<string, unknown>;

      // 处理 eq 条件
      if (sql.brand === "SQL" && Array.isArray(sql.queryChunks)) {
        const chunks = sql.queryChunks as unknown[];

        // 查找列名和值
        let columnName: string | undefined;
        let value: unknown;

        for (const chunk of chunks) {
          if (chunk && typeof chunk === "object") {
            const chunkObj = chunk as Record<string, unknown>;

            // 列对象
            if (chunkObj._ && (chunkObj._ as Record<string, unknown>).name) {
              columnName = (chunkObj._ as Record<string, unknown>).name as string;
            }

            // 参数值
            if (chunkObj._ && (chunkObj._ as Record<string, unknown>).value !== undefined) {
              value = (chunkObj._ as Record<string, unknown>).value;
            }
          }
        }

        // 如果找到列名和值，创建相等比较函数
        if (columnName !== undefined) {
          const col = columnName;
          const val = value;

          // 检查操作符类型
          const sqlStr = chunks.join("");
          if (sqlStr.includes(">")) {
            return (row: unknown) => (row as Record<string, unknown>)[col] > val;
          } else if (sqlStr.includes("<")) {
            return (row: unknown) => (row as Record<string, unknown>)[col] < val;
          } else {
            // 默认是相等比较
            return (row: unknown) => (row as Record<string, unknown>)[col] === val;
          }
        }
      }

      // 处理 and 条件
      if (sql.brand === "And" && Array.isArray(sql.conditions)) {
        const parsedConditions = sql.conditions.map((c: unknown) => parseCondition(c));
        return (row: unknown) => parsedConditions.every((fn) => fn(row));
      }

      // 处理 or 条件
      if (sql.brand === "Or" && Array.isArray(sql.conditions)) {
        const parsedConditions = sql.conditions.map((c: unknown) => parseCondition(c));
        return (row: unknown) => parsedConditions.some((fn) => fn(row));
      }
    }

    // 旧的简单条件处理（向后兼容）
    // 处理 eq 条件 (例如: eq(users.id, "123"))
    if (cond.operator === "=" || cond.type === "eq") {
      const field = (cond.left as { name: string })?.name || (cond.column as { name: string })?.name;
      const value = cond.right || cond.value;
      return (row: unknown) => (row as Record<string, unknown>)[field] === value;
    }

    // 处理 and 条件
    if (cond.operator === "and" || cond.type === "and") {
      const conditions = (cond.conditions || cond.children || []) as unknown[];
      const parsedConditions = conditions.map(parseCondition);
      return (row: unknown) => parsedConditions.every((fn) => fn(row));
    }

    // 处理 or 条件
    if (cond.operator === "or" || cond.type === "or") {
      const conditions = (cond.conditions || cond.children || []) as unknown[];
      const parsedConditions = conditions.map(parseCondition);
      return (row: unknown) => parsedConditions.some((fn) => fn(row));
    }

    // 处理 gt 条件 (大于)
    if (cond.operator === ">" || cond.type === "gt") {
      const field = (cond.left as { name: string })?.name || (cond.column as { name: string })?.name;
      const value = cond.right || cond.value;
      return (row: unknown) => (row as Record<string, unknown>)[field] > value;
    }

    // 处理 lt 条件 (小于)
    if (cond.operator === "<" || cond.type === "lt") {
      const field = (cond.left as { name: string })?.name || (cond.column as { name: string })?.name;
      const value = cond.right || cond.value;
      return (row: unknown) => (row as Record<string, unknown>)[field] < value;
    }
  }

  // 默认返回总是为真的函数
  console.warn("[mock-db] Unknown condition type, returning true:", condition);
  return () => true;
}

/**
 * Mock 查询构建器
 *
 * 模拟 Drizzle ORM 的链式调用 API
 */
class MockQueryBuilder {
  private tableName: string;
  private whereConditions: Array<(row: unknown) => boolean> = [];
  private limitCount?: number;
  private offsetCount?: number;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  where(condition: unknown): this {
    this.whereConditions.push(parseCondition(condition));
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  offset(count: number): this {
    this.offsetCount = count;
    return this;
  }

  async execute(): Promise<unknown[]> {
    const table = ensureTable(this.tableName);
    let results = Array.from(table.values());

    // 应用 where 条件
    for (const condition of this.whereConditions) {
      results = results.filter(condition);
    }

    // 应用 offset
    if (this.offsetCount !== undefined) {
      results = results.slice(this.offsetCount);
    }

    // 应用 limit
    if (this.limitCount !== undefined) {
      results = results.slice(0, this.limitCount);
    }

    return results;
  }

  /**
   * 实现 Promise 接口，使构建器可以直接 await
   */
  then<TResult1 = unknown[], TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Mock Insert 构建器
 */
class MockInsertBuilder {
  private tableName: string;
  private data: unknown[] = [];
  private shouldReturn = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  values(data: unknown | unknown[]): this {
    this.data = Array.isArray(data) ? data : [data];
    return this;
  }

  returning(): this {
    this.shouldReturn = true;
    return this;
  }

  async execute(): Promise<unknown[]> {
    const table = ensureTable(this.tableName);
    const results: unknown[] = [];

    for (const item of this.data) {
      const record = {
        ...(item as object),
        id: (item as { id?: string }).id || generateMockId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      table.set(record.id, record);
      results.push(record);
    }

    return this.shouldReturn ? results : [];
  }

  /**
   * 实现 Promise 接口，使构建器可以直接 await
   */
  then<TResult1 = unknown[], TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Mock Update 构建器
 */
class MockUpdateBuilder {
  private tableName: string;
  private updateData: object = {};
  private whereConditions: Array<(row: unknown) => boolean> = [];
  private shouldReturn = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  set(data: object): this {
    this.updateData = data;
    return this;
  }

  where(condition: unknown): this {
    this.whereConditions.push(parseCondition(condition));
    return this;
  }

  returning(): this {
    this.shouldReturn = true;
    return this;
  }

  async execute(): Promise<unknown[]> {
    const table = ensureTable(this.tableName);
    const results: unknown[] = [];

    for (const [id, row] of table.entries()) {
      let matches = true;
      for (const condition of this.whereConditions) {
        if (!condition(row)) {
          matches = false;
          break;
        }
      }

      if (matches) {
        const updated = {
          ...(row as object),
          ...this.updateData,
          updatedAt: new Date(),
        };
        table.set(id, updated);
        results.push(updated);
      }
    }

    return this.shouldReturn ? results : [];
  }

  /**
   * 实现 Promise 接口，使构建器可以直接 await
   */
  then<TResult1 = unknown[], TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Mock Delete 构建器
 */
class MockDeleteBuilder {
  private tableName: string;
  private whereConditions: Array<(row: unknown) => boolean> = [];
  private shouldReturn = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  where(condition: unknown): this {
    this.whereConditions.push(parseCondition(condition));
    return this;
  }

  returning(): this {
    this.shouldReturn = true;
    return this;
  }

  async execute(): Promise<unknown[]> {
    const table = ensureTable(this.tableName);
    const results: unknown[] = [];

    for (const [id, row] of table.entries()) {
      let matches = true;
      for (const condition of this.whereConditions) {
        if (!condition(row)) {
          matches = false;
          break;
        }
      }

      if (matches) {
        results.push(row);
        table.delete(id);
      }
    }

    return this.shouldReturn ? results : [];
  }

  /**
   * 实现 Promise 接口，使构建器可以直接 await
   */
  then<TResult1 = unknown[], TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Mock 表代理
 *
 * 拦截对表的操作并返回相应的构建器
 */
function createTableProxy(tableName: string) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "findMany" || prop === "findFirst") {
          return () => new MockQueryBuilder(tableName);
        }
        return undefined;
      },
    }
  );
}

/**
 * Mock 数据库实例
 *
 * 模拟 Drizzle ORM 的 API
 */
export const mockDb = {
  select: (table?: { _: { name: string } }) => {
    const tableName = table?._?.name || "unknown";
    return {
      from: (_fromTable: { _: { name: string } }) =>
        new MockQueryBuilder(_fromTable._?.name || tableName),
    };
  },

  insert: (table: { _: { name: string } }) => {
    return new MockInsertBuilder(table._?.name || "unknown");
  },

  update: (table: { _: { name: string } }) => {
    return new MockUpdateBuilder(table._?.name || "unknown");
  },

  delete: (table: { _: { name: string } }) => {
    return new MockDeleteBuilder(table._?.name || "unknown");
  },

  query: new Proxy(
    {},
    {
      get(_target, tableName) {
        return createTableProxy(String(tableName));
      },
    }
  ),

  transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
    // Mock 事务直接执行回调
    return callback(mockDb);
  },
} as unknown as Database;

// Mock 状态管理
let useMock = false;
let realGetDatabase: (() => Database) | null = null;

/**
 * 启用 Mock 模式
 *
 * 在测试开始时调用
 */
export function enableMockDatabase(): void {
  useMock = true;
  console.log("[mock-db] Mock database enabled");
}

/**
 * 禁用 Mock 模式
 *
 * 在测试结束时调用
 */
export function disableMockDatabase(): void {
  useMock = false;
  console.log("[mock-db] Mock database disabled");
}

/**
 * 清空所有 Mock 数据
 *
 * 在每个测试用例之间调用
 */
export function clearMockDatabase(): void {
  mockStorage.clear();
  console.log("[mock-db] Mock database cleared");
}

/**
 * 获取 Mock 数据库实例
 *
 * 用于测试中替代真实数据库
 */
export function getMockDatabase(): Database {
  return mockDb;
}

/**
 * 检查是否启用 Mock 模式
 */
export function isMockEnabled(): boolean {
  return useMock;
}

/**
 * 向 Mock 表中插入测试数据
 *
 * @param tableName 表名
 * @param data 数据数组
 */
export function seedMockTable(tableName: string, data: unknown[]): void {
  const table = ensureTable(tableName);
  for (const item of data) {
    const record = item as { id?: string };
    const id = record.id || generateMockId();
    table.set(id, { ...record, id });
  }
  console.log(`[mock-db] Seeded ${data.length} records into ${tableName}`);
}

/**
 * 获取 Mock 表中的所有数据
 *
 * @param tableName 表名
 * @returns 数据数组
 */
export function getMockTableData(tableName: string): unknown[] {
  const table = mockStorage.get(tableName);
  return table ? Array.from(table.values()) : [];
}

/**
 * 获取 Mock 表中的记录数
 *
 * @param tableName 表名
 * @returns 记录数
 */
export function getMockTableCount(tableName: string): number {
  const table = mockStorage.get(tableName);
  return table ? table.size : 0;
}
