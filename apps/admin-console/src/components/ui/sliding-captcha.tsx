/**
 * 滑动验证码组件
 *
 * 显示背景图（含缺口）+ 可拖拽滑块
 * 拖动完成后回调 onVerify(sliderX)
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { RefreshCw, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SlidingCaptchaProps {
  /** 背景图 base64 (含缺口) */
  backgroundImage: string | null
  /** 滑块图 base64 */
  sliderImage: string | null
  /** 滑块 Y 坐标 */
  sliderY: number
  /** 是否已验证 */
  isVerified: boolean
  /** 是否加载中 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 拖动完成回调 */
  onVerify: (sliderX: number) => void
  /** 刷新回调 */
  onRefresh: () => void
}

/** 背景图宽高 (与后端一致) */
const BG_WIDTH = 280
const BG_HEIGHT = 100
const SLIDER_SIZE = 40
const TRACK_HEIGHT = 32

export function SlidingCaptcha({
  backgroundImage,
  sliderImage,
  sliderY,
  isVerified,
  isLoading,
  error,
  onVerify,
  onRefresh,
}: SlidingCaptchaProps) {
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  // 重置拖拽位置
  useEffect(() => {
    if (!isDragging && !isVerified) {
      setDragX(0)
    }
  }, [backgroundImage, isDragging, isVerified])

  const getSliderXFromEvent = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 0
      const rect = trackRef.current.getBoundingClientRect()
      const x = clientX - rect.left - SLIDER_SIZE / 2
      return Math.max(0, Math.min(x, BG_WIDTH - SLIDER_SIZE))
    },
    [],
  )

  const handleDragStart = useCallback(
    (clientX: number) => {
      if (isVerified || isLoading) return
      setIsDragging(true)
      setDragX(getSliderXFromEvent(clientX))
    },
    [isVerified, isLoading, getSliderXFromEvent],
  )

  const handleDragMove = useCallback(
    (clientX: number) => {
      if (!isDragging) return
      setDragX(getSliderXFromEvent(clientX))
    },
    [isDragging, getSliderXFromEvent],
  )

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragX > 10) {
      onVerify(dragX)
    }
  }, [isDragging, dragX, onVerify])

  // Mouse events
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      handleDragStart(e.clientX)
    },
    [handleDragStart],
  )

  // 全局 mouse/touch events
  useEffect(() => {
    if (!isDragging) return

    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX)
    const onMouseUp = () => handleDragEnd()
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleDragMove(e.touches[0].clientX)
    }
    const onTouchEnd = () => handleDragEnd()

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('touchmove', onTouchMove)
    document.addEventListener('touchend', onTouchEnd)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  if (!backgroundImage || !sliderImage) {
    return (
      <div
        className="flex items-center justify-center bg-muted/50 rounded-md border"
        style={{ width: BG_WIDTH, height: BG_HEIGHT + TRACK_HEIGHT + 8 }}
      >
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-sm text-muted-foreground">加载验证码...</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1" style={{ width: BG_WIDTH }}>
      {/* 背景图 + 滑块 */}
      <div className="relative rounded-md overflow-hidden border" style={{ width: BG_WIDTH, height: BG_HEIGHT }}>
        <img
          src={backgroundImage}
          alt="captcha background"
          draggable={false}
          style={{ width: BG_WIDTH, height: BG_HEIGHT }}
          className="select-none"
        />
        {/* 滑块拼图 */}
        {!isVerified && (
          <img
            src={sliderImage}
            alt="captcha slider"
            draggable={false}
            className="absolute select-none drop-shadow-lg"
            style={{
              width: SLIDER_SIZE,
              height: SLIDER_SIZE,
              left: dragX,
              top: sliderY,
            }}
          />
        )}
        {/* 刷新按钮 */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="absolute top-1 right-1 p-1 rounded bg-black/30 hover:bg-black/50 text-white transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* 滑动轨道 */}
      <div
        ref={trackRef}
        className={cn(
          'relative rounded-md border select-none',
          isVerified ? 'bg-green-50 border-green-300' : 'bg-muted/50',
        )}
        style={{ width: BG_WIDTH, height: TRACK_HEIGHT }}
        onMouseDown={onMouseDown}
        onTouchStart={(e) => {
          if (e.touches[0]) handleDragStart(e.touches[0].clientX)
        }}
      >
        {isVerified ? (
          <div className="flex items-center justify-center h-full text-green-600 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            验证成功
          </div>
        ) : (
          <>
            {/* 填充轨迹 */}
            <div
              className="absolute inset-y-0 left-0 bg-primary/10 rounded-l-md transition-none"
              style={{ width: dragX + SLIDER_SIZE / 2 }}
            />
            {/* 提示文字 */}
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
              {isDragging ? '' : '向右拖动滑块完成验证'}
            </div>
            {/* 滑块按钮 */}
            <div
              className={cn(
                'absolute top-0 h-full flex items-center justify-center rounded-md border-2 bg-white cursor-grab shadow-sm transition-none',
                isDragging ? 'cursor-grabbing border-primary' : 'border-muted-foreground/30 hover:border-primary',
              )}
              style={{ left: dragX, width: SLIDER_SIZE }}
            >
              <div className="flex gap-0.5">
                <div className="w-0.5 h-3 bg-muted-foreground/40 rounded" />
                <div className="w-0.5 h-3 bg-muted-foreground/40 rounded" />
                <div className="w-0.5 h-3 bg-muted-foreground/40 rounded" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
