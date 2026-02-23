/**
 * SkillWrapper 单元测试
 *
 * 测试单文件脚本自动推断 runtime、生成 skill.json 并包装为技能目录
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { inferRuntime, wrapSingleFile } from './skill-wrapper'

/** 创建临时目录 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'skill-wrapper-test-'))
}

/** 创建临时脚本文件 */
function createScript(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

describe('inferRuntime', () => {
  it('WRAP-001: .ts/.tsx 推断为 typescript', () => {
    expect(inferRuntime('hello.ts')).toBe('typescript')
    expect(inferRuntime('component.tsx')).toBe('typescript')
  })

  it('WRAP-002: .js/.mjs 推断为 javascript', () => {
    expect(inferRuntime('script.js')).toBe('javascript')
    expect(inferRuntime('module.mjs')).toBe('javascript')
  })

  it('WRAP-003: .py 推断为 python, .sh/.ps1/.bat/.cmd 推断为 shell', () => {
    expect(inferRuntime('main.py')).toBe('python')
    expect(inferRuntime('run.sh')).toBe('shell')
    expect(inferRuntime('run.ps1')).toBe('shell')
    expect(inferRuntime('run.bat')).toBe('shell')
    expect(inferRuntime('run.cmd')).toBe('shell')
  })

  it('WRAP-004: 未知扩展名返回 null', () => {
    expect(inferRuntime('file.rb')).toBeNull()
    expect(inferRuntime('file.go')).toBeNull()
    expect(inferRuntime('file')).toBeNull()
  })
})

describe('wrapSingleFile', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir()
  })

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true })
  })

  it('WRAP-005: 成功生成 skill.json 和技能目录', async () => {
    const scriptPath = createScript(tempDir, 'my-tool.py', 'print("hello")')

    const result = await wrapSingleFile({
      filePath: scriptPath,
      outputDir: tempDir,
    })

    expect(result.success).toBe(true)
    expect(result.skillDir).toBeTruthy()
    expect(result.manifest).toBeTruthy()

    // 验证目录存在
    expect(fs.existsSync(result.skillDir!)).toBe(true)

    // 验证 skill.json 存在
    const manifestPath = path.join(result.skillDir!, 'skill.json')
    expect(fs.existsSync(manifestPath)).toBe(true)

    // 验证入口文件被复制
    const entryPath = path.join(result.skillDir!, result.manifest!.entry)
    expect(fs.existsSync(entryPath)).toBe(true)
  })

  it('WRAP-006: 文件不存在返回错误', async () => {
    const result = await wrapSingleFile({
      filePath: path.join(tempDir, 'nonexistent.py'),
      outputDir: tempDir,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('WRAP-007: manifest 字段正确', async () => {
    const scriptPath = createScript(tempDir, 'hello-world.ts', 'console.log("hello")')

    const result = await wrapSingleFile({
      filePath: scriptPath,
      outputDir: tempDir,
      meta: {
        name: 'Hello World Skill',
        description: 'A test skill',
      },
    })

    expect(result.success).toBe(true)
    const manifest = result.manifest!

    expect(manifest.name).toBe('Hello World Skill')
    expect(manifest.description).toBe('A test skill')
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.runtime).toBe('typescript')
    expect(manifest.entry).toBe('hello-world.ts')
    expect(manifest.id).toBeTruthy()
    expect(typeof manifest.id).toBe('string')
  })
})
