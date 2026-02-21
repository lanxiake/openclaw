/**
 * 文件上传管理 Hook
 *
 * 管理技能上传页面的文件选择、校验和 zip 打包逻辑。
 * 支持文件夹选择（webkitdirectory）和拖拽上传。
 * 每次选择文件夹/拖拽会替换已有文件列表（而非追加）。
 */

import { useState, useMemo, useCallback } from 'react'
import JSZip from 'jszip'

/** 最大上传包大小 50MB */
const MAX_PACKAGE_SIZE = 50 * 1024 * 1024

/** Slug 格式：仅允许小写字母、数字、连字符，至少 2 字符 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

/** Semver 格式校验 */
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/

/** 单个文件条目 */
export interface FileEntry {
  /** 原始 File 对象 */
  file: File
  /** 相对于文件夹根目录的路径（已清洗） */
  relativePath: string
  /** 文件大小（字节） */
  size: number
}

/** 校验结果中的单条规则 */
export interface ValidationItem {
  /** 规则标识 */
  key: string
  /** 规则描述 */
  label: string
  /** 是否通过 */
  passed: boolean
}

/** 校验结果 */
export interface ValidationResult {
  /** 所有规则是否全部通过 */
  valid: boolean
  /** 校验规则列表 */
  items: ValidationItem[]
}

/** Hook 返回值 */
export interface UseFileUploadReturn {
  /** 已选文件列表 */
  files: FileEntry[]
  /** 文件总大小（字节） */
  totalSize: number
  /** 文件总数 */
  totalCount: number
  /** 校验结果 */
  validation: ValidationResult
  /** 是否正在打包中 */
  isPackaging: boolean
  /** 添加文件夹中的文件（来自 input[webkitdirectory]），替换已有文件 */
  addFolder: (fileList: FileList) => void
  /** 添加拖拽文件（来自 DataTransfer），替换已有文件 */
  addDroppedItems: (items: DataTransferItemList) => Promise<void>
  /** 移除指定路径的文件 */
  removeFile: (relativePath: string) => void
  /** 清空所有文件 */
  clearFiles: () => void
  /** 将文件打包为 zip Blob */
  createZipBlob: () => Promise<Blob>
}

/**
 * 清洗文件路径，防止路径穿越攻击
 *
 * 移除 ".." 和 "." 段，过滤空段和非法字符
 */
function sanitizePath(path: string): string {
  return path
    .split('/')
    .filter((segment) => segment !== '..' && segment !== '.' && segment.length > 0)
    .join('/')
}

/**
 * 从 webkitRelativePath 中提取去除顶层文件夹后的相对路径
 *
 * 例如 "my-skill/src/index.ts" -> "src/index.ts"
 * 例如 "my-skill/SKILL.md" -> "SKILL.md"
 */
function extractRelativePath(webkitRelativePath: string): string {
  const parts = webkitRelativePath.split('/')
  if (parts.length > 1) {
    return sanitizePath(parts.slice(1).join('/'))
  }
  return sanitizePath(webkitRelativePath)
}

/**
 * 循环读取目录的所有条目
 *
 * FileSystemDirectoryReader.readEntries() 不保证一次返回所有条目，
 * 需要循环调用直到返回空数组。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readAllEntries(reader: any): Promise<FileSystemEntry[]> {
  const allEntries: FileSystemEntry[] = []
  let batch: FileSystemEntry[]
  do {
    batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    allEntries.push(...batch)
  } while (batch.length > 0)
  return allEntries
}

/**
 * 递归遍历 DataTransferItem 获取所有文件
 */
async function traverseFileTree(
  entry: FileSystemEntry,
  basePath: string
): Promise<FileEntry[]> {
  const entries: FileEntry[] = []

  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject)
    })
    const relativePath = sanitizePath(basePath ? `${basePath}/${entry.name}` : entry.name)
    entries.push({ file, relativePath, size: file.size })
  } else if (entry.isDirectory) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dirEntry = entry as any
    const reader = dirEntry.createDirectoryReader()
    const subEntries = await readAllEntries(reader)
    const subPath = basePath ? `${basePath}/${entry.name}` : entry.name
    for (const sub of subEntries) {
      const subFiles = await traverseFileTree(sub, subPath)
      entries.push(...subFiles)
    }
  }

  return entries
}

/**
 * 格式化文件大小为可读字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / Math.pow(k, i)
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

/**
 * 文件上传管理 Hook
 *
 * 提供文件选择、实时校验、zip 打包功能。
 * 校验规则：slug 格式、displayName 必填、至少一个文件、包含 SKILL.md、版本号格式、大小限制。
 */
export function useFileUpload(formState: {
  slug: string
  displayName: string
  version: string
}): UseFileUploadReturn {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [isPackaging, setIsPackaging] = useState(false)

  /** 文件总大小 */
  const totalSize = useMemo(
    () => files.reduce((sum, f) => sum + f.size, 0),
    [files]
  )

  /** 文件总数 */
  const totalCount = files.length

  /** 实时校验结果 */
  const validation = useMemo((): ValidationResult => {
    const slugTrimmed = formState.slug.trim()
    const hasSlug = slugTrimmed.length > 0
    const slugFormatOk = hasSlug && SLUG_PATTERN.test(slugTrimmed)
    const hasDisplayName = formState.displayName.trim().length > 0
    const versionOk = SEMVER_PATTERN.test(formState.version.trim())
    const hasFiles = files.length > 0
    const hasSkillMd = files.some(
      (f) => f.relativePath === 'SKILL.md' || f.relativePath.endsWith('/SKILL.md')
    )
    const sizeOk = totalSize <= MAX_PACKAGE_SIZE

    const items: ValidationItem[] = [
      {
        key: 'slug',
        label: hasSlug && !slugFormatOk
          ? '技能标识仅允许小写字母、数字和连字符，至少 2 字符。'
          : '需要技能标识（Slug）。',
        passed: slugFormatOk,
      },
      { key: 'displayName', label: '需要显示名称。', passed: hasDisplayName },
      {
        key: 'version',
        label: '版本号须为 semver 格式（如 1.0.0）。',
        passed: versionOk,
      },
      { key: 'files', label: '至少添加一个文件。', passed: hasFiles },
      { key: 'skillMd', label: 'SKILL.md 是必须的。', passed: hasSkillMd },
      {
        key: 'size',
        label: `文件总大小不超过 50MB（当前 ${formatFileSize(totalSize)}）。`,
        passed: sizeOk,
      },
    ]

    return {
      valid: items.every((item) => item.passed),
      items,
    }
  }, [formState.slug, formState.displayName, formState.version, files, totalSize])

  /**
   * 从 input[webkitdirectory] 添加文件夹中的文件（替换已有文件列表）
   */
  const addFolder = useCallback((fileList: FileList) => {
    const newFiles: FileEntry[] = []
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const relativePath = file.webkitRelativePath
        ? extractRelativePath(file.webkitRelativePath)
        : sanitizePath(file.name)
      newFiles.push({ file, relativePath, size: file.size })
    }
    setFiles(newFiles)
  }, [])

  /**
   * 处理拖拽的文件/文件夹（替换已有文件列表）
   */
  const addDroppedItems = useCallback(async (items: DataTransferItemList) => {
    const allFiles: FileEntry[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const entry = item.webkitGetAsEntry?.()
      if (entry) {
        if (entry.isDirectory) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dirEntry = entry as any
          const reader = dirEntry.createDirectoryReader()
          const subEntries = await readAllEntries(reader)
          for (const sub of subEntries) {
            const subFiles = await traverseFileTree(sub, '')
            allFiles.push(...subFiles)
          }
        } else {
          const fileEntries = await traverseFileTree(entry, '')
          allFiles.push(...fileEntries)
        }
      }
    }

    setFiles(allFiles)
  }, [])

  /**
   * 移除指定路径的文件
   */
  const removeFile = useCallback((relativePath: string) => {
    setFiles((prev) => prev.filter((f) => f.relativePath !== relativePath))
  }, [])

  /**
   * 清空所有文件
   */
  const clearFiles = useCallback(() => {
    setFiles([])
  }, [])

  /**
   * 将选中的文件打包为 zip Blob，路径已在添加时清洗
   */
  const createZipBlob = useCallback(async (): Promise<Blob> => {
    setIsPackaging(true)
    try {
      const zip = new JSZip()
      for (const entry of files) {
        zip.file(entry.relativePath, entry.file)
      }
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })
      return blob
    } finally {
      setIsPackaging(false)
    }
  }, [files])

  return {
    files,
    totalSize,
    totalCount,
    validation,
    isPackaging,
    addFolder,
    addDroppedItems,
    removeFile,
    clearFiles,
    createZipBlob,
  }
}
