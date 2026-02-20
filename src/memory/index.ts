/**
 * 旧版记忆系统导出
 *
 * @deprecated 新代码应使用 `src/memory/pluggable/` 或 `GatewayMemoryService`。
 * MemoryIndexManager 作为知识记忆后端通过 SQLiteKnowledgeMemoryAdapter 继续工作，
 * 但直接使用将在后续版本中移除。
 */
export type { MemoryIndexManager, MemorySearchResult } from "./manager.js";
export { getMemorySearchManager, type MemorySearchManagerResult } from "./search-manager.js";
