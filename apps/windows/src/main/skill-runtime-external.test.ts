/**
 * ClientSkillRuntime 外部技能加载集成测试
 *
 * 测试 initialize() 从 LocalSkillStore 加载技能
 * 以及 reloadExternalSkills() 重新加载功能
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// Mock electron
vi.mock('electron', () => ({
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  },
  BrowserWindow: vi.fn(),
}))

import { ClientSkillRuntime } from './skill-runtime'
import type { SystemService } from './system-service'
import type { SkillManifest } from './skill-store'

/**
 * 创建 mock SystemService
 */
function createMockSystemService(): SystemService {
  return {
    listDirectory: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    getSystemInfo: vi.fn().mockReturnValue({
      platform: 'win32',
      arch: 'x64',
      hostname: 'test',
      release: '10.0',
      cpuModel: 'Test CPU',
      cpuCores: 4,
      totalMemory: 8_000_000_000,
      freeMemory: 4_000_000_000,
      usedMemory: 4_000_000_000,
      memoryUsagePercent: 50,
      uptime: 3600,
    }),
    executeCommand: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
    getUserPaths: vi.fn().mockReturnValue({
      home: '/mock/home',
      desktop: '/mock/desktop',
      documents: '/mock/documents',
      downloads: '/mock/downloads',
    }),
  } as unknown as SystemService
}

/**
 * 在临时目录中创建技能文件
 */
function createSkillFiles(
  skillsDir: string,
  manifest: SkillManifest,
  entryContent: string,
): void {
  // 创建技能目录（使用 sanitized id）
  const skillDir = path.join(skillsDir, manifest.id.replace(/[^a-zA-Z0-9._-]/g, '_'))
  fs.mkdirSync(skillDir, { recursive: true })

  // 写入 skill.json
  fs.writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify(manifest, null, 2))

  // 确保入口文件目录存在
  const entryDir = path.dirname(path.join(skillDir, manifest.entry))
  fs.mkdirSync(entryDir, { recursive: true })

  // 写入入口文件
  fs.writeFileSync(path.join(skillDir, manifest.entry), entryContent)

  // 写入/更新 index.json
  const indexPath = path.join(skillsDir, 'index.json')
  let index = { version: 1, updatedAt: new Date().toISOString(), skills: [] as Array<Record<string, unknown>> }

  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  }

  // 添加到索引
  const entry = {
    id: manifest.id,
    dirName: manifest.id.replace(/[^a-zA-Z0-9._-]/g, '_'),
    name: manifest.name,
    version: manifest.version,
    runtime: manifest.runtime,
    installedAt: new Date().toISOString(),
    enabled: true,
    executionCount: 0,
  }

  const existingIdx = index.skills.findIndex((s: Record<string, unknown>) => s.id === manifest.id)
  if (existingIdx >= 0) {
    index.skills[existingIdx] = entry
  } else {
    index.skills.push(entry)
  }

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2))
}

describe('ClientSkillRuntime - 外部技能加载', () => {
  let tempDir: string
  let skillsDir: string
  let runtime: ClientSkillRuntime
  let mockSystemService: SystemService

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-runtime-ext-'))
    skillsDir = path.join(tempDir, 'skills')
    fs.mkdirSync(skillsDir, { recursive: true })

    mockSystemService = createMockSystemService()
    runtime = new ClientSkillRuntime(mockSystemService)
  })

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true })
  })

  it('EXT-001: initialize 加载外部 JS 技能', async () => {
    // 创建一个简单的 JS 技能
    createSkillFiles(
      skillsDir,
      {
        id: 'test-js-skill',
        name: 'JS 测试技能',
        version: '1.0.0',
        entry: 'index.js',
        runtime: 'javascript',
      },
      `
const params = JSON.parse(process.env.SKILL_PARAMS || '{}')
console.log('__SKILL_RESULT__:' + JSON.stringify({ echo: params.message || 'hello' }))
`,
    )

    await runtime.initialize(skillsDir)

    // 验证技能已加载
    const skill = runtime.getSkill('test-js-skill')
    expect(skill).toBeDefined()
    expect(skill?.name).toBe('JS 测试技能')

    // 验证技能列表包含内置 + 外部
    const allSkills = runtime.listSkills()
    expect(allSkills.length).toBeGreaterThan(4) // 4 个内置 + 1 个外部
    expect(allSkills.some((s) => s.id === 'test-js-skill')).toBe(true)
  })

  it('EXT-002: 执行外部 JS 技能', async () => {
    createSkillFiles(
      skillsDir,
      {
        id: 'echo-skill',
        name: 'Echo',
        version: '1.0.0',
        entry: 'index.js',
        runtime: 'javascript',
      },
      `
const params = JSON.parse(process.env.SKILL_PARAMS || '{}')
const result = { echo: params.input, timestamp: Date.now() }
console.log('__SKILL_RESULT__:' + JSON.stringify(result))
`,
    )

    await runtime.initialize(skillsDir)

    const result = await runtime.executeSkill({
      requestId: 'ext-001',
      skillId: 'echo-skill',
      params: { input: 'test message' },
      requireConfirm: false,
      timeoutMs: 10000,
      runMode: 'local',
    })

    expect(result.success).toBe(true)
    expect(result.requestId).toBe('ext-001')
    const data = result.result as { echo: string; timestamp: number }
    expect(data.echo).toBe('test message')
    expect(data.timestamp).toBeGreaterThan(0)
  }, 15000)

  it('EXT-003: 跳过已禁用的外部技能', async () => {
    // 创建技能文件
    createSkillFiles(
      skillsDir,
      {
        id: 'disabled-skill',
        name: 'Disabled',
        version: '1.0.0',
        entry: 'index.js',
        runtime: 'javascript',
      },
      'console.log("should not run")',
    )

    // 手动将索引中的技能设为 disabled
    const indexPath = path.join(skillsDir, 'index.json')
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
    index.skills[0].enabled = false
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2))

    await runtime.initialize(skillsDir)

    const skill = runtime.getSkill('disabled-skill')
    expect(skill).toBeUndefined()
  })

  it('EXT-004: reloadExternalSkills 重新加载', async () => {
    await runtime.initialize(skillsDir)
    expect(runtime.listSkills().length).toBe(4) // 只有内置

    // 动态添加技能
    createSkillFiles(
      skillsDir,
      {
        id: 'new-skill',
        name: 'New Skill',
        version: '1.0.0',
        entry: 'index.js',
        runtime: 'javascript',
      },
      'console.log("__SKILL_RESULT__:" + JSON.stringify({ ok: true }))',
    )

    await runtime.reloadExternalSkills()

    const allSkills = runtime.listSkills()
    expect(allSkills.some((s) => s.id === 'new-skill')).toBe(true)
  })

  it('EXT-005: 空 skillsDir 只加载内置技能', async () => {
    await runtime.initialize(skillsDir)

    const allSkills = runtime.listSkills()
    expect(allSkills.length).toBe(4) // 4 个内置
    expect(allSkills.every((s) => s.id.startsWith('builtin:'))).toBe(true)
  })

  it('EXT-006: getSkillStore 返回 store 实例', async () => {
    await runtime.initialize(skillsDir)
    const store = runtime.getSkillStore()
    expect(store).not.toBeNull()
  })

  it('EXT-007: 加载 Python runtime 技能', async () => {
    createSkillFiles(
      skillsDir,
      {
        id: 'test-py-skill',
        name: 'Python 测试技能',
        version: '1.0.0',
        entry: 'main.py',
        runtime: 'python',
      },
      `
import json
print("__SKILL_RESULT__:" + json.dumps({"lang": "python"}))
`,
    )

    await runtime.initialize(skillsDir)

    const skill = runtime.getSkill('test-py-skill')
    expect(skill).toBeDefined()
    expect(skill?.name).toBe('Python 测试技能')
  })

  it('EXT-008: 加载 Shell runtime 技能', async () => {
    const isWin = process.platform === 'win32'
    const entry = isWin ? 'run.bat' : 'run.sh'
    const content = isWin
      ? '@echo off\necho __SKILL_RESULT__:{"lang":"shell"}'
      : '#!/bin/bash\necho \'__SKILL_RESULT__:{"lang":"shell"}\''

    createSkillFiles(
      skillsDir,
      {
        id: 'test-sh-skill',
        name: 'Shell 测试技能',
        version: '1.0.0',
        entry,
        runtime: 'shell',
      },
      content,
    )

    await runtime.initialize(skillsDir)

    const skill = runtime.getSkill('test-sh-skill')
    expect(skill).toBeDefined()
    expect(skill?.name).toBe('Shell 测试技能')
  })

  it('EXT-009: 不支持的 runtime 类型不加载', async () => {
    // 直接写入 skill 文件，使用不存在的 runtime
    const skillDir = path.join(skillsDir, 'unsupported-skill')
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(
      path.join(skillDir, 'skill.json'),
      JSON.stringify({
        id: 'unsupported-skill',
        name: 'Unsupported',
        version: '1.0.0',
        entry: 'main.rb',
        runtime: 'ruby',
      }),
    )
    fs.writeFileSync(path.join(skillDir, 'main.rb'), 'puts "hello"')

    // 写入 index.json
    const indexPath = path.join(skillsDir, 'index.json')
    const index = {
      version: 1,
      updatedAt: new Date().toISOString(),
      skills: [
        {
          id: 'unsupported-skill',
          dirName: 'unsupported-skill',
          name: 'Unsupported',
          version: '1.0.0',
          runtime: 'ruby',
          installedAt: new Date().toISOString(),
          enabled: true,
          executionCount: 0,
        },
      ],
    }
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2))

    await runtime.initialize(skillsDir)

    // 不支持的 runtime 不应该被加载
    const skill = runtime.getSkill('unsupported-skill')
    expect(skill).toBeUndefined()
  })
})
