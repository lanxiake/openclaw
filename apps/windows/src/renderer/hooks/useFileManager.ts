/**
 * useFileManager Hook - 文件管理
 *
 * 管理文件浏览和操作的自定义 Hook
 */

import { useState, useCallback, useEffect } from 'react'

/**
 * 文件信息
 */
export interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: Date
  createdAt: Date
  extension?: string
  icon?: string
}

/**
 * 用户路径
 */
export interface UserPaths {
  home: string
  desktop: string
  documents: string
  downloads: string
}

/**
 * 文件排序方式
 */
export type FileSortBy = 'name' | 'size' | 'date' | 'type'
export type SortOrder = 'asc' | 'desc'

interface UseFileManagerReturn {
  /** 当前路径 */
  currentPath: string
  /** 文件列表 */
  files: FileItem[]
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 用户路径 */
  userPaths: UserPaths | null
  /** 选中的文件 */
  selectedFiles: Set<string>
  /** 排序方式 */
  sortBy: FileSortBy
  /** 排序顺序 */
  sortOrder: SortOrder
  /** 导航历史 */
  history: string[]
  /** 历史位置 */
  historyIndex: number
  /** 导航到指定路径 */
  navigateTo: (path: string) => Promise<void>
  /** 刷新当前目录 */
  refresh: () => Promise<void>
  /** 返回上一级 */
  goUp: () => void
  /** 返回上一个历史记录 */
  goBack: () => void
  /** 前进到下一个历史记录 */
  goForward: () => void
  /** 切换文件选中状态 */
  toggleSelect: (path: string) => void
  /** 选中所有文件 */
  selectAll: () => void
  /** 取消所有选中 */
  clearSelection: () => void
  /** 设置排序方式 */
  setSorting: (sortBy: FileSortBy, order?: SortOrder) => void
  /** 创建文件夹 */
  createFolder: (name: string) => Promise<void>
  /** 删除选中的文件 */
  deleteSelected: () => Promise<void>
  /** 重命名文件 */
  renameFile: (oldPath: string, newName: string) => Promise<void>
  /** 复制文件 */
  copyFiles: (sourcePaths: string[], destDir: string) => Promise<void>
  /** 移动文件 */
  moveFiles: (sourcePaths: string[], destDir: string) => Promise<void>
  /** 搜索文件 */
  searchFiles: (pattern: string) => Promise<FileItem[]>
  /** 读取文件内容 */
  readFile: (path: string) => Promise<string>
  /** 获取文件信息 */
  getFileInfo: (path: string) => Promise<FileItem | null>
}

/**
 * 获取文件扩展名
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot === 0) return ''
  return filename.slice(lastDot + 1).toLowerCase()
}

/**
 * 获取文件图标
 */
function getFileIcon(item: FileItem): string {
  if (item.isDirectory) return '📁'

  const ext = item.extension || getExtension(item.name)
  const iconMap: Record<string, string> = {
    // 文档
    txt: '📄',
    md: '📝',
    doc: '📄',
    docx: '📄',
    pdf: '📕',
    xls: '📊',
    xlsx: '📊',
    ppt: '📊',
    pptx: '📊',
    // 代码
    js: '📜',
    ts: '📜',
    jsx: '📜',
    tsx: '📜',
    json: '📋',
    html: '🌐',
    css: '🎨',
    py: '🐍',
    java: '☕',
    c: '📜',
    cpp: '📜',
    h: '📜',
    // 图片
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    svg: '🖼️',
    ico: '🖼️',
    webp: '🖼️',
    // 视频
    mp4: '🎬',
    avi: '🎬',
    mkv: '🎬',
    mov: '🎬',
    wmv: '🎬',
    // 音频
    mp3: '🎵',
    wav: '🎵',
    flac: '🎵',
    aac: '🎵',
    // 压缩
    zip: '📦',
    rar: '📦',
    '7z': '📦',
    tar: '📦',
    gz: '📦',
    // 可执行
    exe: '⚙️',
    msi: '⚙️',
    bat: '⚙️',
    sh: '⚙️',
  }

  return iconMap[ext] || '📄'
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

/**
 * 文件管理 Hook 配置项
 */
interface UseFileManagerOptions {
  /** 初始路径 */
  initialPath?: string
  /** 根路径约束（不允许导航到此目录之外） */
  rootPath?: string
}

/**
 * 文件管理 Hook
 */
export function useFileManager(options?: UseFileManagerOptions): UseFileManagerReturn {
  const initialPath = options?.initialPath
  const rootPath = options?.rootPath

  const [currentPath, setCurrentPath] = useState(initialPath || '')
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userPaths, setUserPaths] = useState<UserPaths | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<FileSortBy>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  /**
   * 初始化获取用户路径
   */
  useEffect(() => {
    console.log('[useFileManager] 初始化')
    if (initialPath) {
      // 有初始路径时直接导航，不获取 userPaths
      navigateTo(initialPath)
    } else {
      window.electronAPI.system.getUserPaths().then((paths) => {
        console.log('[useFileManager] 用户路径:', paths)
        setUserPaths(paths)
        // 如果没有初始路径，默认打开用户主目录
        if (paths.home) {
          navigateTo(paths.home)
        }
      })
    }
  }, [])

  /**
   * 排序文件列表
   */
  const sortFiles = useCallback(
    (fileList: FileItem[]): FileItem[] => {
      const sorted = [...fileList].sort((a, b) => {
        // 文件夹始终排在前面
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1
        }

        let comparison = 0
        switch (sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
            break
          case 'size':
            comparison = a.size - b.size
            break
          case 'date':
            comparison = a.modifiedAt.getTime() - b.modifiedAt.getTime()
            break
          case 'type':
            comparison = (a.extension || '').localeCompare(b.extension || '')
            break
        }

        return sortOrder === 'asc' ? comparison : -comparison
      })

      return sorted
    },
    [sortBy, sortOrder]
  )

  /**
   * 导航到指定路径
   */
  const navigateTo = useCallback(
    async (path: string) => {
      // 根路径约束：不允许导航到根路径之外
      if (rootPath) {
        const normalizedPath = path.replace(/\\/g, '/')
        const normalizedRoot = rootPath.replace(/\\/g, '/')
        if (!normalizedPath.startsWith(normalizedRoot)) {
          console.warn('[useFileManager] 阻止导航到工作空间外:', path)
          return
        }
      }

      console.log('[useFileManager] 导航到:', path)
      setIsLoading(true)
      setError(null)
      setSelectedFiles(new Set())

      try {
        const rawFiles = (await window.electronAPI.file.list(path)) as Array<{
          name: string
          path: string
          isDirectory: boolean
          size: number
          modifiedAt: string
          createdAt: string
        }>

        const fileItems: FileItem[] = rawFiles.map((f) => {
          const ext = f.isDirectory ? undefined : getExtension(f.name)
          const item: FileItem = {
            name: f.name,
            path: f.path,
            isDirectory: f.isDirectory,
            size: f.size,
            modifiedAt: new Date(f.modifiedAt),
            createdAt: new Date(f.createdAt),
            extension: ext,
          }
          item.icon = getFileIcon(item)
          return item
        })

        setFiles(sortFiles(fileItems))
        setCurrentPath(path)

        // 更新历史记录
        setHistory((prev) => {
          const newHistory = prev.slice(0, historyIndex + 1)
          newHistory.push(path)
          return newHistory
        })
        setHistoryIndex((prev) => prev + 1)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '无法打开目录'
        console.error('[useFileManager] 导航失败:', errorMessage)
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    },
    [sortFiles, historyIndex, rootPath]
  )

  /**
   * 刷新当前目录
   */
  const refresh = useCallback(async () => {
    if (currentPath) {
      setIsLoading(true)
      setError(null)

      try {
        const rawFiles = (await window.electronAPI.file.list(currentPath)) as Array<{
          name: string
          path: string
          isDirectory: boolean
          size: number
          modifiedAt: string
          createdAt: string
        }>

        const fileItems: FileItem[] = rawFiles.map((f) => {
          const ext = f.isDirectory ? undefined : getExtension(f.name)
          const item: FileItem = {
            name: f.name,
            path: f.path,
            isDirectory: f.isDirectory,
            size: f.size,
            modifiedAt: new Date(f.modifiedAt),
            createdAt: new Date(f.createdAt),
            extension: ext,
          }
          item.icon = getFileIcon(item)
          return item
        })

        setFiles(sortFiles(fileItems))
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '刷新失败'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }
  }, [currentPath, sortFiles])

  /**
   * 返回上一级
   */
  const goUp = useCallback(() => {
    if (!currentPath) return

    // 根路径约束：已在根目录时不允许上行
    if (rootPath) {
      const normalizedCurrent = currentPath.replace(/\\/g, '/')
      const normalizedRoot = rootPath.replace(/\\/g, '/')
      if (normalizedCurrent === normalizedRoot || normalizedCurrent === normalizedRoot + '/') {
        return
      }
    }

    // 使用路径分隔符处理
    const normalized = currentPath.replace(/\\/g, '/')
    const parts = normalized.split('/').filter(Boolean)
    if (parts.length <= 1) {
      // Windows 盘符根目录
      navigateTo(parts[0] + '/')
    } else {
      parts.pop()
      const parentPath = parts.join('/')
      navigateTo(parentPath.includes(':') ? parentPath : '/' + parentPath)
    }
  }, [currentPath, navigateTo, rootPath])

  /**
   * 返回上一个历史记录
   */
  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setCurrentPath(history[newIndex])
      // 重新加载文件列表但不更新历史
      window.electronAPI.file.list(history[newIndex]).then((rawFiles) => {
        const fileItems = (rawFiles as Array<{
          name: string
          path: string
          isDirectory: boolean
          size: number
          modifiedAt: string
          createdAt: string
        }>).map((f) => {
          const ext = f.isDirectory ? undefined : getExtension(f.name)
          const item: FileItem = {
            name: f.name,
            path: f.path,
            isDirectory: f.isDirectory,
            size: f.size,
            modifiedAt: new Date(f.modifiedAt),
            createdAt: new Date(f.createdAt),
            extension: ext,
          }
          item.icon = getFileIcon(item)
          return item
        })
        setFiles(sortFiles(fileItems))
      })
    }
  }, [historyIndex, history, sortFiles])

  /**
   * 前进到下一个历史记录
   */
  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setCurrentPath(history[newIndex])
      // 重新加载文件列表
      window.electronAPI.file.list(history[newIndex]).then((rawFiles) => {
        const fileItems = (rawFiles as Array<{
          name: string
          path: string
          isDirectory: boolean
          size: number
          modifiedAt: string
          createdAt: string
        }>).map((f) => {
          const ext = f.isDirectory ? undefined : getExtension(f.name)
          const item: FileItem = {
            name: f.name,
            path: f.path,
            isDirectory: f.isDirectory,
            size: f.size,
            modifiedAt: new Date(f.modifiedAt),
            createdAt: new Date(f.createdAt),
            extension: ext,
          }
          item.icon = getFileIcon(item)
          return item
        })
        setFiles(sortFiles(fileItems))
      })
    }
  }, [historyIndex, history, sortFiles])

  /**
   * 切换文件选中状态
   */
  const toggleSelect = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }, [])

  /**
   * 选中所有文件
   */
  const selectAll = useCallback(() => {
    setSelectedFiles(new Set(files.map((f) => f.path)))
  }, [files])

  /**
   * 取消所有选中
   */
  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set())
  }, [])

  /**
   * 设置排序方式
   */
  const setSorting = useCallback(
    (newSortBy: FileSortBy, order?: SortOrder) => {
      const newOrder = order || (sortBy === newSortBy && sortOrder === 'asc' ? 'desc' : 'asc')
      setSortBy(newSortBy)
      setSortOrder(newOrder)

      // 重新排序当前文件列表
      setFiles((prev) => {
        const sorted = [...prev].sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1
          }

          let comparison = 0
          switch (newSortBy) {
            case 'name':
              comparison = a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
              break
            case 'size':
              comparison = a.size - b.size
              break
            case 'date':
              comparison = a.modifiedAt.getTime() - b.modifiedAt.getTime()
              break
            case 'type':
              comparison = (a.extension || '').localeCompare(b.extension || '')
              break
          }

          return newOrder === 'asc' ? comparison : -comparison
        })
        return sorted
      })
    },
    [sortBy, sortOrder]
  )

  /**
   * 创建文件夹
   */
  const createFolder = useCallback(
    async (name: string) => {
      const newPath = currentPath.replace(/\\/g, '/') + '/' + name
      console.log('[useFileManager] 创建文件夹:', newPath)

      try {
        await window.electronAPI.file.createDir(newPath)
        await refresh()
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : '创建文件夹失败')
      }
    },
    [currentPath, refresh]
  )

  /**
   * 删除选中的文件
   */
  const deleteSelected = useCallback(async () => {
    console.log('[useFileManager] 删除文件:', Array.from(selectedFiles))

    try {
      for (const path of selectedFiles) {
        await window.electronAPI.file.delete(path)
      }
      setSelectedFiles(new Set())
      await refresh()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '删除失败')
    }
  }, [selectedFiles, refresh])

  /**
   * 重命名文件
   */
  const renameFile = useCallback(
    async (oldPath: string, newName: string) => {
      const dir = oldPath.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
      const newPath = dir + '/' + newName
      console.log('[useFileManager] 重命名:', oldPath, '->', newPath)

      try {
        await window.electronAPI.file.move(oldPath, newPath)
        await refresh()
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : '重命名失败')
      }
    },
    [refresh]
  )

  /**
   * 复制文件
   */
  const copyFiles = useCallback(
    async (sourcePaths: string[], destDir: string) => {
      console.log('[useFileManager] 复制文件到:', destDir)

      try {
        for (const sourcePath of sourcePaths) {
          const fileName = sourcePath.replace(/\\/g, '/').split('/').pop()
          const destPath = destDir.replace(/\\/g, '/') + '/' + fileName
          await window.electronAPI.file.copy(sourcePath, destPath)
        }
        await refresh()
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : '复制失败')
      }
    },
    [refresh]
  )

  /**
   * 移动文件
   */
  const moveFiles = useCallback(
    async (sourcePaths: string[], destDir: string) => {
      console.log('[useFileManager] 移动文件到:', destDir)

      try {
        for (const sourcePath of sourcePaths) {
          const fileName = sourcePath.replace(/\\/g, '/').split('/').pop()
          const destPath = destDir.replace(/\\/g, '/') + '/' + fileName
          await window.electronAPI.file.move(sourcePath, destPath)
        }
        setSelectedFiles(new Set())
        await refresh()
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : '移动失败')
      }
    },
    [refresh]
  )

  /**
   * 搜索文件
   */
  const searchFiles = useCallback(
    async (pattern: string): Promise<FileItem[]> => {
      console.log('[useFileManager] 搜索:', pattern)

      try {
        const results = (await window.electronAPI.file.search(currentPath, pattern, {
          recursive: true,
          maxResults: 100,
        })) as Array<{
          name: string
          path: string
          isDirectory: boolean
          size: number
          modifiedAt: string
          createdAt: string
        }>

        return results.map((f) => {
          const ext = f.isDirectory ? undefined : getExtension(f.name)
          const item: FileItem = {
            name: f.name,
            path: f.path,
            isDirectory: f.isDirectory,
            size: f.size,
            modifiedAt: new Date(f.modifiedAt),
            createdAt: new Date(f.createdAt),
            extension: ext,
          }
          item.icon = getFileIcon(item)
          return item
        })
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : '搜索失败')
      }
    },
    [currentPath]
  )

  /**
   * 读取文件内容
   */
  const readFile = useCallback(async (path: string): Promise<string> => {
    return window.electronAPI.file.read(path)
  }, [])

  /**
   * 获取文件信息
   */
  const getFileInfo = useCallback(async (path: string): Promise<FileItem | null> => {
    try {
      const info = (await window.electronAPI.file.getInfo(path)) as {
        name: string
        path: string
        isDirectory: boolean
        size: number
        modifiedAt: string
        createdAt: string
      }

      const ext = info.isDirectory ? undefined : getExtension(info.name)
      const item: FileItem = {
        name: info.name,
        path: info.path,
        isDirectory: info.isDirectory,
        size: info.size,
        modifiedAt: new Date(info.modifiedAt),
        createdAt: new Date(info.createdAt),
        extension: ext,
      }
      item.icon = getFileIcon(item)
      return item
    } catch {
      return null
    }
  }, [])

  return {
    currentPath,
    files,
    isLoading,
    error,
    userPaths,
    selectedFiles,
    sortBy,
    sortOrder,
    history,
    historyIndex,
    navigateTo,
    refresh,
    goUp,
    goBack,
    goForward,
    toggleSelect,
    selectAll,
    clearSelection,
    setSorting,
    createFolder,
    deleteSelected,
    renameFile,
    copyFiles,
    moveFiles,
    searchFiles,
    readFile,
    getFileInfo,
  }
}
