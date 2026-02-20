/**
 * useFileUpload Hook - 文件上传
 *
 * 处理技能文件（package/icon/manifest）的上传
 */

import { useState, useCallback } from 'react'

/**
 * 文件上传参数
 */
export interface FileUploadParams {
  /** 技能 ID */
  skillId: string
  /** 文件类型 */
  fileType: 'package' | 'icon' | 'manifest'
  /** 文件对象 */
  file: File
}

/**
 * 文件上传结果
 */
export interface FileUploadResult {
  /** 是否成功 */
  success: boolean
  /** 文件 URL */
  url?: string
  /** 文件大小 */
  size?: number
  /** 错误信息 */
  error?: string
}

/**
 * Hook 返回值
 */
interface UseFileUploadReturn {
  /** 是否正在上传 */
  isUploading: boolean
  /** 上传进度（0-100） */
  progress: number
  /** 错误信息 */
  error: string | null
  /** 上传文件 */
  uploadFile: (params: FileUploadParams) => Promise<FileUploadResult>
  /** 重置状态 */
  reset: () => void
}

/**
 * 将文件转换为 Base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // 移除 data:xxx;base64, 前缀
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 文件上传 Hook
 */
export function useFileUpload(): UseFileUploadReturn {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  /**
   * 上传文件
   */
  const uploadFile = useCallback(async (params: FileUploadParams): Promise<FileUploadResult> => {
    const { skillId, fileType, file } = params

    console.log('[useFileUpload] 开始上传文件', {
      skillId,
      fileType,
      fileName: file.name,
      fileSize: file.size,
      fileMimeType: file.type
    })

    setIsUploading(true)
    setProgress(0)
    setError(null)

    try {
      // 验证文件大小（最大 50MB）
      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        throw new Error(`文件大小超过限制（最大 50MB）`)
      }

      // 验证文件类型
      if (fileType === 'icon') {
        if (!file.type.startsWith('image/')) {
          throw new Error('图标必须是图片文件')
        }
      } else if (fileType === 'package') {
        if (!file.name.endsWith('.zip') && !file.name.endsWith('.tar.gz')) {
          throw new Error('技能包必须是 .zip 或 .tar.gz 文件')
        }
      } else if (fileType === 'manifest') {
        if (!file.name.endsWith('.json')) {
          throw new Error('配置文件必须是 .json 文件')
        }
      }

      setProgress(20)

      // 转换为 Base64
      console.log('[useFileUpload] 转换文件为 Base64')
      const dataBase64 = await fileToBase64(file)

      setProgress(40)

      // 调用 RPC 方法上传
      console.log('[useFileUpload] 调用 RPC 上传文件')
      const result = await window.electronAPI.gateway.call<{
        bucket: string
        key: string
        url: string
        size: number
        etag: string
      }>('user.skills.uploadFile', {
        skillId,
        fileType,
        originalName: file.name,
        contentType: file.type,
        data: dataBase64
      })

      setProgress(100)

      console.log('[useFileUpload] 文件上传成功', {
        url: result.url,
        size: result.size
      })

      return {
        success: true,
        url: result.url,
        size: result.size
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '上传失败'
      console.error('[useFileUpload] 上传失败:', errorMessage)
      setError(errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    } finally {
      setIsUploading(false)
    }
  }, [])

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setIsUploading(false)
    setProgress(0)
    setError(null)
  }, [])

  return {
    isUploading,
    progress,
    error,
    uploadFile,
    reset
  }
}
