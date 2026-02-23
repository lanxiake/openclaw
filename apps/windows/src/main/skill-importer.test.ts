/**
 * SkillImporter 单元测试
 *
 * 测试从 .ocskill 文件导入技能的功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import * as crypto from 'node:crypto'
import { SkillExporter, type OcskillMeta } from './skill-exporter'
import { SkillImporter } from './skill-importer'
import { LocalSkillStore } from './skill-store'

/** 创建临时目录 */
function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

/** 创建模拟技能目录并导出为 .ocskill */
async function createOcskillFile(outputPath: string, manifest?: Record<string, unknown>): Promise<void> {
  const tempDir = createTempDir('importer-src-')
  const skillDir = path.join(tempDir, 'test-skill')
  fs.mkdirSync(skillDir, { recursive: true })

  const defaultManifest = {
    id: 'import-test-skill',
    name: '导入测试技能',
    version: '1.0.0',
    entry: 'index.ts',
    runtime: 'typescript',
  }

  fs.writeFileSync(
    path.join(skillDir, 'skill.json'),
    JSON.stringify(manifest ?? defaultManifest, null, 2),
  )
  fs.writeFileSync(
    path.join(skillDir, 'index.ts'),
    'export default async () => ({ imported: true })',
  )

  const exporter = new SkillExporter()
  await exporter.exportSkill(skillDir, outputPath)

  fs.rmSync(tempDir, { recursive: true, force: true })
}

/** 创建一个格式错误的 .ocskill 文件（hash 不匹配） */
async function createCorruptedOcskillFile(outputPath: string): Promise<void> {
  const tempDir = createTempDir('corrupt-src-')

  // 创建 skill 子目录
  const skillSubDir = path.join(tempDir, 'skill')
  fs.mkdirSync(skillSubDir, { recursive: true })
  fs.writeFileSync(
    path.join(skillSubDir, 'skill.json'),
    JSON.stringify({
      id: 'corrupt-skill',
      name: '损坏技能',
      version: '1.0.0',
      entry: 'index.ts',
      runtime: 'typescript',
    }),
  )
  fs.writeFileSync(path.join(skillSubDir, 'index.ts'), 'console.log("corrupt")')

  // 写入错误的 hash
  const meta: OcskillMeta = {
    format: 'ocskill/1.0',
    skill: {
      id: 'corrupt-skill',
      name: '损坏技能',
      version: '1.0.0',
      runtime: 'typescript',
    },
    integrity: {
      hash: 'aaaa_wrong_hash_aaaa',
      fileCount: 2,
    },
    exported: {
      at: new Date().toISOString(),
      platform: 'test',
      appVersion: '1.0.0',
    },
  }
  fs.writeFileSync(path.join(tempDir, 'ocskill.json'), JSON.stringify(meta, null, 2))

  const tar = await import('tar')
  await tar.c(
    { gzip: true, file: outputPath, cwd: tempDir },
    ['ocskill.json', 'skill'],
  )

  fs.rmSync(tempDir, { recursive: true, force: true })
}

/** 创建格式版本不匹配的 .ocskill */
async function createBadVersionOcskillFile(outputPath: string): Promise<void> {
  const tempDir = createTempDir('badver-src-')

  const skillSubDir = path.join(tempDir, 'skill')
  fs.mkdirSync(skillSubDir, { recursive: true })
  fs.writeFileSync(path.join(skillSubDir, 'skill.json'), JSON.stringify({ id: 'x', name: 'x', version: '1.0.0', entry: 'x.ts', runtime: 'typescript' }))
  fs.writeFileSync(path.join(skillSubDir, 'x.ts'), 'x')

  const meta = {
    format: 'ocskill/99.0',
    skill: { id: 'x', name: 'x', version: '1.0.0', runtime: 'typescript' },
    integrity: { hash: 'whatever', fileCount: 2 },
    exported: { at: new Date().toISOString(), platform: 'test', appVersion: '1.0.0' },
  }
  fs.writeFileSync(path.join(tempDir, 'ocskill.json'), JSON.stringify(meta, null, 2))

  const tar = await import('tar')
  await tar.c({ gzip: true, file: outputPath, cwd: tempDir }, ['ocskill.json', 'skill'])

  fs.rmSync(tempDir, { recursive: true, force: true })
}

describe('skill-importer', () => {
  let skillsDir: string
  let tempDir: string
  let skillStore: LocalSkillStore
  let importer: SkillImporter

  beforeEach(async () => {
    skillsDir = createTempDir('skills-store-')
    tempDir = createTempDir('importer-test-')
    skillStore = new LocalSkillStore(skillsDir)
    await skillStore.initialize()
    importer = new SkillImporter(skillStore)
  })

  afterEach(() => {
    fs.rmSync(skillsDir, { recursive: true, force: true })
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('IMP-001: 从 .ocskill 成功导入', async () => {
    const ocskillPath = path.join(tempDir, 'test.ocskill')
    await createOcskillFile(ocskillPath)

    const result = await importer.importSkill(ocskillPath)
    expect(result.success).toBe(true)
    expect(result.skillId).toBe('import-test-skill')
    expect(result.skillName).toBe('导入测试技能')
  })

  it('IMP-002: 导入后技能出现在 skillStore', async () => {
    const ocskillPath = path.join(tempDir, 'test.ocskill')
    await createOcskillFile(ocskillPath)

    await importer.importSkill(ocskillPath)

    const installed = await skillStore.listInstalled()
    expect(installed.length).toBe(1)
    expect(installed[0].id).toBe('import-test-skill')
    expect(installed[0].name).toBe('导入测试技能')
  })

  it('IMP-003: previewSkill 返回元数据', async () => {
    const ocskillPath = path.join(tempDir, 'test.ocskill')
    await createOcskillFile(ocskillPath)

    const result = await importer.previewSkill(ocskillPath)
    expect(result.meta).not.toBeNull()
    expect(result.meta!.format).toBe('ocskill/1.0')
    expect(result.meta!.skill.id).toBe('import-test-skill')
    expect(result.meta!.skill.version).toBe('1.0.0')
  })

  it('IMP-004: SHA-256 校验失败时拒绝导入', async () => {
    const ocskillPath = path.join(tempDir, 'corrupted.ocskill')
    await createCorruptedOcskillFile(ocskillPath)

    const result = await importer.importSkill(ocskillPath)
    expect(result.success).toBe(false)
    expect(result.error).toContain('SHA-256')
  })

  it('IMP-005: 格式版本不匹配时拒绝', async () => {
    const ocskillPath = path.join(tempDir, 'badversion.ocskill')
    await createBadVersionOcskillFile(ocskillPath)

    const result = await importer.importSkill(ocskillPath)
    expect(result.success).toBe(false)
    expect(result.error).toContain('格式版本')
  })

  it('IMP-006: 文件不存在时返回错误', async () => {
    const result = await importer.importSkill('/nonexistent/path.ocskill')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('IMP-007: 非 .ocskill 文件时返回错误', async () => {
    const txtPath = path.join(tempDir, 'not-a-skill.txt')
    fs.writeFileSync(txtPath, 'this is not a skill file')

    const result = await importer.importSkill(txtPath)
    expect(result.success).toBe(false)
    expect(result.error).toContain('.ocskill')
  })
})
