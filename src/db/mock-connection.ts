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
 * 判断对象是否为 Drizzle SQL 对象
 *
 * SQL 对象拥有 queryChunks 数组
 */
function isDrizzleSQL(obj: unknown): obj is { queryChunks: unknown[] } {
  return (
    obj !== null &&
    typeof obj === "object" &&
    Array.isArray((obj as Record<string, unknown>).queryChunks)
  );
}

/**
 * 判断对象是否为 Drizzle StringChunk
 *
 * StringChunk 的 value 是字符串数组
 */
function isStringChunk(obj: unknown): obj is { value: string[] } {
  if (!obj || typeof obj !== "object") return false;
  const val = (obj as Record<string, unknown>).value;
  return Array.isArray(val) && val.every((v) => typeof v === "string");
}

/**
 * 判断对象是否为 Drizzle Column（PgText, PgBoolean 等）
 *
 * Column 有 name, table, columnType 属性
 */
function isDrizzleColumn(obj: unknown): obj is { name: string; table: Record<string, unknown> } {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return typeof o.name === "string" && typeof o.columnType === "string";
}

/**
 * 判断对象是否为 Drizzle Param
 *
 * Param 有 value 标量 + brand 属性
 */
function isDrizzleParam(obj: unknown): obj is { value: unknown; brand: string } {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return "value" in o && "brand" in o && "encoder" in o;
}

/**
 * 从 queryChunks 中提取操作符字符串
 *
 * 例如 eq -> " = ", gt -> " > ", lt -> " < "
 */
function extractOperator(chunks: unknown[]): string | null {
  for (const chunk of chunks) {
    if (isStringChunk(chunk)) {
      const text = chunk.value.join("");
      const trimmed = text.trim();
      if (
        trimmed === "=" ||
        trimmed === ">" ||
        trimmed === "<" ||
        trimmed === ">=" ||
        trimmed === "<=" ||
        trimmed === "!="
      ) {
        return trimmed;
      }
    }
  }
  return null;
}

/**
 * 从 queryChunks 中提取列名
 */
function extractColumnName(chunks: unknown[]): string | null {
  for (const chunk of chunks) {
    if (isDrizzleColumn(chunk)) {
      return chunk.name;
    }
  }
  return null;
}

/**
 * 从 queryChunks 中提取参数值
 */
function extractParamValue(chunks: unknown[]): { found: boolean; value: unknown } {
  for (const chunk of chunks) {
    if (isDrizzleParam(chunk)) {
      return { found: true, value: chunk.value };
    }
  }
  return { found: false, value: undefined };
}

/**
 * 在 Mock 数据中查找列值时，需要同时检查 snake_case 和 camelCase 的列名
 *
 * Drizzle schema 定义的 name 是 snake_case (数据库列名)
 * 但 Mock 插入数据时使用 camelCase (JS 对象属性名)
 */
function getRowValue(row: Record<string, unknown>, columnName: string): unknown {
  // 先直接尝试
  if (columnName in row) return row[columnName];

  // 尝试 snake_case -> camelCase 转换
  const camelCase = columnName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (camelCase in row) return row[camelCase];

  // 尝试 camelCase -> snake_case 转换
  const snakeCase = columnName.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
  if (snakeCase in row) return row[snakeCase];

  return undefined;
}

/**
 * 比较两个值，支持 Date 对象比较
 */
function compareValues(a: unknown, b: unknown, op: string): boolean {
  // 处理 Date 比较
  const aTime = a instanceof Date ? a.getTime() : a;
  const bTime = b instanceof Date ? b.getTime() : b;
  // 处理日期字符串
  const aNum = typeof aTime === "string" && !isNaN(Date.parse(aTime)) ? Date.parse(aTime) : aTime;
  const bNum = typeof bTime === "string" && !isNaN(Date.parse(bTime)) ? Date.parse(bTime) : bTime;

  switch (op) {
    case "=":
      return aNum === bNum;
    case ">":
      return (aNum as number) > (bNum as number);
    case "<":
      return (aNum as number) < (bNum as number);
    case ">=":
      return (aNum as number) >= (bNum as number);
    case "<=":
      return (aNum as number) <= (bNum as number);
    case "!=":
      return aNum !== bNum;
    default:
      return aNum === bNum;
  }
}

/**
 * 解析 Drizzle ORM 条件对象为过滤函数
 *
 * Drizzle ORM 条件对象结构:
 * - eq(col, val): SQL { queryChunks: [StringChunk(""), Column, StringChunk(" = "), Param, StringChunk("")] }
 * - gt(col, val): SQL { queryChunks: [StringChunk(""), Column, StringChunk(" > "), Param, StringChunk("")] }
 * - and(...): SQL { queryChunks: [StringChunk("("), SQL { queryChunks: [eq1, StringChunk(" and "), eq2, ...] }, StringChunk(")")] }
 * - or(...):  SQL { queryChunks: [StringChunk("("), SQL { queryChunks: [eq1, StringChunk(" or "), eq2, ...] }, StringChunk(")")] }
 *
 * @param condition Drizzle 条件对象或函数
 * @returns 过滤函数
 */
function parseCondition(condition: unknown): (row: unknown) => boolean {
  // 如果已经是函数，直接返回
  if (typeof condition === "function") {
    return condition as (row: unknown) => boolean;
  }

  // 必须是 Drizzle SQL 对象
  if (!isDrizzleSQL(condition)) {
    console.warn("[mock-db] 非 SQL 对象，返回 true");
    return () => true;
  }

  const chunks = condition.queryChunks;

  // 尝试解析为简单比较 (eq, gt, lt 等)
  // 结构: [StringChunk, Column, StringChunk(op), Param, StringChunk]
  const columnName = extractColumnName(chunks);
  const operator = extractOperator(chunks);
  const param = extractParamValue(chunks);

  if (columnName && operator && param.found) {
    const col = columnName;
    const val = param.value;
    const op = operator;
    return (row: unknown) => {
      const rowObj = row as Record<string, unknown>;
      const rowVal = getRowValue(rowObj, col);
      return compareValues(rowVal, val, op);
    };
  }

  // 尝试解析为 and/or 复合条件
  // 结构: [StringChunk("("), SQL(内部), StringChunk(")")]
  if (chunks.length === 3 && isStringChunk(chunks[0]) && isStringChunk(chunks[2])) {
    const openParen = (chunks[0] as { value: string[] }).value.join("");
    const closeParen = (chunks[2] as { value: string[] }).value.join("");

    if (openParen === "(" && closeParen === ")" && isDrizzleSQL(chunks[1])) {
      const innerChunks = (chunks[1] as { queryChunks: unknown[] }).queryChunks;

      // 从内部 chunks 中分离子条件和逻辑操作符
      let logicOp: "and" | "or" | null = null;
      const subConditions: unknown[] = [];

      for (const innerChunk of innerChunks) {
        if (isStringChunk(innerChunk)) {
          const text = (innerChunk as { value: string[] }).value.join("").trim();
          if (text === "and") logicOp = "and";
          else if (text === "or") logicOp = "or";
        } else if (isDrizzleSQL(innerChunk)) {
          subConditions.push(innerChunk);
        }
      }

      if (subConditions.length > 0 && logicOp) {
        const parsedSubs = subConditions.map((sub) => parseCondition(sub));
        if (logicOp === "and") {
          return (row: unknown) => parsedSubs.every((fn) => fn(row));
        }
        return (row: unknown) => parsedSubs.some((fn) => fn(row));
      }
    }
  }

  // 如果上面都没匹配，尝试遍历 queryChunks 找嵌套 SQL 条件
  // 处理一些特殊的 Drizzle 表达式（如 sql`` 模板）
  const nestedConditions: Array<(row: unknown) => boolean> = [];
  for (const chunk of chunks) {
    if (isDrizzleSQL(chunk)) {
      nestedConditions.push(parseCondition(chunk));
    }
  }
  if (nestedConditions.length === 1) {
    return nestedConditions[0];
  }
  if (nestedConditions.length > 1) {
    return (row: unknown) => nestedConditions.every((fn) => fn(row));
  }

  // 默认返回总是为真的函数
  console.warn("[mock-db] 无法解析条件，返回 true");
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

  /**
   * Mock orderBy 方法
   *
   * Mock 环境下不做实际排序，仅保持链式调用
   */
  orderBy(..._args: unknown[]): this {
    return this;
  }

  async execute(): Promise<unknown[]> {
    const table = ensureTable(this.tableName);
    let results = Array.from(table.values());

    // 应用 where 条件
    for (const condition of this.whereConditions) {
      results = results.filter(condition);
    }

    // 检查是否为聚合查询（字段映射包含 count 等聚合字段）
    const fieldsMapping = (this as unknown as Record<string, unknown>).__fieldsMapping;
    if (fieldsMapping && typeof fieldsMapping === "object") {
      const mapping = fieldsMapping as Record<string, unknown>;
      const aggregated: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(mapping)) {
        // 检测是否为 count(*) 类型的 SQL 聚合
        if (isDrizzleSQL(value)) {
          const chunks = (value as { queryChunks: unknown[] }).queryChunks;
          const sqlText = chunks
            .filter(isStringChunk)
            .map((c) => (c as { value: string[] }).value.join(""))
            .join("");
          if (sqlText.toLowerCase().includes("count")) {
            aggregated[key] = results.length;
          } else {
            aggregated[key] = null;
          }
        } else {
          aggregated[key] = null;
        }
      }
      return [aggregated];
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
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * 从 Drizzle 表定义中提取列的默认值映射
 *
 * 遍历表的列定义，收集有 hasDefault=true 的列及其默认值
 * 使用 camelCase 属性名作为 key（与 JS 对象属性一致）
 *
 * @param tableRef Drizzle 表定义对象
 * @returns camelCase 属性名 -> 默认值 的映射
 */
function extractColumnDefaults(tableRef: unknown): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  if (!tableRef || typeof tableRef !== "object") return defaults;

  for (const [propName, col] of Object.entries(tableRef as Record<string, unknown>)) {
    if (!col || typeof col !== "object") continue;
    const colDef = col as Record<string, unknown>;
    // 跳过非列对象（如 enableRLS）
    if (!("hasDefault" in colDef) || !("name" in colDef)) continue;
    if (colDef.hasDefault && colDef.default !== undefined) {
      // 使用 JS 属性名（camelCase）而非数据库列名（snake_case）
      defaults[propName] = colDef.default;
    }
  }
  return defaults;
}

/**
 * Mock Insert 构建器
 */
class MockInsertBuilder {
  private tableName: string;
  private tableRef: unknown;
  private data: unknown[] = [];
  private shouldReturn = false;

  constructor(tableName: string, tableRef?: unknown) {
    this.tableName = tableName;
    this.tableRef = tableRef;
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
    // 提取 Schema 默认值
    const columnDefaults = this.tableRef ? extractColumnDefaults(this.tableRef) : {};

    for (const item of this.data) {
      // 先应用 Schema 默认值，再覆盖显式传入的值
      const record = {
        ...columnDefaults,
        ...(item as object),
        id: (item as { id?: string }).id || generateMockId(),
        createdAt: (item as { createdAt?: Date }).createdAt || new Date(),
        updatedAt: (item as { updatedAt?: Date }).updatedAt || new Date(),
      };
      table.set((record as { id: string }).id, record);
      results.push(record);
    }

    return this.shouldReturn ? results : [];
  }

  /**
   * 实现 Promise 接口，使构建器可以直接 await
   */
  then<TResult1 = unknown[], TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
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
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
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
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * 从 Drizzle 表对象中提取表名
 *
 * Drizzle ORM 将表名存储在 Symbol.for('drizzle:Name') 中
 */
function getTableName(table: unknown): string {
  if (!table || typeof table !== "object") return "unknown";
  const sym = Symbol.for("drizzle:Name");
  const name = (table as Record<symbol, unknown>)[sym];
  if (typeof name === "string") return name;
  // 兼容旧格式
  const old = (table as Record<string, unknown>)?._ as Record<string, unknown> | undefined;
  if (old?.name && typeof old.name === "string") return old.name;
  return "unknown";
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
    },
  );
}

/**
 * Mock 数据库实例
 *
 * 模拟 Drizzle ORM 的 API
 */
export const mockDb = {
  select: (fields?: unknown) => {
    // 检测是否传入了字段映射对象（如 { count: sql`count(*)::int` }）
    // 注意: getTableName 对非表对象返回 "unknown"，不能用 !getTableName 判断
    const isFieldsMapping =
      fields !== null &&
      fields !== undefined &&
      typeof fields === "object" &&
      !Array.isArray(fields) &&
      getTableName(fields) === "unknown";
    const tableName = !isFieldsMapping && fields ? getTableName(fields) : "unknown";

    return {
      from: (_fromTable: unknown) => {
        const builder = new MockQueryBuilder(getTableName(_fromTable) || tableName);
        if (isFieldsMapping) {
          // 标记为聚合查询，后续 execute 时返回 count
          (builder as unknown as Record<string, unknown>).__fieldsMapping = fields;
        }
        return builder;
      },
    };
  },

  insert: (table: unknown) => {
    return new MockInsertBuilder(getTableName(table), table);
  },

  update: (table: unknown) => {
    return new MockUpdateBuilder(getTableName(table));
  },

  delete: (table: unknown) => {
    return new MockDeleteBuilder(getTableName(table));
  },

  query: new Proxy(
    {},
    {
      get(_target, tableName) {
        return createTableProxy(String(tableName));
      },
    },
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
 * 同时设置全局标志，使 getDatabase() 自动返回 mock 数据库
 */
export function enableMockDatabase(): void {
  useMock = true;
  const g = globalThis as Record<string, unknown>;
  g.__OPENCLAW_MOCK_ENABLED__ = true;
  g.__OPENCLAW_MOCK_DB__ = mockDb;
  console.log("[mock-db] Mock database enabled");
}

/**
 * 禁用 Mock 模式
 *
 * 在测试结束时调用
 */
export function disableMockDatabase(): void {
  useMock = false;
  const g = globalThis as Record<string, unknown>;
  g.__OPENCLAW_MOCK_ENABLED__ = false;
  g.__OPENCLAW_MOCK_DB__ = undefined;
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
