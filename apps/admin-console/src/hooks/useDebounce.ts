/**
 * 防抖 Hook
 *
 * 用于对输入值进行防抖处理，减少频繁的 API 调用
 */

import { useState, useEffect } from 'react'

/**
 * 防抖 Hook
 *
 * @param value - 需要防抖的值
 * @param delay - 防抖延迟（毫秒）
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // 设置定时器，在延迟后更新防抖值
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // 清理函数：如果在延迟期间值发生变化，取消之前的定时器
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
