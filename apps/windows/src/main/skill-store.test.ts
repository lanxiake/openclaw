/**
 * LocalSkillStore 单元测试
 *
 * 使用真实临时目录测试技能安装、卸载、索引管理等功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { LocalSkillStore, validateManifest, type SkillManifest } from './skill-store'

/**
 * 创建临时目录
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'skill-store-test-'))
}

/**
 * 创建模拟技能目录
 */
function createMockSkillDir(
  baseDir: string,
  manifest: SkillManifest,
  entryContent = 'console.log("hello")',
): string {
  const skillDir = path.join(baseDir, `source-${manifest.id}`)
  fs.mkdirSync(skillDir, { recursive: true })

  // 写入 skill.json
  fs.writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify(manifest, null, 2))

  // 写入入口文件
  fs.writeFileSync(path.join(skillDir, manifest.entry), entryContent)

  return skillDir
}

describe('validateManifest', () => {
  it('STORE-001: 有效清单通过验证', () => {
    const manifest: SkillManifest = {
      id: 'test-skill',
      name: 'Test Skill',
      version: '1.0.0',
      entry: 'index.ts',
      runtime: 'typescript',
    }

    const result = validateManifest(manifest)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('STORE-002: 缺少 id 字段不通过', () => {
    const result = validateManifest({
      name: 'Test',
      version: '1.0.0',
      entry: 'index.ts',
      runtime: 'typescript',
    } as SkillManifest)

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('id'))).toBe(true)
  })

  it('STORE-003: 无效的 runtime 不通过', () => {
    const result = validateManifest({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      entry: 'index.ts',
      runtime: 'rust' as SkillManifest['runtime'],
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('runtime'))).toBe(true)
  })
})

describe('LocalSkillStore', () => {
  let tempDir: string
  let skillsDir: string
  let store: LocalSkillStore

  beforeEach(async () => {
    tempDir = createTempDir()
    skillsDir = path.join(tempDir, 'skills')
    store = new LocalSkillStore(skillsDir)
    await store.initialize()
  })

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true })
  })

  describe('initialize', () => {
    it('STORE-010: 创建技能目录和空索引', async () => {
      const dirExists = fs.existsSync(skillsDir)
      expect(dirExists).toBe(true)

      const indexPath = path.join(skillsDir, 'index.json')
      // 索引文件在首次操作时才持久化，初始化只在内存中
      const skills = await store.listInstalled()
      expect(skills).toHaveLength(0)
    })

    it('STORE-011: 重复初始化安全', async () => {
      const store2 = new LocalSkillStore(skillsDir)
      await store2.initialize()
      const skills = await store2.listInstalled()
      expect(skills).toHaveLength(0)
    })
  })

  describe('installFromDirectory', () => {
    it('STORE-020: 成功安装有效技能', async () => {
      const manifest: SkillManifest = {
        id: 'my-test-skill',
        name: '测试技能',
        version: '1.0.0',
        entry: 'index.ts',
        runtime: 'typescript',
      }

      const sourceDir = createMockSkillDir(tempDir, manifest)
      const result = await store.installFromDirectory(sourceDir)

      expect(result.success).toBe(true)
      expect(result.skillId).toBe('my-test-skill')

      // 验证索引
      const installed = await store.listInstalled()
      expect(installed).toHaveLength(1)
      expect(installed[0].id).toBe('my-test-skill')
      expect(installed[0].enabled).toBe(true)
      expect(installed[0].executionCount).toBe(0)
    })

    it('STORE-021: 源目录缺少 skill.json 时失败', async () => {
      const emptyDir = path.join(tempDir, 'empty-skill')
      fs.mkdirSync(emptyDir, { recursive: true })

      const result = await store.installFromDirectory(emptyDir)
      expect(result.success).toBe(false)
      expect(result.error).toContain('skill.json')
    })

    it('STORE-022: 入口文件不存在时失败', async () => {
      const skillDir = path.join(tempDir, 'bad-skill')
      fs.mkdirSync(skillDir, { recursive: true })
      fs.writeFileSync(
        path.join(skillDir, 'skill.json'),
        JSON.stringify({
          id: 'bad',
          name: 'Bad',
          version: '1.0.0',
          entry: 'nonexistent.ts',
          runtime: 'typescript',
        }),
      )

      const result = await store.installFromDirectory(skillDir)
      expect(result.success).toBe(false)
      expect(result.error).toContain('入口文件不存在')
    })

    it('STORE-023: 重新安装覆盖旧版本', async () => {
      const manifest: SkillManifest = {
        id: 'update-skill',
        name: 'V1',
        version: '1.0.0',
        entry: 'index.ts',
        runtime: 'typescript',
      }

      const sourceDir1 = createMockSkillDir(tempDir, manifest, 'v1 code')
      await store.installFromDirectory(sourceDir1)

      // 更新版本
      const manifestV2 = { ...manifest, name: 'V2', version: '2.0.0' }
      const sourceDir2 = createMockSkillDir(tempDir, manifestV2, 'v2 code')
      // 清理 source 目录名冲突（因为 id 相同会创建同名目录）
      const v2Dir = path.join(tempDir, 'source-v2')
      fs.mkdirSync(v2Dir, { recursive: true })
      fs.writeFileSync(path.join(v2Dir, 'skill.json'), JSON.stringify(manifestV2, null, 2))
      fs.writeFileSync(path.join(v2Dir, 'index.ts'), 'v2 code')

      const result = await store.installFromDirectory(v2Dir)
      expect(result.success).toBe(true)

      const installed = await store.listInstalled()
      expect(installed).toHaveLength(1)
      expect(installed[0].version).toBe('2.0.0')
    })
  })

  describe('uninstall', () => {
    it('STORE-030: 成功卸载已安装技能', async () => {
      const manifest: SkillManifest = {
        id: 'to-remove',
        name: 'Remove Me',
        version: '1.0.0',
        entry: 'index.ts',
        runtime: 'typescript',
      }

      const sourceDir = createMockSkillDir(tempDir, manifest)
      await store.installFromDirectory(sourceDir)

      const result = await store.uninstall('to-remove')
      expect(result.success).toBe(true)

      const installed = await store.listInstalled()
      expect(installed).toHaveLength(0)

      // 验证目录已删除
      const skillDir = path.join(skillsDir, 'to-remove')
      expect(fs.existsSync(skillDir)).toBe(false)
    })

    it('STORE-031: 卸载不存在的技能返回错误', async () => {
      const result = await store.uninstall('nonexistent')
      expect(result.success).toBe(false)
      expect(result.error).toContain('不存在')
    })
  })

  describe('getManifest', () => {
    it('STORE-040: 获取已安装技能的清单', async () => {
      const manifest: SkillManifest = {
        id: 'manifest-test',
        name: 'Manifest Test',
        version: '1.0.0',
        entry: 'index.ts',
        runtime: 'typescript',
        description: 'A test skill',
      }

      const sourceDir = createMockSkillDir(tempDir, manifest)
      await store.installFromDirectory(sourceDir)

      const loaded = await store.getManifest('manifest-test')
      expect(loaded).not.toBeNull()
      expect(loaded!.id).toBe('manifest-test')
      expect(loaded!.description).toBe('A test skill')
    })

    it('STORE-041: 获取不存在技能返回 null', async () => {
      const result = await store.getManifest('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getEntryPath', () => {
    it('STORE-050: 返回正确的入口文件路径', async () => {
      const manifest: SkillManifest = {
        id: 'entry-test',
        name: 'Entry Test',
        version: '1.0.0',
        entry: 'src/main.ts',
        runtime: 'typescript',
      }

      const sourceDir = path.join(tempDir, 'source-entry-test')
      fs.mkdirSync(path.join(sourceDir, 'src'), { recursive: true })
      fs.writeFileSync(path.join(sourceDir, 'skill.json'), JSON.stringify(manifest, null, 2))
      fs.writeFileSync(path.join(sourceDir, 'src', 'main.ts'), 'console.log("entry")')

      await store.installFromDirectory(sourceDir)

      const entryPath = await store.getEntryPath('entry-test')
      expect(entryPath).not.toBeNull()
      expect(entryPath!.endsWith(path.join('entry-test', 'src', 'main.ts'))).toBe(true)
    })
  })

  describe('setEnabled', () => {
    it('STORE-060: 禁用技能', async () => {
      const manifest: SkillManifest = {
        id: 'toggle-skill',
        name: 'Toggle',
        version: '1.0.0',
        entry: 'index.ts',
        runtime: 'typescript',
      }

      const sourceDir = createMockSkillDir(tempDir, manifest)
      await store.installFromDirectory(sourceDir)

      const toggled = await store.setEnabled('toggle-skill', false)
      expect(toggled).toBe(true)

      const installed = await store.listInstalled()
      expect(installed[0].enabled).toBe(false)
    })

    it('STORE-061: 不存在的技能返回 false', async () => {
      const result = await store.setEnabled('nonexistent', true)
      expect(result).toBe(false)
    })
  })

  describe('recordExecution', () => {
    it('STORE-070: 更新执行统计', async () => {
      const manifest: SkillManifest = {
        id: 'exec-stats',
        name: 'Stats',
        version: '1.0.0',
        entry: 'index.ts',
        runtime: 'typescript',
      }

      const sourceDir = createMockSkillDir(tempDir, manifest)
      await store.installFromDirectory(sourceDir)

      await store.recordExecution('exec-stats')
      await store.recordExecution('exec-stats')
      await store.recordExecution('exec-stats')

      const installed = await store.listInstalled()
      expect(installed[0].executionCount).toBe(3)
      expect(installed[0].lastExecutedAt).toBeDefined()
    })
  })
})
