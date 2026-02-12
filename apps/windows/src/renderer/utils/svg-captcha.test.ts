/**
 * SVG 图形验证码生成器 - 单元测试
 */

import { describe, it, expect } from 'vitest'
import { generateSvgCaptcha, CAPTCHA_CHARSET } from './svg-captcha'

describe('generateSvgCaptcha', () => {
  it('应返回包含 svg 和 text 的对象', () => {
    const result = generateSvgCaptcha()
    expect(result).toHaveProperty('svg')
    expect(result).toHaveProperty('text')
  })

  it('生成的 SVG 应包含有效的 SVG 标签', () => {
    const { svg } = generateSvgCaptcha()
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('验证码文本应为 4 个字符', () => {
    const { text } = generateSvgCaptcha()
    expect(text).toHaveLength(4)
  })

  it('验证码文本应只包含允许的字符集', () => {
    // 多次生成以覆盖随机性
    for (let i = 0; i < 20; i++) {
      const { text } = generateSvgCaptcha()
      for (const char of text) {
        expect(CAPTCHA_CHARSET).toContain(char)
      }
    }
  })

  it('不应包含歧义字符 (0, O, l, I, 1)', () => {
    const ambiguous = ['0', 'O', 'l', 'I', '1']
    for (let i = 0; i < 20; i++) {
      const { text } = generateSvgCaptcha()
      for (const char of text) {
        expect(ambiguous).not.toContain(char)
      }
    }
  })

  it('连续两次生成应产生不同的文本（高概率）', () => {
    const results = new Set<string>()
    for (let i = 0; i < 10; i++) {
      results.add(generateSvgCaptcha().text)
    }
    // 10 次至少有 2 个不同的值
    expect(results.size).toBeGreaterThan(1)
  })

  it('可自定义验证码长度', () => {
    const { text } = generateSvgCaptcha({ length: 6 })
    expect(text).toHaveLength(6)
  })

  it('SVG 应包含干扰线元素', () => {
    const { svg } = generateSvgCaptcha()
    expect(svg).toContain('<line')
  })
})
