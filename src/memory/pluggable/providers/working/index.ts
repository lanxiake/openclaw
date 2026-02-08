/**
 * 工作记忆提供者导出
 *
 * @module memory/pluggable/providers/working
 */

export { MemoryWorkingMemoryProvider, type MemoryWorkingConfig } from './memory.js'

// 注册所有提供者（导入时自动注册）
import './memory.js'
