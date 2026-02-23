/**
 * SkillExporter 单元测试
 *
 * 测试技能导出为 .ocskill 文件的功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import * as crypto from 'node:crypto'
import { SkillExporter, type OcskillMeta } from './skill-exporter'

/** 创建临时目录 */
function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

/** 创建模拟技能目录 */
function createSkillDir(
  baseDir: string,
  manifest: Record<string, unknown>,
  files: Record<string, string> = {},
): string {
  const skillDir = path.join(baseDir, 'test-skill')
  fs.mkdirSync(skillDir, { recursive: true })

  // 写入 skill.json
  fs.writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify(manifest, null, 2))

  // 写入其他文件
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(skillDir, name)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
  }

  return skillDir
}

/** TypeScript 技能清单 */
const tsManifest = {
  id: 'test-ts-skill',
  name: '测试 TS 技能',
  description: '用于测试的 TypeScript 技能',
  version: '1.0.0',
  author: 'tester',
  entry: 'index.ts',
  runtime: 'typescript',
}

/** Python 技能清单 */
const pyManifest = {
  id: 'test-py-skill',
  name: '测试 Python 技能',
  version: '1.2.0',
  entry: 'main.py',
  runtime: 'python',
}

describe('skill-exporter', () => {
  let tempDir: string
  let outputDir: string
  let exporter: SkillExporter

  beforeEach(() => {
    tempDir = createTempDir('skill-export-test-')
    outputDir = createTempDir('skill-export-output-')
    exporter = new SkillExporter()
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    fs.rmSync(outputDir, { recursive: true, force: true })
  })

  it('EXP-001: 导出 TypeScript 技能为 .ocskill', async () => {
    const skillDir = createSkillDir(tempDir, tsManifest, {
      'index.ts': 'export default async (params: any) => ({ hello: "world" })',
    })

    const outputPath = path.join(outputDir, 'test-ts-skill.ocskill')
    const result = await exporter.exportSkill(skillDir, outputPath)

    expect(result.success).toBe(true)
    expect(result.outputPath).toBe(outputPath)
    expect(result.fileSize).toBeGreaterThan(0)
    expect(fs.existsSync(outputPath)).toBe(true)
  })

  it('EXP-002: 导出 Python 技能为 .ocskill', async () => {
    const skillDir = createSkillDir(tempDir, pyManifest, {
      'main.py': 'import json\nprint(json.dumps({"result": "ok"}))',
    })

    const outputPath = path.join(outputDir, 'test-py-skill.ocskill')
    const result = await exporter.exportSkill(skillDir, outputPath)

    expect(result.success).toBe(true)
    expect(result.fileSize).toBeGreaterThan(0)
  })

  it('EXP-003: 导出文件包含正确的 ocskill.json', async () => {
    const skillDir = createSkillDir(tempDir, tsManifest, {
      'index.ts': 'export default () => "test"',
    })

    const outputPath = path.join(outputDir, 'test.ocskill')
    await exporter.exportSkill(skillDir, outputPath)

    // 解压并检查 ocskill.json
    const extractDir = createTempDir('extract-')
    const tar = await import('tar')
    await tar.x({ file: outputPath, cwd: extractDir })

    const metaPath = path.join(extractDir, 'ocskill.json')
    expect(fs.existsSync(metaPath)).toBe(true)

    const meta: OcskillMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    expect(meta.format).toBe('ocskill/1.0')
    expect(meta.skill.id).toBe('test-ts-skill')
    expect(meta.skill.name).toBe('测试 TS 技能')
    expect(meta.skill.version).toBe('1.0.0')
    expect(meta.skill.runtime).toBe('typescript')
    expect(meta.integrity.hash).toBeTruthy()
    expect(meta.integrity.fileCount).toBeGreaterThan(0)
    expect(meta.exported.at).toBeTruthy()

    fs.rmSync(extractDir, { recursive: true, force: true })
  })

  it('EXP-004: 导出文件 SHA-256 校验正确', async () => {
    const skillDir = createSkillDir(tempDir, tsManifest, {
      'index.ts': 'const x = 1',
    })

    const outputPath = path.join(outputDir, 'test.ocskill')
    await exporter.exportSkill(skillDir, outputPath)

    // 解压并验证 hash
    const extractDir = createTempDir('extract-hash-')
    const tar = await import('tar')
    await tar.x({ file: outputPath, cwd: extractDir })

    const meta: OcskillMeta = JSON.parse(fs.readFileSync(path.join(extractDir, 'ocskill.json'), 'utf-8'))

    // 手动计算技能目录的 hash
    const skillSubDir = path.join(extractDir, 'skill')
    const hash = crypto.createHash('sha256')
    const files = fs.readdirSync(skillSubDir).sort()
    for (const file of files) {
      const content = fs.readFileSync(path.join(skillSubDir, file))
      hash.update(file)
      hash.update(content)
    }
    const expectedHash = hash.digest('hex')
    expect(meta.integrity.hash).toBe(expectedHash)

    fs.rmSync(extractDir, { recursive: true, force: true })
  })

  it('EXP-005: 技能目录不存在时返回错误', async () => {
    const result = await exporter.exportSkill('/nonexistent/path', path.join(outputDir, 'out.ocskill'))

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('EXP-006: 缺少 skill.json 时返回错误', async () => {
    const emptyDir = path.join(tempDir, 'empty-skill')
    fs.mkdirSync(emptyDir, { recursive: true })
    fs.writeFileSync(path.join(emptyDir, 'index.ts'), 'console.log("no manifest")')

    const result = await exporter.exportSkill(emptyDir, path.join(outputDir, 'out.ocskill'))

    expect(result.success).toBe(false)
    expect(result.error).toContain('skill.json')
  })
})
