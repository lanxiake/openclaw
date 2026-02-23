/**
 * TypeScriptRunner 单元测试
 *
 * 测试子进程执行技能脚本、结果提取、超时处理
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { TypeScriptRunner, extractResult, RESULT_PREFIX } from './ts-runner'

/**
 * 创建临时目录
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ts-runner-test-'))
}

/**
 * 创建临时 JS 脚本文件
 */
function createScript(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

describe('extractResult', () => {
  it('RUNNER-001: 从带有 RESULT_PREFIX 的行提取 JSON', () => {
    const stdout = `一些日志输出\n${RESULT_PREFIX}{"files":["a.txt"]}\n`
    const result = extractResult(stdout)
    expect(result).toEqual({ files: ['a.txt'] })
  })

  it('RUNNER-002: 多个 RESULT_PREFIX 行取最后一个', () => {
    const stdout = `${RESULT_PREFIX}{"v":1}\n${RESULT_PREFIX}{"v":2}\n`
    const result = extractResult(stdout)
    expect(result).toEqual({ v: 2 })
  })

  it('RUNNER-003: 无 RESULT_PREFIX 时尝试解析最后一行 JSON', () => {
    const stdout = 'some log\n{"fallback":true}\n'
    const result = extractResult(stdout)
    expect(result).toEqual({ fallback: true })
  })

  it('RUNNER-004: 无 JSON 内容时返回原始 stdout', () => {
    const stdout = 'just plain text output'
    const result = extractResult(stdout)
    expect(result).toBe('just plain text output')
  })

  it('RUNNER-005: 空 stdout 返回 null', () => {
    expect(extractResult('')).toBeNull()
    expect(extractResult('\n\n')).toBeNull()
  })
})

describe('TypeScriptRunner', () => {
  let tempDir: string
  let runner: TypeScriptRunner

  beforeEach(() => {
    tempDir = createTempDir()
    runner = new TypeScriptRunner({ defaultMaxMemoryMb: 128 })
  })

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true })
  })

  it('RUNNER-010: 成功执行 JS 脚本并提取结果', async () => {
    const script = createScript(
      tempDir,
      'test-skill.js',
      `
const params = JSON.parse(process.env.SKILL_PARAMS || '{}')
const result = { greeting: 'Hello ' + (params.name || 'World') }
console.log('__SKILL_RESULT__:' + JSON.stringify(result))
`,
    )

    const result = await runner.execute({
      entryPath: script,
      params: { name: 'Alice' },
      timeoutMs: 10000,
    })

    expect(result.success).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.result).toEqual({ greeting: 'Hello Alice' })
    expect(result.executionTimeMs).toBeGreaterThan(0)
  })

  it('RUNNER-011: 脚本非零退出码时返回失败', async () => {
    const script = createScript(
      tempDir,
      'error-skill.js',
      `
console.error('Something went wrong')
process.exit(1)
`,
    )

    const result = await runner.execute({
      entryPath: script,
      params: {},
      timeoutMs: 10000,
    })

    expect(result.success).toBe(false)
    expect(result.exitCode).toBe(1)
    expect(result.error).toContain('Something went wrong')
  })

  it('RUNNER-012: 脚本超时被终止', async () => {
    const script = createScript(
      tempDir,
      'slow-skill.js',
      `
// 模拟长时间运行
setTimeout(() => {
  console.log('__SKILL_RESULT__:{"done":true}')
}, 30000)
`,
    )

    const result = await runner.execute({
      entryPath: script,
      params: {},
      timeoutMs: 500,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('终止')
  }, 10000)

  it('RUNNER-013: 通过环境变量传递参数', async () => {
    const script = createScript(
      tempDir,
      'params-skill.js',
      `
const params = JSON.parse(process.env.SKILL_PARAMS || '{}')
console.log('__SKILL_RESULT__:' + JSON.stringify(params))
`,
    )

    const result = await runner.execute({
      entryPath: script,
      params: { key1: 'value1', key2: 42, nested: { a: true } },
      timeoutMs: 10000,
    })

    expect(result.success).toBe(true)
    expect(result.result).toEqual({ key1: 'value1', key2: 42, nested: { a: true } })
  })

  it('RUNNER-014: 无结果标记时从 stdout 提取 JSON', async () => {
    const script = createScript(
      tempDir,
      'no-prefix-skill.js',
      `
console.log(JSON.stringify({ implicit: true }))
`,
    )

    const result = await runner.execute({
      entryPath: script,
      params: {},
      timeoutMs: 10000,
    })

    expect(result.success).toBe(true)
    expect(result.result).toEqual({ implicit: true })
  })

  it('RUNNER-015: 通过 AbortSignal 取消执行', async () => {
    const script = createScript(
      tempDir,
      'cancel-skill.js',
      `
setTimeout(() => {
  console.log('__SKILL_RESULT__:{"done":true}')
}, 30000)
`,
    )

    const controller = new AbortController()

    const resultPromise = runner.execute({
      entryPath: script,
      params: {},
      timeoutMs: 30000,
      abortSignal: controller.signal,
    })

    // 等一会再取消
    await new Promise((r) => setTimeout(r, 200))
    controller.abort()

    const result = await resultPromise

    expect(result.success).toBe(false)
    expect(result.error).toContain('终止')
  }, 10000)

  it('RUNNER-016: 入口文件不存在时返回错误', async () => {
    const result = await runner.execute({
      entryPath: path.join(tempDir, 'nonexistent.js'),
      params: {},
      timeoutMs: 10000,
    })

    expect(result.success).toBe(false)
  })
})
