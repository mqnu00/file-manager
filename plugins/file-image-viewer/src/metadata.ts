/**
 * 图片元数据解析（分辨率 / DPI / 位深度）
 *
 * 只读取文件头字节解析二进制结构：
 * - PNG：IHDR（宽高/位深度）+ pHYs chunk（像素密度）
 * - JPEG：SOF 段（精度/宽高）+ JFIF APP0（密度单位与数值）
 * - GIF：逻辑屏幕描述符（宽高/颜色分辨率）
 * - BMP：BITMAPINFOHEADER（宽高/位深度/像素每米）
 * - WebP：VP8X / VP8 / VP8L 容器（宽高；无标准 DPI，位深 8 bit）
 */

export interface ImageMetadata {
  width?: number
  height?: number
  /** DPI（水平方向，未知时省略） */
  dpi?: number
  /** 位深度（bit，语义因格式而异：PNG/JPEG 每通道、BMP/GIF 每像素） */
  bitDepth?: number
}

function be16(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1]
}
function be32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
}
function le16(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8)
}
function le32(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
}
function ascii(b: Uint8Array, o: number, len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(b[o + i])
  return s
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function parsePng(b: Uint8Array): ImageMetadata {
  for (let i = 0; i < 8; i++) if (b[i] !== PNG_SIG[i]) return {}
  if (b.length < 33) return {}
  const meta: ImageMetadata = {
    width: be32(b, 16),
    height: be32(b, 20),
    bitDepth: b[24],
  }
  // 遍历 chunk 找 pHYs（像素密度）
  let o = 8
  while (o + 12 <= b.length) {
    const len = be32(b, o)
    const type = ascii(b, o + 4, 4)
    const dataStart = o + 8
    if (type === 'pHYs' && dataStart + 9 <= b.length && b[dataStart + 8] === 1) {
      // unit=1 表示像素/米，转 DPI：1 inch = 25.4 mm
      meta.dpi = Math.round(be32(b, dataStart) / 39.3701)
      break
    }
    if (type === 'IDAT' || type === 'IEND') break
    o = dataStart + len + 4 // 跳过数据 + CRC
  }
  return meta
}

function parseJpeg(b: Uint8Array): ImageMetadata {
  if (b[0] !== 0xff || b[1] !== 0xd8) return {}
  const meta: ImageMetadata = {}
  let o = 2
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) {
      o++
      continue
    }
    const marker = b[o + 1]
    if (marker === 0xd9 || marker === 0xda) break // EOI / SOS
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      o += 2 // 无长度字段
      continue
    }
    const segLen = be16(b, o + 2)
    if (segLen < 2) break
    const payload = o + 4
    if (marker === 0xe0 && segLen >= 14 && ascii(b, payload, 5) === 'JFIF\0') {
      // APP0 JFIF：标识(5) 版本(2) 单位(1) Xdensity(2) Ydensity(2)
      const units = b[payload + 7]
      if (units === 1) meta.dpi = be16(b, payload + 8)
      else if (units === 2) meta.dpi = Math.round(be16(b, payload + 8) * 2.54)
    } else if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 && // DHT
      marker !== 0xc8 && // JPG
      marker !== 0xcc // DAC
    ) {
      // SOF：精度(1) 高(2) 宽(2) 分量数(1)
      if (segLen >= 8 && payload + 5 <= b.length) {
        meta.bitDepth = b[payload]
        meta.height = be16(b, payload + 1)
        meta.width = be16(b, payload + 3)
        if (meta.dpi !== undefined) break
      }
    }
    o += 2 + segLen
  }
  return meta
}

function parseGif(b: Uint8Array): ImageMetadata {
  if (ascii(b, 0, 3) !== 'GIF') return {}
  if (b.length < 13) return {}
  const packed = b[10]
  // 颜色分辨率字段（bit 6-4）：0-7 → 每通道位数 = N + 1
  const bitDepth = ((packed >> 4) & 0x07) + 1
  return { width: le16(b, 6), height: le16(b, 8), bitDepth }
}

function parseBmp(b: Uint8Array): ImageMetadata {
  if (ascii(b, 0, 2) !== 'BM') return {}
  if (b.length < 42) return {}
  const dibSize = le32(b, 14)
  const meta: ImageMetadata = {
    width: le32(b, 18),
    height: le32(b, 22) & 0x7fffffff, // 高度可能为负（自顶向下）
    bitDepth: le16(b, 28),
  }
  // biXPelsPerMeter（offset 38）：像素/米 → DPI
  if (dibSize >= 40) {
    const ppm = le32(b, 38)
    if (ppm > 0) meta.dpi = Math.round(ppm / 39.3701)
  }
  return meta
}

function parseWebp(b: Uint8Array): ImageMetadata {
  if (ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return {}
  const meta: ImageMetadata = { bitDepth: 8 }
  const fourcc = ascii(b, 12, 4)
  if (fourcc === 'VP8X' && b.length >= 30) {
    // canvas 宽高：3 字节小端，存储值 = 实际值 - 1
    meta.width = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1
    meta.height = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1
  } else if (fourcc === 'VP8 ' && b.length >= 30 && ascii(b, 23, 3) === '\x9d\x01\x2a') {
    // 关键帧：start code 后 14 位宽高
    meta.width = le16(b, 26) & 0x3fff
    meta.height = le16(b, 28) & 0x3fff
  } else if (fourcc === 'VP8L' && b.length >= 25) {
    // d = 4 字节小端；低 14 位宽、次 14 位高，各自 -1 存储
    const d = le32(b, 21)
    meta.width = (d & 0x3fff) + 1
    meta.height = ((d >> 14) & 0x3fff) + 1
  }
  return meta
}

/** 按扩展名解析图片元数据；未知格式或解析失败返回空对象 */
export function parseImageMetadata(bytes: Uint8Array, ext: string): ImageMetadata {
  switch (ext) {
    case 'png':
      return parsePng(bytes)
    case 'jpg':
    case 'jpeg':
    case 'jfif':
      return parseJpeg(bytes)
    case 'gif':
      return parseGif(bytes)
    case 'bmp':
      return parseBmp(bytes)
    case 'webp':
      return parseWebp(bytes)
    default:
      return {}
  }
}