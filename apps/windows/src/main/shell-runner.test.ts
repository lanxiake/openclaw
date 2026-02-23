/**
 * ShellRunner 单元测试
 *
 * 测试 Shell 子进程执行技能脚本、结果提取、超时处理、取消机制
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { ShellRunner } from './shell-runner'
import { RESULT_PREFIX } from './ts-runner'

const isWin = process.platform === 'win32'

/** 创建临时目录 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'shell-runner-test-'))
}

/** 创建临时脚本文件 */
function createScript(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, content, 'utf-8')
  // Unix 脚本需要可执行权限
  if (!isWin && (name.endsWith('.sh') || name.endsWith('.bash'))) {
    fs.chmodSync(filePath, '755')
  }
  return filePath
}

describe('ShellRunner', () => {
  let tempDir: string
  let runner: ShellRunner

  beforeEach(() => {
    tempDir = createTempDir()
    runner = new ShellRunner()
  })

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true })
  })

  it('SH-001: 执行 .sh 脚本', async () => {
    // Windows 上需要 bash (Git Bash)，如果没有则跳过
    let hasBash = false
    if (isWin) {
      try {
        const { execSync } = await import('node:child_process')
        execSync('bash --version', { stdio: 'ignore' })
        hasBash = true
      } catch {
        hasBash = false
      }
    } else {
      hasBash = true
    }

    if (!hasBash) {
      console.log('[SKIP] bash 不可用，跳过 .sh 测试')
      return
    }

    const script = createScript(
      tempDir,
      'test_skill.sh',
      `#!/bin/bash
echo "__SKILL_RESULT__:{\\"greeting\\":\\"Hello from Shell\\"}"
`,
    )

    const result = await runner.execute({
      entryPath: script,
      params: {},
      timeoutMs: 10000,
    })

    expect(result.success).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.result).toEqual({ greeting: 'Hello from Shell' })
  })

  it.skipIf(!isWin)('SH-002: 执行 .ps1 脚本 (Win)', async () => {
    const script = createScript(
      tempDir,
      'test_skill.ps1',
      `Write-Output "__SKILL_RESULT__:$('{"greeting":"Hello from PowerShell"}')"
`,
    )

    const result = await runner.execute({
      entryPath: script,
      params: {},
      timeoutMs: 15000,
    })

    expect(result.success).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.result).toEqual({ greeting: 'Hello from PowerShell' })
  }, 20000)

  it.skipIf(!isWin)('SH-003: 执行 .bat 脚本 (Win)', async () => {
    const script = createScript(
      tempDir,
      'test_skill.bat',
      `@echo off
echo __SKILL_RESULT__:{"greeting":"Hello from Batch"}
`,
    )

    const result = await runner.execute({
      entryPath: script,
      params: {},
      timeoutMs: 10000,
    })

    expect(result.success).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.result).toEqual({ greeting: 'Hello from Batch' })
  })

  it('SH-004: SKILL_PARAMS 传参', async () => {
    if (isWin) {
      // Windows 上通过 bat 脚本测试环境变量
      const script = createScript(
        tempDir,
        'params_skill.bat',
        `@echo off
echo __SKILL_RESULT__:%SKILL_PARAMS%
`,
      )

      const result = await runner.execute({
        entryPath: script,
        params: { key1: 'value1' },
        timeoutMs: 10000,
      })

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ key1: 'value1' })
    } else {
      const script = createScript(
        tempDir,
        'params_skill.sh',
        `#!/bin/bash
echo "__SKILL_RESULT__:$SKILL_PARAMS"
`,
      )

      const result = await runner.execute({
        entryPath: script,
        params: { key1: 'value1' },
        timeoutMs: 10000,
      })

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ key1: 'value1' })
    }
  })

  it('SH-005: 超时终止', async () => {
    let script: string
    if (isWin) {
      script = createScript(
        tempDir,
        'slow_skill.bat',
        `@echo off
ping -n 31 127.0.0.1 > nul
echo __SKILL_RESULT__:{"done":true}
`,
      )
    } else {
      script = createScript(
        tempDir,
        'slow_skill.sh',
        `#!/bin/bash
sleep 30
echo "__SKILL_RESULT__:{\\"done\\":true}"
`,
      )
    }

    const result = await runner.execute({
      entryPath: script,
      params: {},
      timeoutMs: 500,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('终止')
  }, 10000)

  it('SH-006: AbortSignal 取消', async () => {
    let script: string
    if (isWin) {
      script = createScript(
        tempDir,
        'cancel_skill.bat',
        `@echo off
ping -n 31 127.0.0.1 > nul
echo __SKILL_RESULT__:{"done":true}
`,
      )
    } else {
      script = createScript(
        tempDir,
        'cancel_skill.sh',
        `#!/bin/bash
sleep 30
echo "__SKILL_RESULT__:{\\"done\\":true}"
`,
      )
    }

    const controller = new AbortController()

    const resultPromise = runner.execute({
      entryPath: script,
      params: {},
      timeoutMs: 30000,
      abortSignal: controller.signal,
    })

    await new Promise((r) => setTimeout(r, 300))
    controller.abort()

    const result = await resultPromise

    expect(result.success).toBe(false)
    expect(result.error).toContain('终止')
  }, 10000)

  it('SH-007: 不支持的扩展名返回错误', async () => {
    const script = createScript(
      tempDir,
      'test_skill.rb',
      'puts "hello"',
    )

    const result = await runner.execute({
      entryPath: script,
      params: {},
      timeoutMs: 10000,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('不支持')
  })
})
