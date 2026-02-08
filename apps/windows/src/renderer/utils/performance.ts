/**
 * React 性能优化工具
 *
 * 提供 React 组件性能优化相关的工具和 Hook
 */

import React, { useRef, useCallback, useMemo, useEffect, useState } from 'react'

// ============================================================================
// useMemoizedCallback - 稳定的回调引用
// ============================================================================

/**
 * 创建一个稳定的回调函数引用
 * 与 useCallback 不同，这个 hook 始终返回相同的函数引用，但内部调用最新的回调
 *
 * @param callback 回调函数
 * @returns 稳定的回调引用
 */
export function useMemoizedCallback<T extends (...args: unknown[]) => unknown>(callback: T): T {
  const callbackRef = useRef<T>(callback)

  // 始终更新 ref 到最新的 callback
  useEffect(() => {
    callbackRef.current = callback
  })

  // 返回一个稳定的函数引用
  return useCallback(
    ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
    []
  )
}

// ============================================================================
// useDebounce - 防抖 Hook
// ============================================================================

/**
 * 防抖 Hook
 *
 * @param value 要防抖的值
 * @param delay 延迟时间 (毫秒)
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * 防抖回调 Hook
 *
 * @param callback 回调函数
 * @param delay 延迟时间 (毫秒)
 * @returns 防抖后的回调
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    }) as T,
    [delay]
  )
}

// ============================================================================
// useThrottle - 节流 Hook
// ============================================================================

/**
 * 节流 Hook
 *
 * @param value 要节流的值
 * @param limit 时间限制 (毫秒)
 * @returns 节流后的值
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState(value)
  const lastRun = useRef(Date.now())

  useEffect(() => {
    const now = Date.now()
    if (now - lastRun.current >= limit) {
      setThrottledValue(value)
      lastRun.current = now
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value)
        lastRun.current = Date.now()
      }, limit - (now - lastRun.current))

      return () => clearTimeout(timer)
    }
  }, [value, limit])

  return throttledValue
}

// ============================================================================
// usePrevious - 获取上一个值
// ============================================================================

/**
 * 获取上一次渲染的值
 *
 * @param value 当前值
 * @returns 上一次渲染的值
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>()

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}

// ============================================================================
// useDeepMemo - 深度比较的 memo
// ============================================================================

/**
 * 深度比较两个值是否相等
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true

  if (typeof a !== typeof b) return false

  if (typeof a !== 'object' || a === null || b === null) {
    return a === b
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }

  const keysA = Object.keys(a as object)
  const keysB = Object.keys(b as object)

  if (keysA.length !== keysB.length) return false

  return keysA.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  )
}

/**
 * 深度比较的 useMemo
 *
 * @param factory 创建值的函数
 * @param deps 依赖数组
 * @returns memoized 值
 */
export function useDeepMemo<T>(factory: () => T, deps: unknown[]): T {
  const ref = useRef<{ deps: unknown[]; value: T }>()

  if (!ref.current || !deepEqual(ref.current.deps, deps)) {
    ref.current = { deps, value: factory() }
  }

  return ref.current.value
}

// ============================================================================
// useRenderCount - 渲染计数 (开发调试用)
// ============================================================================

/**
 * 统计组件渲染次数 (仅开发环境)
 *
 * @param componentName 组件名称
 */
export function useRenderCount(componentName: string): void {
  const renderCount = useRef(0)
  renderCount.current++

  if (process.env.NODE_ENV === 'development') {
    console.log(`[RenderCount] ${componentName}: ${renderCount.current}`)
  }
}

// ============================================================================
// useLazyLoad - 懒加载 Hook
// ============================================================================

interface LazyLoadState<T> {
  loading: boolean
  error: Error | null
  data: T | null
}

/**
 * 懒加载 Hook
 *
 * @param loader 加载函数
 * @param deps 依赖数组
 * @returns 加载状态
 */
export function useLazyLoad<T>(
  loader: () => Promise<T>,
  deps: unknown[] = []
): LazyLoadState<T> & { reload: () => void } {
  const [state, setState] = useState<LazyLoadState<T>>({
    loading: true,
    error: null,
    data: null,
  })

  const load = useCallback(async () => {
    setState({ loading: true, error: null, data: null })
    try {
      const data = await loader()
      setState({ loading: false, error: null, data })
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
        data: null,
      })
    }
  }, deps)

  useEffect(() => {
    load()
  }, [load])

  return { ...state, reload: load }
}

// ============================================================================
// useIntersectionObserver - 交叉观察器 Hook
// ============================================================================

interface IntersectionObserverOptions {
  root?: Element | null
  rootMargin?: string
  threshold?: number | number[]
}

/**
 * 交叉观察器 Hook - 用于懒加载、无限滚动等
 *
 * @param callback 交叉时的回调
 * @param options 观察器选项
 * @returns ref 用于绑定到目标元素
 */
export function useIntersectionObserver<T extends Element>(
  callback: (entry: IntersectionObserverEntry) => void,
  options: IntersectionObserverOptions = {}
): React.RefObject<T> {
  const targetRef = useRef<T>(null)
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          callbackRef.current(entry)
        })
      },
      {
        root: options.root,
        rootMargin: options.rootMargin || '0px',
        threshold: options.threshold || 0,
      }
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [options.root, options.rootMargin, options.threshold])

  return targetRef
}

// ============================================================================
// withMemo - 高阶组件包装器
// ============================================================================

/**
 * 创建一个带深度比较的 memo 组件
 *
 * @param Component 要包装的组件
 * @param propsAreEqual 自定义比较函数
 * @returns memoized 组件
 */
export function withDeepMemo<P extends object>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prevProps: P, nextProps: P) => boolean
): React.MemoExoticComponent<React.ComponentType<P>> {
  return React.memo(Component, propsAreEqual || ((prev, next) => deepEqual(prev, next)))
}

// ============================================================================
// VirtualList - 虚拟列表组件
// ============================================================================

interface VirtualListProps<T> {
  /** 数据列表 */
  items: T[]
  /** 每项高度 (像素) */
  itemHeight: number
  /** 容器高度 (像素) */
  containerHeight: number
  /** 渲染项的函数 */
  renderItem: (item: T, index: number) => React.ReactNode
  /** 额外渲染的项数 (上下各多渲染几项) */
  overscan?: number
  /** 容器类名 */
  className?: string
}

/**
 * 虚拟列表组件 - 只渲染可视区域的项
 */
export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = '',
}: VirtualListProps<T>): React.ReactElement {
  const [scrollTop, setScrollTop] = useState(0)

  const totalHeight = items.length * itemHeight
  const visibleCount = Math.ceil(containerHeight / itemHeight)

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2)

  const visibleItems = items.slice(startIndex, endIndex)
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return React.createElement(
    'div',
    {
      className: `virtual-list ${className}`,
      style: { height: containerHeight, overflow: 'auto' },
      onScroll: handleScroll,
    },
    React.createElement(
      'div',
      {
        style: { height: totalHeight, position: 'relative' },
      },
      React.createElement(
        'div',
        {
          style: { position: 'absolute', top: offsetY, left: 0, right: 0 },
        },
        visibleItems.map((item, index) =>
          React.createElement(
            'div',
            {
              key: startIndex + index,
              style: { height: itemHeight },
            },
            renderItem(item, startIndex + index)
          )
        )
      )
    )
  )
}

// ============================================================================
// 导出
// ============================================================================

export { deepEqual }
