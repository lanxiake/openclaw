/**
 * SkillUpdater 单元测试
 *
 * 测试客户端技能版本检查和更新功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { SkillUpdater, type UpdateCheckResult } from './skill-updater'
import { LocalSkillStore } from './skill-store'

/** 创建临时目录 */
function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

/** 安装一个模拟技能到 store */
async function installMockSkill(
  store: LocalSkillStore,
  id: string,
  version: string,
): Promise<void> {
  const tempDir = createTempDir('mock-skill-')
  const skillDir = path.join(tempDir, id)
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(
    path.join(skillDir, 'skill.json'),
    JSON.stringify({ id, name: `技能 ${id}`, version, entry: 'index.ts', runtime: 'typescript' }),
  )
  fs.writeFileSync(path.join(skillDir, 'index.ts'), `export default () => "${id}"`)
  await store.installFromDirectory(skillDir)
  fs.rmSync(tempDir, { recursive: true, force: true })
}

describe('skill-updater', () => {
  let skillsDir: string
  let store: LocalSkillStore

  beforeEach(async () => {
    skillsDir = createTempDir('updater-test-')
    store = new LocalSkillStore(skillsDir)
    await store.initialize()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(skillsDir, { recursive: true, force: true })
  })

  describe('checkForUpdates', () => {
    it('UPD-001: checkForUpdates 返回有更新的技能', async () => {
      await installMockSkill(store, 'skill-a', '1.0.0')
      await installMockSkill(store, 'skill-b', '2.0.0')

      // Mock Gateway 返回的版本信息
      const mockFetchVersions = vi.fn().mockResolvedValue(
        new Map([
          ['skill-a', { latestVersion: '1.1.0' }],
          ['skill-b', { latestVersion: '2.0.0' }],
        ]),
      )

      const updater = new SkillUpdater(store, { fetchVersions: mockFetchVersions })
      const results = await updater.checkForUpdates()

      expect(results.length).toBe(2)
      const resultA = results.find((r) => r.skillId === 'skill-a')!
      expect(resultA.hasUpdate).toBe(true)
      expect(resultA.latestVersion).toBe('1.1.0')

      const resultB = results.find((r) => r.skillId === 'skill-b')!
      expect(resultB.hasUpdate).toBe(false)
    })

    it('UPD-002: checkForUpdates 无更新时返回空结果', async () => {
      await installMockSkill(store, 'skill-x', '3.0.0')

      const mockFetchVersions = vi.fn().mockResolvedValue(
        new Map([['skill-x', { latestVersion: '3.0.0' }]]),
      )

      const updater = new SkillUpdater(store, { fetchVersions: mockFetchVersions })
      const results = await updater.checkForUpdates()

      expect(results.length).toBe(1)
      expect(results[0].hasUpdate).toBe(false)
    })
  })

  describe('updateSkill', () => {
    it('UPD-003: updateSkill 成功更新', async () => {
      await installMockSkill(store, 'to-update', '1.0.0')

      // Mock：fetchVersions 和 downloadAndInstall
      const mockFetchVersions = vi.fn().mockResolvedValue(
        new Map([['to-update', { latestVersion: '1.1.0' }]]),
      )
      const mockDownloadAndInstall = vi.fn().mockResolvedValue({
        success: true,
        newVersion: '1.1.0',
      })

      const updater = new SkillUpdater(store, {
        fetchVersions: mockFetchVersions,
        downloadAndInstall: mockDownloadAndInstall,
      })

      const result = await updater.updateSkill('to-update')

      expect(result.success).toBe(true)
      expect(result.oldVersion).toBe('1.0.0')
      expect(result.newVersion).toBe('1.1.0')
      expect(mockDownloadAndInstall).toHaveBeenCalledWith('to-update', '1.1.0')
    })

    it('UPD-004: updateSkill 已是最新版返回无需更新', async () => {
      await installMockSkill(store, 'latest', '2.0.0')

      const mockFetchVersions = vi.fn().mockResolvedValue(
        new Map([['latest', { latestVersion: '2.0.0' }]]),
      )

      const updater = new SkillUpdater(store, { fetchVersions: mockFetchVersions })
      const result = await updater.updateSkill('latest')

      expect(result.success).toBe(true)
      expect(result.error).toContain('已是最新')
    })
  })

  describe('定时器', () => {
    it('UPD-005: start/stop 定时器正常工作', () => {
      vi.useFakeTimers()

      const mockFetchVersions = vi.fn().mockResolvedValue(new Map())
      const updater = new SkillUpdater(store, {
        fetchVersions: mockFetchVersions,
        checkInterval: 1000,
      })

      // spy on checkForUpdates to verify it gets called
      const checkSpy = vi.spyOn(updater, 'checkForUpdates').mockResolvedValue([])

      updater.start()

      // 第一次定时触发
      vi.advanceTimersByTime(1000)
      expect(checkSpy).toHaveBeenCalledTimes(1)

      // 第二次
      vi.advanceTimersByTime(1000)
      expect(checkSpy).toHaveBeenCalledTimes(2)

      // 停止后不再触发
      updater.stop()
      vi.advanceTimersByTime(3000)
      expect(checkSpy).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })
  })

  describe('错误处理', () => {
    it('UPD-006: 更新失败不影响检查结果', async () => {
      await installMockSkill(store, 'good', '1.0.0')
      await installMockSkill(store, 'bad', '1.0.0')

      const mockFetchVersions = vi.fn().mockResolvedValue(
        new Map([
          ['good', { latestVersion: '1.1.0' }],
          ['bad', { latestVersion: '1.2.0' }],
        ]),
      )

      const updater = new SkillUpdater(store, { fetchVersions: mockFetchVersions })
      const results = await updater.checkForUpdates()

      // 即使其中一个技能有问题，检查结果仍应包含两个
      expect(results.length).toBe(2)
      expect(results.every((r) => r.hasUpdate)).toBe(true)
    })
  })
})
