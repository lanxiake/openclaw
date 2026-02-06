/**
 * SystemService - 系统服务
 *
 * 提供文件操作、进程管理、系统信息等功能
 */

import { exec, spawn, ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import { join, dirname, basename, extname } from 'path'
import { promisify } from 'util'
import * as os from 'os'

const execAsync = promisify(exec)

// 日志输出
const log = {
  info: (...args: unknown[]) => console.log('[SystemService]', ...args),
  error: (...args: unknown[]) => console.error('[SystemService]', ...args),
  debug: (...args: unknown[]) => console.log('[SystemService:DEBUG]', ...args),
}

/**
 * 文件信息接口
 */
export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  createdAt: Date
  modifiedAt: Date
  extension: string
}

/**
 * 进程信息接口
 */
export interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memory: number
  status: string
}

/**
 * 系统信息接口
 */
export interface SystemInfo {
  platform: string
  arch: string
  hostname: string
  cpuModel: string
  cpuCores: number
  totalMemory: number
  freeMemory: number
  uptime: number
  osVersion: string
}

/**
 * 磁盘信息接口
 */
export interface DiskInfo {
  drive: string
  total: number
  free: number
  used: number
  usedPercent: number
}

/**
 * 系统服务类
 */
export class SystemService {
  /**
   * 列出目录内容
   */
  async listDirectory(dirPath: string): Promise<FileInfo[]> {
    log.info(`列出目录: ${dirPath}`)

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const files: FileInfo[] = []

      for (const entry of entries) {
        const filePath = join(dirPath, entry.name)
        try {
          const stats = await fs.stat(filePath)
          files.push({
            name: entry.name,
            path: filePath,
            isDirectory: entry.isDirectory(),
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            extension: entry.isDirectory() ? '' : extname(entry.name).toLowerCase(),
          })
        } catch (statError) {
          // 跳过无法访问的文件
          log.debug(`无法获取文件信息: ${filePath}`, statError)
        }
      }

      log.info(`找到 ${files.length} 个文件/文件夹`)
      return files
    } catch (error) {
      log.error(`列出目录失败: ${dirPath}`, error)
      throw error
    }
  }

  /**
   * 读取文件内容
   */
  async readFile(filePath: string): Promise<string> {
    log.info(`读取文件: ${filePath}`)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      log.info(`文件读取成功，大小: ${content.length} 字符`)
      return content
    } catch (error) {
      log.error(`读取文件失败: ${filePath}`, error)
      throw error
    }
  }

  /**
   * 写入文件内容
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    log.info(`写入文件: ${filePath}`)

    try {
      // 确保目录存在
      const dir = dirname(filePath)
      await fs.mkdir(dir, { recursive: true })

      await fs.writeFile(filePath, content, 'utf-8')
      log.info(`文件写入成功`)
    } catch (error) {
      log.error(`写入文件失败: ${filePath}`, error)
      throw error
    }
  }

  /**
   * 移动/重命名文件
   */
  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    log.info(`移动文件: ${sourcePath} -> ${destPath}`)

    try {
      // 确保目标目录存在
      const destDir = dirname(destPath)
      await fs.mkdir(destDir, { recursive: true })

      await fs.rename(sourcePath, destPath)
      log.info(`文件移动成功`)
    } catch (error) {
      log.error(`移动文件失败`, error)
      throw error
    }
  }

  /**
   * 复制文件
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    log.info(`复制文件: ${sourcePath} -> ${destPath}`)

    try {
      // 确保目标目录存在
      const destDir = dirname(destPath)
      await fs.mkdir(destDir, { recursive: true })

      await fs.copyFile(sourcePath, destPath)
      log.info(`文件复制成功`)
    } catch (error) {
      log.error(`复制文件失败`, error)
      throw error
    }
  }

  /**
   * 删除文件或目录
   */
  async deleteFile(filePath: string): Promise<void> {
    log.info(`删除文件/目录: ${filePath}`)

    try {
      const stats = await fs.stat(filePath)

      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true })
        log.info(`目录删除成功`)
      } else {
        await fs.unlink(filePath)
        log.info(`文件删除成功`)
      }
    } catch (error) {
      log.error(`删除失败: ${filePath}`, error)
      throw error
    }
  }

  /**
   * 创建目录
   */
  async createDirectory(dirPath: string): Promise<void> {
    log.info(`创建目录: ${dirPath}`)

    try {
      await fs.mkdir(dirPath, { recursive: true })
      log.info(`目录创建成功`)
    } catch (error) {
      log.error(`创建目录失败: ${dirPath}`, error)
      throw error
    }
  }

  /**
   * 检查文件/目录是否存在
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    log.info(`获取文件信息: ${filePath}`)

    try {
      const stats = await fs.stat(filePath)
      return {
        name: basename(filePath),
        path: filePath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        extension: stats.isDirectory() ? '' : extname(filePath).toLowerCase(),
      }
    } catch (error) {
      log.error(`获取文件信息失败: ${filePath}`, error)
      throw error
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(
    dirPath: string,
    pattern: string,
    options: { recursive?: boolean; maxResults?: number } = {}
  ): Promise<FileInfo[]> {
    const { recursive = true, maxResults = 100 } = options
    log.info(`搜索文件: ${dirPath}, 模式: ${pattern}`)

    const results: FileInfo[] = []
    const regex = new RegExp(pattern, 'i')

    const search = async (currentPath: string) => {
      if (results.length >= maxResults) {
        return
      }

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true })

        for (const entry of entries) {
          if (results.length >= maxResults) {
            break
          }

          const filePath = join(currentPath, entry.name)

          if (regex.test(entry.name)) {
            try {
              const stats = await fs.stat(filePath)
              results.push({
                name: entry.name,
                path: filePath,
                isDirectory: entry.isDirectory(),
                size: stats.size,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                extension: entry.isDirectory() ? '' : extname(entry.name).toLowerCase(),
              })
            } catch {
              // 跳过无法访问的文件
            }
          }

          if (recursive && entry.isDirectory()) {
            await search(filePath)
          }
        }
      } catch {
        // 跳过无法访问的目录
      }
    }

    await search(dirPath)
    log.info(`找到 ${results.length} 个匹配文件`)
    return results
  }

  /**
   * 获取系统信息
   */
  getSystemInfo(): SystemInfo {
    log.info(`获取系统信息`)

    const cpus = os.cpus()
    const info: SystemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpuModel: cpus[0]?.model || 'Unknown',
      cpuCores: cpus.length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      osVersion: os.release(),
    }

    log.info(`系统信息: ${info.platform} ${info.arch}, ${info.cpuCores} 核心`)
    return info
  }

  /**
   * 获取磁盘信息 (Windows)
   */
  async getDiskInfo(): Promise<DiskInfo[]> {
    log.info(`获取磁盘信息`)

    try {
      // 使用 PowerShell 获取磁盘信息
      const { stdout } = await execAsync(
        'powershell -Command "Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | Select-Object DeviceID, Size, FreeSpace | ConvertTo-Json"'
      )

      const disks = JSON.parse(stdout)
      const diskArray = Array.isArray(disks) ? disks : [disks]

      const result: DiskInfo[] = diskArray.map((disk: { DeviceID: string; Size: number; FreeSpace: number }) => {
        const total = disk.Size || 0
        const free = disk.FreeSpace || 0
        const used = total - free
        return {
          drive: disk.DeviceID,
          total,
          free,
          used,
          usedPercent: total > 0 ? Math.round((used / total) * 100) : 0,
        }
      })

      log.info(`找到 ${result.length} 个磁盘`)
      return result
    } catch (error) {
      log.error(`获取磁盘信息失败`, error)
      return []
    }
  }

  /**
   * 获取进程列表
   */
  async getProcessList(): Promise<ProcessInfo[]> {
    log.info(`获取进程列表`)

    try {
      // 使用 PowerShell 获取进程信息
      const { stdout } = await execAsync(
        'powershell -Command "Get-Process | Select-Object Id, ProcessName, CPU, WorkingSet64 | ConvertTo-Json"'
      )

      const processes = JSON.parse(stdout)
      const processArray = Array.isArray(processes) ? processes : [processes]

      const result: ProcessInfo[] = processArray.map(
        (proc: { Id: number; ProcessName: string; CPU: number; WorkingSet64: number }) => ({
          pid: proc.Id,
          name: proc.ProcessName,
          cpu: proc.CPU || 0,
          memory: proc.WorkingSet64 || 0,
          status: 'running',
        })
      )

      log.info(`找到 ${result.length} 个进程`)
      return result
    } catch (error) {
      log.error(`获取进程列表失败`, error)
      return []
    }
  }

  /**
   * 结束进程
   */
  async killProcess(pid: number): Promise<void> {
    log.info(`结束进程: ${pid}`)

    try {
      await execAsync(`taskkill /PID ${pid} /F`)
      log.info(`进程已结束: ${pid}`)
    } catch (error) {
      log.error(`结束进程失败: ${pid}`, error)
      throw error
    }
  }

  /**
   * 启动程序
   */
  launchApplication(appPath: string, args: string[] = []): ChildProcess {
    log.info(`启动程序: ${appPath}`, args)

    const child = spawn(appPath, args, {
      detached: true,
      stdio: 'ignore',
    })

    child.unref()
    log.info(`程序已启动, PID: ${child.pid}`)

    return child
  }

  /**
   * 执行命令
   */
  async executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    log.info(`执行命令: ${command}`)

    try {
      const result = await execAsync(command)
      log.info(`命令执行成功`)
      return result
    } catch (error) {
      log.error(`命令执行失败`, error)
      throw error
    }
  }

  /**
   * 获取环境变量
   */
  getEnvVariable(name: string): string | undefined {
    return process.env[name]
  }

  /**
   * 获取用户目录路径
   */
  getUserPaths(): { home: string; desktop: string; documents: string; downloads: string } {
    const home = os.homedir()
    return {
      home,
      desktop: join(home, 'Desktop'),
      documents: join(home, 'Documents'),
      downloads: join(home, 'Downloads'),
    }
  }
}
