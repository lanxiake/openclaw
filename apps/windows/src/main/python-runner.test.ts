/**
 * PythonRunner 单元测试
 *
 * 测试 Python 子进程执行技能脚本、结果提取、超时处理、取消机制
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { execSync } from 'node:child_process'
import { PythonRunner } from './python-runner'
import { RESULT_PREFIX, extractResult } from './ts-runner'

/** 检测当前环境是否有可用的 Python */
let hasPython = false
beforeAll(() => {
  try {
    const version = execSync('python --version 2>&1', { encoding: 'utf-8' }).trim()
    hasPython = version.startsWith('Python 3')
  } catch {
    try {
      const version = execSync('python3 --version 2>&1', { encoding: 'utf-8' }).trim()
      hasPython = version.startsWith('Python 3')
    } catch {
      hasPython = false
    }
  }
})

/** 创建临时目录 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'python-runner-test-'))
}

/** 创建临时 Python 脚本文件 */
function createScript(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

describe('PythonRunner', () => {
  let tempDir: string
  let runner: PythonRunner

  beforeEach(() => {
    tempDir = createTempDir()
    runner = new PythonRunner()
  })

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true })
  })

  it('PY-001: detectPython 返回有效路径', async () => {
    if (!hasPython) {
      console.log('[SKIP] Python 不可用，跳过测试')
      return
    }

    const pythonPath = await runner.detectPython()
    expect(pythonPath).toBeTruthy()
    expect(typeof pythonPath).toBe('string')
  })

  it('PY-002: 执行脚本提取 __SKILL_RESULT__ 结果', async () => {
    if (!hasPython) {
      console.log('[SKIP] Python 不可用，跳过测试')
      return
    }

    const script = createScript(
      tempDir,
      'test_skill.py',
      `
import json
result = {"greeting": "Hello from Python"}
print("__SKILL_RESULT__:" + json.dumps(result))
`,
    )

    const result = await runner.execute({
      entryPath: script,
      params: {},
      timeoutMs: 10000,
    })

    expect(result.success).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.result).toEqual({ greeting: 'Hello from Python' })
    expect(result.executionTimeMs).toBeGreaterThan(0)
  })

  it('PY-003: SKILL_PARAMS 传参', async () => {
    if (!hasPython) {
      console.log('[SKIP] Python 不可用，跳过测试')
      return
    }

    const script = createScript(
      tempDir,
      'params_skill.py',
      `
import os, json
params = json.loads(os.environ.get('SKILL_PARAMS', '{}'))
print("__SKILL_RESULT__:" + json.dumps(params))
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

  it('PY-004: 非零退出码返回失败', async () => {
    if (!hasPython) {
      console.log('[SKIP] Python 不可用，跳过测试')
      return
    }

    const script = createScript(
      tempDir,
      'error_skill.py',
      `
import sys
print("Something went wrong", file=sys.stderr)
sys.exit(1)
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

  it('PY-005: 超时终止', async () => {
    if (!hasPython) {
      console.log('[SKIP] Python 不可用，跳过测试')
      return
    }

    const script = createScript(
      tempDir,
      'slow_skill.py',
      `
import time
time.sleep(30)
print("__SKILL_RESULT__:" + '{"done":true}')
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

  it('PY-006: AbortSignal 取消', async () => {
    if (!hasPython) {
      console.log('[SKIP] Python 不可用，跳过测试')
      return
    }

    const script = createScript(
      tempDir,
      'cancel_skill.py',
      `
import time
time.sleep(30)
print("__SKILL_RESULT__:" + '{"done":true}')
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
    await new Promise((r) => setTimeout(r, 300))
    controller.abort()

    const result = await resultPromise

    expect(result.success).toBe(false)
    expect(result.error).toContain('终止')
  }, 10000)

  it('PY-007: 文件不存在返回错误', async () => {
    const result = await runner.execute({
      entryPath: path.join(tempDir, 'nonexistent.py'),
      params: {},
      timeoutMs: 10000,
    })

    expect(result.success).toBe(false)
  })

  it('PY-008: extractResult 复用验证', () => {
    // 验证 PythonRunner 使用与 TSRunner 相同的 extractResult
    const stdout = `一些日志\n${RESULT_PREFIX}{"from":"python"}\n`
    const result = extractResult(stdout)
    expect(result).toEqual({ from: 'python' })
  })
})
