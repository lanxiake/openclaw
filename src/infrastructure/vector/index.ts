/**
 * 向量搜索基础设施模块
 *
 * 导出语义搜索相关功能
 */

export {
  type SearchResult,
  type SearchOptions,
  embedText,
  searchMemories,
  searchMemoriesByText,
  storeMemoryWithEmbedding,
  updateMemoryEmbedding,
  rebuildUserMemoryEmbeddings,
  findSimilarMemories,
} from "./memory-search.js";
