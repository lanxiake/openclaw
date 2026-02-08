import { clsx, type ClassValue } from 'clsx'
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
 * 格式化日期
 *
 * @param date - 日期
 * @param options - 格式化选项
 * @returns 格式化后的日期字符串
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('zh-CN', options)
}

/**
 * 格式化相对时间
 *
 * @param date - 日期
 * @returns 相对时间字符串
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 7) {
    return formatDate(d, { month: '2-digit', day: '2-digit' })
  }
  if (days > 0) {
    return `${days} 天前`
  }
  if (hours > 0) {
    return `${hours} 小时前`
  }
  if (minutes > 0) {
    return `${minutes} 分钟前`
  }
  return '刚刚'
}

/**
 * 格式化文件大小
 *
 * @param bytes - 字节数
 * @returns 格式化后的文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`
}

/**
 * 格式化金额
 *
 * @param amount - 金额（分）
 * @returns 格式化后的金额字符串
 */
export function formatAmount(amount: number): string {
  return `¥${(amount / 100).toFixed(2)}`
}

/**
 * 脱敏手机号
 *
 * @param phone - 手机号
 * @returns 脱敏后的手机号
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

/**
 * 脱敏邮箱
 *
 * @param email - 邮箱
 * @returns 脱敏后的邮箱
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const [name, domain] = email.split('@')
  if (name.length <= 2) return email
  return `${name[0]}***${name[name.length - 1]}@${domain}`
}

/**
 * 生成随机 ID
 *
 * @returns 随机 ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

/**
 * 延迟
 *
 * @param ms - 毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 复制到剪贴板
 *
 * @param text - 要复制的文本
 * @returns 是否成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
