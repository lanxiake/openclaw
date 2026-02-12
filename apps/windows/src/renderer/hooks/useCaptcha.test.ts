// @vitest-environment jsdom

/**
 * useCaptcha hook 单元测试
 *
 * 测试图形验证码 hook 的核心行为：
 * - 初始化时生成验证码
 * - validate() 正确校验输入
 * - refresh() 刷新验证码
 * - 大小写不敏感匹配
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { generateSvgCaptcha } from '../utils/svg-captcha'
import { useCaptcha } from './useCaptcha'

// Mock svg-captcha 以获得可预测的测试结果
vi.mock('../utils/svg-captcha', () => ({
  generateSvgCaptcha: vi.fn(),
}))

const mockedGenerate = vi.mocked(generateSvgCaptcha)

describe('useCaptcha', () => {
  beforeEach(() => {
    let count = 0
    mockedGenerate.mockImplementation(() => {
      count++
      return {
        svg: `<svg>mock-${count}</svg>`,
        text: count === 1 ? 'AbCd' : 'XyZw',
      }
    })
  })

  it('初始化时应生成验证码 SVG', () => {
    const { result } = renderHook(() => useCaptcha())

    expect(result.current.svgHtml).toBe('<svg>mock-1</svg>')
  })

  it('validate() 输入正确时应返回 true', () => {
    const { result } = renderHook(() => useCaptcha())

    expect(result.current.validate('AbCd')).toBe(true)
  })

  it('validate() 输入错误时应返回 false', () => {
    const { result } = renderHook(() => useCaptcha())

    expect(result.current.validate('wrong')).toBe(false)
  })

  it('validate() 应支持大小写不敏感匹配', () => {
    const { result } = renderHook(() => useCaptcha())

    expect(result.current.validate('abcd')).toBe(true)
  })

  it('validate() 空输入应返回 false', () => {
    const { result } = renderHook(() => useCaptcha())

    expect(result.current.validate('')).toBe(false)
  })

  it('refresh() 应生成新的验证码', () => {
    const { result } = renderHook(() => useCaptcha())

    expect(result.current.svgHtml).toBe('<svg>mock-1</svg>')

    act(() => {
      result.current.refresh()
    })

    expect(result.current.svgHtml).toBe('<svg>mock-2</svg>')
  })

  it('refresh() 后旧验证码文本应失效', () => {
    const { result } = renderHook(() => useCaptcha())

    // 初始验证码是 AbCd — validate 成功会自动刷新
    // 此时 count 变为 2，text 变为 XyZw
    act(() => {
      const valid = result.current.validate('AbCd')
      expect(valid).toBe(true)
    })

    // 自动刷新后新验证码是 XyZw，旧的 AbCd 应失效
    expect(result.current.validate('AbCd')).toBe(false)
    expect(result.current.validate('XyZw')).toBe(true)
  })

  it('validate() 成功后应自动刷新验证码', () => {
    const { result } = renderHook(() => useCaptcha())

    // 验证成功
    act(() => {
      result.current.validate('AbCd')
    })

    // 验证成功后自动刷新，SVG 应更新
    expect(result.current.svgHtml).toBe('<svg>mock-2</svg>')
  })
})
