/**
 * useCaptcha hook — 图形验证码管理
 *
 * 封装 SVG 验证码的生成、校验和刷新逻辑。
 * 提供 svgHtml（用于渲染）、validate（用于校验用户输入）、refresh（手动刷新）。
 */
import { useState, useCallback, useRef } from 'react'
import { generateSvgCaptcha } from '../utils/svg-captcha'

/** useCaptcha 返回值 */
export interface UseCaptchaReturn {
  /** 当前验证码的 SVG HTML 字符串 */
  svgHtml: string
  /** 校验用户输入是否匹配当前验证码（大小写不敏感）。验证成功后自动刷新。 */
  validate: (input: string) => boolean
  /** 手动刷新验证码 */
  refresh: () => void
}

/**
 * 图形验证码 hook
 *
 * @returns 包含 svgHtml、validate、refresh 的对象
 */
export function useCaptcha(): UseCaptchaReturn {
  /** 生成初始验证码 */
  const initial = generateSvgCaptcha()
  const [svgHtml, setSvgHtml] = useState<string>(initial.svg)
  const textRef = useRef<string>(initial.text)

  /**
   * 刷新验证码：重新生成 SVG 和文本
   */
  const refresh = useCallback(() => {
    console.log('[useCaptcha] 刷新验证码')
    const captcha = generateSvgCaptcha()
    textRef.current = captcha.text
    setSvgHtml(captcha.svg)
  }, [])

  /**
   * 校验用户输入是否匹配当前验证码
   * 大小写不敏感比较。验证成功后自动刷新。
   */
  const validate = useCallback(
    (input: string): boolean => {
      if (!input) {
        console.log('[useCaptcha] 校验失败：输入为空')
        return false
      }

      const isValid = input.toLowerCase() === textRef.current.toLowerCase()
      console.log('[useCaptcha] 校验结果:', isValid, '输入:', input)

      if (isValid) {
        refresh()
      }

      return isValid
    },
    [refresh]
  )

  return { svgHtml, validate, refresh }
}
