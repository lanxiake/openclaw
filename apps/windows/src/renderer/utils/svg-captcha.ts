/**
 * SVG 图形验证码生成器
 *
 * 纯前端实现，不依赖后端接口。
 * 生成带干扰线和噪点的 SVG 验证码图片。
 */

/** 允许的字符集（排除歧义字符: 0, O, l, I, 1） */
export const CAPTCHA_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

/** 验证码生成选项 */
export interface CaptchaOptions {
  /** 验证码字符长度，默认 4 */
  length?: number
  /** SVG 宽度，默认 150 */
  width?: number
  /** SVG 高度，默认 50 */
  height?: number
  /** 干扰线数量，默认 5 */
  noiseLines?: number
  /** 噪点数量，默认 30 */
  noiseDots?: number
}

/** 验证码生成结果 */
export interface CaptchaResult {
  /** SVG 标记字符串 */
  svg: string
  /** 验证码文本（用于验证） */
  text: string
}

/**
 * 生成指定范围内的随机整数
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 从字符集中随机选择一个字符
 */
function randomChar(): string {
  return CAPTCHA_CHARSET[randomInt(0, CAPTCHA_CHARSET.length - 1)]
}

/**
 * 生成随机颜色（偏暗色调，确保可读）
 */
function randomColor(): string {
  const r = randomInt(30, 150)
  const g = randomInt(30, 150)
  const b = randomInt(30, 150)
  return `rgb(${r},${g},${b})`
}

/**
 * 生成浅色随机颜色（用于干扰线）
 */
function randomLightColor(): string {
  const r = randomInt(100, 200)
  const g = randomInt(100, 200)
  const b = randomInt(100, 200)
  return `rgb(${r},${g},${b})`
}

/**
 * 生成 SVG 图形验证码
 *
 * @param options - 验证码选项
 * @returns 包含 SVG 标记和文本的对象
 */
export function generateSvgCaptcha(options: CaptchaOptions = {}): CaptchaResult {
  const {
    length = 4,
    width = 150,
    height = 50,
    noiseLines = 5,
    noiseDots = 30,
  } = options

  // 生成随机文本
  let text = ''
  for (let i = 0; i < length; i++) {
    text += randomChar()
  }

  const elements: string[] = []

  // 背景
  elements.push(`<rect width="${width}" height="${height}" fill="#f0f0f0"/>`)

  // 干扰线
  for (let i = 0; i < noiseLines; i++) {
    const x1 = randomInt(0, width)
    const y1 = randomInt(0, height)
    const x2 = randomInt(0, width)
    const y2 = randomInt(0, height)
    const color = randomLightColor()
    elements.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${randomInt(1, 2)}"/>`
    )
  }

  // 噪点
  for (let i = 0; i < noiseDots; i++) {
    const cx = randomInt(0, width)
    const cy = randomInt(0, height)
    const r = randomInt(1, 2)
    const color = randomLightColor()
    elements.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`)
  }

  // 文字字符
  const charWidth = width / (length + 1)
  for (let i = 0; i < length; i++) {
    const x = charWidth * (i + 0.5) + randomInt(-5, 5)
    const y = height / 2 + randomInt(-5, 8)
    const rotation = randomInt(-20, 20)
    const fontSize = randomInt(22, 30)
    const color = randomColor()
    elements.push(
      `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="bold" fill="${color}" transform="rotate(${rotation},${x},${y})">${text[i]}</text>`
    )
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements.join('')}</svg>`

  return { svg, text }
}
