/**
 * TypeScript Runner - 通过子进程执行 TypeScript/JavaScript 技能脚本
 *
 * 特性：
 * - 通过 node/tsx 执行 TS/JS 入口文件
 * - 通过环境变量传递参数 (SKILL_PARAMS)
 * - 从 stdout 收集 JSON 结果
 * - 内存限制 (--max-old-space-size)
 * - 超时自动 kill
 */

import { spawn, type ChildProcess } from 'node:child_process'
import * as path from 'node:path'

/** 日志 */
const log = {
  info: (...args: unknown[]) => console.log('[TSRunner]', ...args),
  error: (...args: unknown[]) => console.error('[TSRunner]', ...args),
  warn: (...args: unknown[]) => console.warn('[TSRunner]', ...args),
  debug: (...args: unknown[]) => console.log('[TSRunner:Debug]', ...args),
}

/**
 * Runner 执行选项
 */
export interface RunnerOptions {
  /** 入口文件绝对路径 */
  entryPath: string
  /** 执行参数 (通过环境变量传递) */
  params: Record<string, unknown>
  /** 超时毫秒数 */
  timeoutMs: number
  /** 内存限制 MB */
  maxMemoryMb?: number
  /** 取消信号 */
  abortSignal?: AbortSignal
  /** 工作目录（默认为入口文件所在目录） */
  cwd?: string
}

/**
 * Runner 执行结果
 */
export interface RunnerResult {
  /** 是否成功 */
  success: boolean
  /** 返回数据 (stdout 中的 JSON) */
  result?: unknown
  /** 错误信息 */
  error?: string
  /** 退出码 */
  exitCode: number | null
  /** 执行耗时 */
  executionTimeMs: number
  /** stdout 原始输出 */
  stdout: string
  /** stderr 原始输出 */
  stderr: string
}

/**
 * TypeScript/JavaScript 技能脚本运行器
 */
export class TypeScriptRunner {
  private readonly nodePath: string
  private readonly defaultMaxMemoryMb: number

  constructor(opts?: { nodePath?: string; defaultMaxMemoryMb?: number }) {
    this.nodePath = opts?.nodePath ?? 'node'
    this.defaultMaxMemoryMb = opts?.defaultMaxMemoryMb ?? 256
  }

  /**
   * 执行技能脚本
   *
   * 脚本约定：
   * - 通过 process.env.SKILL_PARAMS 读取 JSON 参数
   * - 在 stdout 输出一行 JSON 作为结果（以 `__SKILL_RESULT__:` 为前缀）
   * - 非零退出码视为失败
   */
  async execute(options: RunnerOptions): Promise<RunnerResult> {
    const startTime = Date.now()
    const {
      entryPath,
      params,
      timeoutMs,
      maxMemoryMb = this.defaultMaxMemoryMb,
      abortSignal,
      cwd,
    } = options

    log.info('执行技能脚本', {
      entryPath,
      timeoutMs,
      maxMemoryMb,
    })

    const ext = path.extname(entryPath).toLowerCase()
    const args = buildNodeArgs(entryPath, ext, maxMemoryMb)

    return new Promise<RunnerResult>((resolve) => {
      let child: ChildProcess
      let stdout = ''
      let stderr = ''
      let killed = false
      let timeoutId: ReturnType<typeof setTimeout> | null = null

      try {
        child = spawn(this.nodePath, args, {
          cwd: cwd ?? path.dirname(entryPath),
          env: {
            ...process.env,
            SKILL_PARAMS: JSON.stringify(params),
            NODE_OPTIONS: `--max-old-space-size=${maxMemoryMb}`,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.error('启动子进程失败', { error: errorMessage })
        return resolve({
          success: false,
          error: `启动子进程失败: ${errorMessage}`,
          exitCode: null,
          executionTimeMs: Date.now() - startTime,
          stdout: '',
          stderr: '',
        })
      }

      // 收集 stdout
      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
      })

      // 收集 stderr
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      // 超时处理
      timeoutId = setTimeout(() => {
        if (!killed) {
          killed = true
          log.warn('技能脚本执行超时，终止子进程', { entryPath, timeoutMs })
          child.kill('SIGTERM')
          // 给进程 2 秒优雅退出时间
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL')
            }
          }, 2000)
        }
      }, timeoutMs)

      // 外部取消信号
      if (abortSignal) {
        const onAbort = () => {
          if (!killed) {
            killed = true
            log.info('技能脚本被外部取消', { entryPath })
            child.kill('SIGTERM')
          }
        }
        abortSignal.addEventListener('abort', onAbort, { once: true })
      }

      // 进程退出
      child.on('close', (exitCode) => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        const executionTimeMs = Date.now() - startTime

        log.info('技能脚本执行完成', {
          entryPath,
          exitCode,
          executionTimeMs,
          killed,
        })

        if (killed) {
          return resolve({
            success: false,
            error: '执行被终止（超时或取消）',
            exitCode,
            executionTimeMs,
            stdout,
            stderr,
          })
        }

        if (exitCode !== 0) {
          return resolve({
            success: false,
            error: stderr.trim() || `进程退出码: ${exitCode}`,
            exitCode,
            executionTimeMs,
            stdout,
            stderr,
          })
        }

        // 从 stdout 中提取结果
        const result = extractResult(stdout)

        resolve({
          success: true,
          result,
          exitCode,
          executionTimeMs,
          stdout,
          stderr,
        })
      })

      // 进程错误
      child.on('error', (err) => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        log.error('子进程错误', { error: err.message })
        resolve({
          success: false,
          error: `子进程错误: ${err.message}`,
          exitCode: null,
          executionTimeMs: Date.now() - startTime,
          stdout,
          stderr,
        })
      })
    })
  }
}

/**
 * 结果标记前缀
 *
 * 技能脚本在 stdout 中以此前缀输出 JSON 结果行
 */
export const RESULT_PREFIX = '__SKILL_RESULT__:'

/**
 * 构建 node 执行参数
 */
function buildNodeArgs(entryPath: string, ext: string, maxMemoryMb: number): string[] {
  const args: string[] = []

  // TypeScript 文件需要 loader
  if (ext === '.ts' || ext === '.tsx') {
    args.push('--import', 'tsx')
  }

  args.push(entryPath)
  return args
}

/**
 * 从 stdout 中提取技能执行结果
 *
 * 查找以 __SKILL_RESULT__: 为前缀的行，解析其 JSON 内容
 * 如果没有找到结果标记，将整个 stdout 作为字符串返回
 */
export function extractResult(stdout: string): unknown {
  const lines = stdout.split('\n')

  // 从后往前查找结果行（取最后一个结果）
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (line.startsWith(RESULT_PREFIX)) {
      const jsonStr = line.slice(RESULT_PREFIX.length).trim()
      try {
        return JSON.parse(jsonStr)
      } catch {
        log.warn('结果 JSON 解析失败', { line })
        return jsonStr
      }
    }
  }

  // 没有找到结果标记，尝试将最后一行非空内容作为 JSON 解析
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (line) {
      try {
        return JSON.parse(line)
      } catch {
        // 非 JSON，返回原始 stdout
        return stdout.trim()
      }
    }
  }

  return null
}
