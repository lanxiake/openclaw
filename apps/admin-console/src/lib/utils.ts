import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind CSS 类名
 *
 * @param inputs - 类名列表
 * @returns 合并后的类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化日期时间
 *
 * @param date - 日期字符串或 Date 对象
 * @returns 格式化后的日期时间字符串
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * 格式化日期
 *
 * @param date - 日期字符串或 Date 对象
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * 格式化金额
 *
 * @param amount - 金额（分）
 * @param compact - 是否使用紧凑格式（如 1.2万）
 * @returns 格式化后的金额字符串
 */
export function formatCurrency(amount: number, compact = false): string {
  const yuan = amount / 100
  if (compact && yuan >= 10000) {
    return `¥${(yuan / 10000).toFixed(1)}万`
  }
  return `¥${yuan.toFixed(2)}`
}

/**
 * 格式化数字（带千分位）
 *
 * @param num - 数字
 * @returns 格式化后的数字字符串
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN')
}

/**
 * 格式化百分比
 *
 * @param value - 数值
 * @param decimals - 小数位数
 * @returns 格式化后的百分比字符串
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * 截断文本
 *
 * @param text - 原始文本
 * @param maxLength - 最大长度
 * @returns 截断后的文本
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * 生成随机 ID
 *
 * @returns 随机 ID 字符串
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

/**
 * 延迟执行
 *
 * @param ms - 延迟毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 防抖函数
 *
 * @param fn - 要防抖的函数
 * @param delay - 延迟毫秒数
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/**
 * 解析 JSON 安全版本
 *
 * @param json - JSON 字符串
 * @param fallback - 解析失败时的默认值
 * @returns 解析后的对象或默认值
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

/**
 * 格式化相对时间
 *
 * @param date - 日期字符串或 Date 对象
 * @returns 相对时间字符串（如 "刚刚"、"5分钟前"、"2小时前"）
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return '刚刚'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`
  } else if (diffHours < 24) {
    return `${diffHours}小时前`
  } else if (diffDays < 7) {
    return `${diffDays}天前`
  } else {
    return formatDate(d)
  }
}

/**
 * 格式化字节大小
 *
 * @param bytes - 字节数
 * @param decimals - 小数位数
 * @returns 格式化后的字符串（如 "1.5 GB"）
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * 格式化持续时间
 *
 * @param seconds - 秒数
 * @returns 格式化后的字符串（如 "2天 3小时 15分钟"）
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`
  }

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)

  return parts.join(' ') || '0秒'
}
