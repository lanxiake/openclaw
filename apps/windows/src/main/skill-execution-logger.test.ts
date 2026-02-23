/**
 * SkillExecutionLogger 单元测试
 *
 * 测试本地技能执行日志的写入、查询、清理和统计功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { SkillExecutionLogger, type ExecutionLogEntry } from './skill-execution-logger'

/** 创建临时日志目录 */
function createTempLogDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'skill-log-test-'))
}

/** 生成模拟执行日志条目 */
function makeLogEntry(overrides: Partial<Omit<ExecutionLogEntry, 'id'>> = {}): Omit<ExecutionLogEntry, 'id'> {
  return {
    requestId: `req-${Date.now()}`,
    skillId: 'test-skill-001',
    skillName: '测试技能',
    runtime: 'typescript',
    params: { input: 'hello' },
    startedAt: new Date().toISOString(),
    executionTimeMs: 150,
    success: true,
    resultSummary: '{"output":"world"}',
    error: undefined,
    exitCode: 0,
    stdout: 'skill output',
    stderr: '',
    ...overrides,
  }
}

describe('skill-execution-logger', () => {
  let logDir: string
  let logger: SkillExecutionLogger

  beforeEach(async () => {
    logDir = createTempLogDir()
    logger = new SkillExecutionLogger(logDir)
    await logger.initialize()
  })

  afterEach(() => {
    fs.rmSync(logDir, { recursive: true, force: true })
  })

  describe('初始化', () => {
    it('LOG-001: 初始化创建日志目录', async () => {
      const newDir = path.join(logDir, 'sub', 'logs')
      const newLogger = new SkillExecutionLogger(newDir)
      await newLogger.initialize()

      expect(fs.existsSync(newDir)).toBe(true)
    })
  })

  describe('logExecution', () => {
    it('LOG-002: logExecution 写入 JSONL 文件并返回 id', async () => {
      const entry = makeLogEntry()
      const id = await logger.logExecution(entry)

      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')

      // 验证文件存在
      const files = fs.readdirSync(logDir).filter((f) => f.endsWith('.jsonl'))
      expect(files.length).toBe(1)
      expect(files[0]).toMatch(/^execution-\d{4}-\d{2}-\d{2}\.jsonl$/)

      // 验证内容
      const content = fs.readFileSync(path.join(logDir, files[0]), 'utf-8')
      const parsed = JSON.parse(content.trim())
      expect(parsed.id).toBe(id)
      expect(parsed.skillId).toBe('test-skill-001')
    })

    it('LOG-003: 多次写入追加到同一天文件', async () => {
      await logger.logExecution(makeLogEntry({ skillId: 'skill-a' }))
      await logger.logExecution(makeLogEntry({ skillId: 'skill-b' }))
      await logger.logExecution(makeLogEntry({ skillId: 'skill-c' }))

      const files = fs.readdirSync(logDir).filter((f) => f.endsWith('.jsonl'))
      expect(files.length).toBe(1)

      const content = fs.readFileSync(path.join(logDir, files[0]), 'utf-8')
      const lines = content.trim().split('\n')
      expect(lines.length).toBe(3)

      const entries = lines.map((l) => JSON.parse(l))
      expect(entries[0].skillId).toBe('skill-a')
      expect(entries[1].skillId).toBe('skill-b')
      expect(entries[2].skillId).toBe('skill-c')
    })
  })

  describe('queryLogs', () => {
    it('LOG-004: queryLogs 不带过滤返回全部', async () => {
      await logger.logExecution(makeLogEntry({ skillId: 'skill-1' }))
      await logger.logExecution(makeLogEntry({ skillId: 'skill-2' }))
      await logger.logExecution(makeLogEntry({ skillId: 'skill-3' }))

      const result = await logger.queryLogs({})
      expect(result.entries.length).toBe(3)
      expect(result.total).toBe(3)
    })

    it('LOG-005: queryLogs 按 skillId 过滤', async () => {
      await logger.logExecution(makeLogEntry({ skillId: 'skill-a' }))
      await logger.logExecution(makeLogEntry({ skillId: 'skill-b' }))
      await logger.logExecution(makeLogEntry({ skillId: 'skill-a' }))

      const result = await logger.queryLogs({ skillId: 'skill-a' })
      expect(result.entries.length).toBe(2)
      expect(result.total).toBe(2)
      expect(result.entries.every((e) => e.skillId === 'skill-a')).toBe(true)
    })

    it('LOG-006: queryLogs 按日期范围过滤', async () => {
      // 手动写入不同日期的日志文件
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const twoDaysAgo = new Date(today)
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

      const formatDate = (d: Date) => d.toISOString().split('T')[0]

      // 写入昨天的日志
      const yesterdayFile = path.join(logDir, `execution-${formatDate(yesterday)}.jsonl`)
      const yesterdayEntry: ExecutionLogEntry = {
        id: 'old-1',
        ...makeLogEntry({ skillId: 'old-skill', startedAt: yesterday.toISOString() }),
      }
      fs.writeFileSync(yesterdayFile, JSON.stringify(yesterdayEntry) + '\n')

      // 写入今天的日志
      await logger.logExecution(makeLogEntry({ skillId: 'today-skill' }))

      // 只查今天
      const todayResult = await logger.queryLogs({ dateFrom: formatDate(today) })
      expect(todayResult.entries.length).toBe(1)
      expect(todayResult.entries[0].skillId).toBe('today-skill')

      // 查全部（昨天+今天）
      const allResult = await logger.queryLogs({ dateFrom: formatDate(yesterday) })
      expect(allResult.entries.length).toBe(2)
    })

    it('LOG-007: queryLogs 按 success 过滤', async () => {
      await logger.logExecution(makeLogEntry({ success: true }))
      await logger.logExecution(makeLogEntry({ success: false, error: '执行失败' }))
      await logger.logExecution(makeLogEntry({ success: true }))

      const successOnly = await logger.queryLogs({ success: true })
      expect(successOnly.entries.length).toBe(2)

      const failOnly = await logger.queryLogs({ success: false })
      expect(failOnly.entries.length).toBe(1)
      expect(failOnly.entries[0].error).toBe('执行失败')
    })

    it('LOG-008: queryLogs 分页 (limit + offset)', async () => {
      for (let i = 0; i < 5; i++) {
        await logger.logExecution(makeLogEntry({ skillId: `skill-${i}` }))
      }

      const page1 = await logger.queryLogs({ limit: 2, offset: 0 })
      expect(page1.entries.length).toBe(2)
      expect(page1.total).toBe(5)

      const page2 = await logger.queryLogs({ limit: 2, offset: 2 })
      expect(page2.entries.length).toBe(2)

      const page3 = await logger.queryLogs({ limit: 2, offset: 4 })
      expect(page3.entries.length).toBe(1)
    })
  })

  describe('clearOldLogs', () => {
    it('LOG-009: clearOldLogs 删除过期文件保留近期', async () => {
      // 创建 3 天前的日志文件
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      const oldDate = threeDaysAgo.toISOString().split('T')[0]
      const oldFile = path.join(logDir, `execution-${oldDate}.jsonl`)
      fs.writeFileSync(oldFile, JSON.stringify({ id: 'old', ...makeLogEntry() }) + '\n')

      // 写入今天的日志
      await logger.logExecution(makeLogEntry())

      // 删除 2 天前的日志
      const deleted = await logger.clearOldLogs(2)
      expect(deleted).toBe(1)

      // 今天的日志仍在
      const files = fs.readdirSync(logDir).filter((f) => f.endsWith('.jsonl'))
      expect(files.length).toBe(1)
      expect(files[0]).not.toContain(oldDate)
    })
  })

  describe('getStats', () => {
    it('LOG-010: getStats 返回正确统计', async () => {
      await logger.logExecution(makeLogEntry({ success: true }))
      await logger.logExecution(makeLogEntry({ success: true }))
      await logger.logExecution(makeLogEntry({ success: false, error: 'err' }))

      const stats = await logger.getStats()
      expect(stats.totalExecutions).toBe(3)
      expect(stats.successCount).toBe(2)
      expect(stats.failureCount).toBe(1)
      expect(stats.totalLogFiles).toBe(1)
      expect(stats.totalLogSizeBytes).toBeGreaterThan(0)
    })
  })
})
