/**
 * 生成临时占位图标
 *
 * 用于开发阶段测试安装包构建
 * 生产环境应使用设计的正式图标
 */

import * as fs from 'fs'
import * as path from 'path'

/**
 * 生成一个简单的 16x16 ICO 文件（最小的有效 ICO）
 *
 * ICO 文件格式:
 * - Header (6 bytes): reserved(2) + type(2) + count(2)
 * - Entry (16 bytes each): width, height, colors, reserved, planes(2), bpp(2), size(4), offset(4)
 * - Image data: BMP without file header
 */
function generateMinimalIco(): Buffer {
  const width = 16
  const height = 16
  const bpp = 32 // 32-bit RGBA

  // 计算图像数据大小
  const rowSize = width * 4 // 每行字节数 (BGRA)
  const imageSize = rowSize * height
  const maskSize = Math.ceil(width / 8) * height // AND mask

  // BMP Info Header (40 bytes for BITMAPINFOHEADER)
  const headerSize = 40
  const totalImageSize = headerSize + imageSize + maskSize

  // 创建缓冲区
  const buffer = Buffer.alloc(6 + 16 + totalImageSize)
  let offset = 0

  // ICO Header (6 bytes)
  buffer.writeUInt16LE(0, offset) // Reserved
  offset += 2
  buffer.writeUInt16LE(1, offset) // Type: 1 = ICO
  offset += 2
  buffer.writeUInt16LE(1, offset) // Image count
  offset += 2

  // ICO Entry (16 bytes)
  buffer.writeUInt8(width, offset++) // Width
  buffer.writeUInt8(height, offset++) // Height
  buffer.writeUInt8(0, offset++) // Color count (0 = 256+)
  buffer.writeUInt8(0, offset++) // Reserved
  buffer.writeUInt16LE(1, offset) // Planes
  offset += 2
  buffer.writeUInt16LE(bpp, offset) // Bits per pixel
  offset += 2
  buffer.writeUInt32LE(totalImageSize, offset) // Image size
  offset += 4
  buffer.writeUInt32LE(22, offset) // Offset to image data (6 + 16)
  offset += 4

  // BMP Info Header (40 bytes)
  buffer.writeUInt32LE(40, offset) // Header size
  offset += 4
  buffer.writeInt32LE(width, offset) // Width
  offset += 4
  buffer.writeInt32LE(height * 2, offset) // Height (doubled for AND mask)
  offset += 4
  buffer.writeUInt16LE(1, offset) // Planes
  offset += 2
  buffer.writeUInt16LE(bpp, offset) // Bits per pixel
  offset += 2
  buffer.writeUInt32LE(0, offset) // Compression (none)
  offset += 4
  buffer.writeUInt32LE(imageSize, offset) // Image size
  offset += 4
  buffer.writeInt32LE(0, offset) // X pixels per meter
  offset += 4
  buffer.writeInt32LE(0, offset) // Y pixels per meter
  offset += 4
  buffer.writeUInt32LE(0, offset) // Colors used
  offset += 4
  buffer.writeUInt32LE(0, offset) // Important colors
  offset += 4

  // 图像数据 (BGRA, bottom-up)
  // 使用 Indigo 色 (#6366F1) 作为主色
  const primaryColor = { b: 0xf1, g: 0x66, r: 0x63, a: 0xff }
  const bgColor = { b: 0x2e, g: 0x1a, r: 0x1a, a: 0xff }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 简单的 "OC" 图案
      let color = bgColor

      // 绘制简单的圆形背景
      const cx = width / 2
      const cy = height / 2
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 6) {
        color = primaryColor
      }

      // BGRA 顺序
      buffer.writeUInt8(color.b, offset++)
      buffer.writeUInt8(color.g, offset++)
      buffer.writeUInt8(color.r, offset++)
      buffer.writeUInt8(color.a, offset++)
    }
  }

  // AND mask (全透明)
  for (let i = 0; i < maskSize; i++) {
    buffer.writeUInt8(0, offset++)
  }

  return buffer
}

/**
 * 生成多尺寸 ICO 文件
 */
function generateMultiSizeIco(): Buffer {
  const sizes = [16, 32, 48, 256]
  const bpp = 32

  // 计算每个尺寸的数据
  const images: Buffer[] = []
  let totalImagesSize = 0

  for (const size of sizes) {
    const rowSize = size * 4
    const imageSize = rowSize * size
    const maskSize = Math.ceil(size / 8) * size
    const headerSize = 40
    const total = headerSize + imageSize + maskSize

    const imgBuffer = Buffer.alloc(total)
    let offset = 0

    // BMP Info Header
    imgBuffer.writeUInt32LE(40, offset)
    offset += 4
    imgBuffer.writeInt32LE(size, offset)
    offset += 4
    imgBuffer.writeInt32LE(size * 2, offset)
    offset += 4
    imgBuffer.writeUInt16LE(1, offset)
    offset += 2
    imgBuffer.writeUInt16LE(bpp, offset)
    offset += 2
    imgBuffer.writeUInt32LE(0, offset)
    offset += 4
    imgBuffer.writeUInt32LE(imageSize, offset)
    offset += 4
    imgBuffer.writeInt32LE(0, offset)
    offset += 4
    imgBuffer.writeInt32LE(0, offset)
    offset += 4
    imgBuffer.writeUInt32LE(0, offset)
    offset += 4
    imgBuffer.writeUInt32LE(0, offset)
    offset += 4

    // 图像数据
    const primaryColor = { b: 0xf1, g: 0x66, r: 0x63, a: 0xff }
    const bgColor = { b: 0x2e, g: 0x1a, r: 0x1a, a: 0xff }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let color = bgColor

        const cx = size / 2
        const cy = size / 2
        const dx = x - cx
        const dy = y - cy
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < size * 0.4) {
          color = primaryColor
        }

        imgBuffer.writeUInt8(color.b, offset++)
        imgBuffer.writeUInt8(color.g, offset++)
        imgBuffer.writeUInt8(color.r, offset++)
        imgBuffer.writeUInt8(color.a, offset++)
      }
    }

    // AND mask
    for (let i = 0; i < maskSize; i++) {
      imgBuffer.writeUInt8(0, offset++)
    }

    images.push(imgBuffer)
    totalImagesSize += total
  }

  // 创建最终 ICO
  const headerSize = 6 + sizes.length * 16
  const buffer = Buffer.alloc(headerSize + totalImagesSize)
  let offset = 0

  // ICO Header
  buffer.writeUInt16LE(0, offset)
  offset += 2
  buffer.writeUInt16LE(1, offset)
  offset += 2
  buffer.writeUInt16LE(sizes.length, offset)
  offset += 2

  // ICO Entries
  let imageOffset = headerSize
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]
    const imgSize = images[i].length

    buffer.writeUInt8(size === 256 ? 0 : size, offset++) // Width (0 = 256)
    buffer.writeUInt8(size === 256 ? 0 : size, offset++) // Height
    buffer.writeUInt8(0, offset++) // Colors
    buffer.writeUInt8(0, offset++) // Reserved
    buffer.writeUInt16LE(1, offset) // Planes
    offset += 2
    buffer.writeUInt16LE(bpp, offset) // BPP
    offset += 2
    buffer.writeUInt32LE(imgSize, offset) // Size
    offset += 4
    buffer.writeUInt32LE(imageOffset, offset) // Offset
    offset += 4

    imageOffset += imgSize
  }

  // 写入图像数据
  for (const img of images) {
    img.copy(buffer, offset)
    offset += img.length
  }

  return buffer
}

// 主程序
const assetsDir = path.join(__dirname, '../assets')
const iconPath = path.join(assetsDir, 'icon.ico')

// 确保目录存在
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true })
}

console.log('[generate-icon] 生成临时占位图标...')

try {
  const icoBuffer = generateMultiSizeIco()
  fs.writeFileSync(iconPath, icoBuffer)
  console.log(`[generate-icon] 图标已生成: ${iconPath}`)
  console.log(`[generate-icon] 文件大小: ${icoBuffer.length} bytes`)
  console.log('[generate-icon] 注意: 这是临时占位图标，生产环境请使用设计的正式图标')
} catch (error) {
  console.error('[generate-icon] 生成失败:', error)
  process.exit(1)
}
