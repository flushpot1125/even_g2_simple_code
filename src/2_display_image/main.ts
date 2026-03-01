// G2 Image Viewer
// スマートフォン側で画像を選択し、Even G2のグラスに表示するアプリ

import { 
  TextContainerProperty,
  ImageContainerProperty,
  CreateStartUpPageContainer,
  ImageRawDataUpdate,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { getBridge } from '../simulator-helper'

// ステータス表示を更新する関数
function updateStatus(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const statusEl = document.getElementById('status')
  if (statusEl) {
    statusEl.textContent = message
    statusEl.className = 'status'
    if (type === 'success') statusEl.classList.add('connected')
    if (type === 'error') statusEl.classList.add('error')
  }
}

// 1ビットモノクロBMPのヘッダーサイズとパラメータ
const BMP_HEADER_SIZE = 62
const BMP_SIGNATURE = [0x42, 0x4D] // "BM"
const BMP_DIB_HEADER_SIZE = 40
const BMP_BITS_PER_PIXEL = 1
const BMP_COMPRESSION = 0
const BMP_COLORS_USED = 2
const BMP_PPM = 2835 // pixels per meter (72 DPI)

// BMPの行ストライド（4バイト境界にアライン）
function getBmpRowStride(width: number): number {
  return Math.floor((width + 31) / 32) * 4
}

// BMPピクセルデータサイズ
function getBmpPixelDataSize(width: number, height: number): number {
  return getBmpRowStride(width) * height
}

// BMP全体のファイルサイズ
function getBmpFileSize(width: number, height: number): number {
  return BMP_HEADER_SIZE + getBmpPixelDataSize(width, height)
}

// 1ビットモノクロBMPバッファを初期化
function initBmpBuffer(width: number, height: number): Uint8Array {
  const fileSize = getBmpFileSize(width, height)
  const buf = new ArrayBuffer(fileSize)
  const view = new DataView(buf)
  const data = new Uint8Array(buf)
  
  // BMPファイルヘッダー
  view.setUint8(0, BMP_SIGNATURE[0]) // 'B'
  view.setUint8(1, BMP_SIGNATURE[1]) // 'M'
  view.setUint32(2, fileSize, true) // ファイルサイズ
  view.setUint16(6, 0, true) // 予約領域1
  view.setUint16(8, 0, true) // 予約領域2
  view.setUint32(10, BMP_HEADER_SIZE, true) // ピクセルデータのオフセット
  
  // DIBヘッダー (BITMAPINFOHEADER)
  view.setUint32(14, BMP_DIB_HEADER_SIZE, true) // DIBヘッダーサイズ
  view.setInt32(18, width, true) // 画像幅
  view.setInt32(22, height, true) // 画像高さ
  view.setUint16(26, 1, true) // カラープレーン数
  view.setUint16(28, BMP_BITS_PER_PIXEL, true) // ビット深度
  view.setUint32(30, BMP_COMPRESSION, true) // 圧縮方式（0=無圧縮）
  view.setUint32(34, getBmpPixelDataSize(width, height), true) // 画像データサイズ
  view.setInt32(38, BMP_PPM, true) // 水平解像度
  view.setInt32(42, BMP_PPM, true) // 垂直解像度
  view.setUint32(46, BMP_COLORS_USED, true) // カラーパレット数
  view.setUint32(50, 0, true) // 重要な色数（0=全て）
  
  // カラーパレット（2色：黒と白）
  // 色0: 黒 (R=0, G=0, B=0, A=0)
  view.setUint32(54, 0x00000000, true)
  // 色1: 白 (R=255, G=255, B=255, A=0)
  view.setUint32(58, 0x00FFFFFF, true)
  
  return data
}

// ピクセルデータ（0または1の配列）を1ビットBMPにエンコード
// pixels: width * height の配列、0=黒、1=白
function encodeBmpPixels(bmpBuffer: Uint8Array, pixels: Uint8Array, width: number, height: number): void {
  const rowStride = getBmpRowStride(width)
  bmpBuffer.fill(0, BMP_HEADER_SIZE)
  
  for (let y = 0; y < height; y++) {
    // BMPは下から上に格納されるため、行を反転
    const srcRow = height - 1 - y
    const dstOffset = BMP_HEADER_SIZE + y * rowStride
    
    for (let x = 0; x < width; x++) {
      if (pixels[srcRow * width + x]) {
        const byteIdx = dstOffset + Math.floor(x / 8)
        const bitIdx = 7 - (x % 8)
        bmpBuffer[byteIdx] |= 1 << bitIdx
      }
    }
  }
}

// 画像を200x100の1ビットモノクロBMPに変換（常に200x100のサイズで出力）
async function processImage(file: File): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    
    img.onload = () => {
      // G2の画像コンテナのサイズに固定（200x100）
      const targetWidth = 200
      const targetHeight = 100
      
      let srcWidth = img.width
      let srcHeight = img.height
      
      // アスペクト比を保持してリサイズ計算
      const ratio = Math.min(targetWidth / srcWidth, targetHeight / srcHeight)
      const scaledWidth = Math.floor(srcWidth * ratio)
      const scaledHeight = Math.floor(srcHeight * ratio)
      
      // 中央配置のためのオフセット
      const offsetX = Math.floor((targetWidth - scaledWidth) / 2)
      const offsetY = Math.floor((targetHeight - scaledHeight) / 2)
      
      console.log(`[Image] Original: ${srcWidth}x${srcHeight}, Scaled: ${scaledWidth}x${scaledHeight}, Target: ${targetWidth}x${targetHeight}`)
      console.log(`[Image] Offset: (${offsetX}, ${offsetY})`)
      
      // Canvasで画像を描画（200x100固定サイズ）
      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }
      
      // 背景を白で塗りつぶし（二値化後に白になる）
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, targetWidth, targetHeight)
      
      // 画像を中央に描画
      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight)
      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight)
      const data = imageData.data
      
      // グレースケールに変換し、閾値で二値化（0または1）
      const pixels = new Uint8Array(targetWidth * targetHeight)
      const threshold = 128 // 二値化の閾値
      
      for (let i = 0; i < data.length; i += 4) {
        // BT.601 luminance formula
        const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
        const pixelIdx = i / 4
        // 閾値より明るければ1（白）、暗ければ0（黒）
        pixels[pixelIdx] = gray >= threshold ? 1 : 0
      }
      
      // 1ビットモノクロBMPにエンコード（200x100固定）
      const bmpBuffer = initBmpBuffer(targetWidth, targetHeight)
      encodeBmpPixels(bmpBuffer, pixels, targetWidth, targetHeight)
      
      console.log(`[Image] BMP size: ${bmpBuffer.length} bytes (${targetWidth}x${targetHeight})`)
      
      // number[]として返す
      const bytes = Array.from(bmpBuffer)
      resolve(bytes)
    }
    
    img.onerror = () => reject(new Error('Failed to load image'))
    reader.onerror = () => reject(new Error('Failed to read file'))
    
    reader.readAsDataURL(file)
  })
}

// SDKブリッジの初期化
updateStatus('Connecting to G2...')
console.log('[Bridge] Waiting for Even App Bridge...')

const bridge = await getBridge()
console.log('[Bridge] Connected successfully')
updateStatus('Connected! Please select an image.', 'success')

// テキストコンテナ（上部に配置）
const textContainer = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 80,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 10,
  containerID: 1,
  containerName: 'hello-text',
  content: 'Select an image below',
  isEventCapture: 1,
})

// 画像コンテナ（中央に配置）
const imageContainer = new ImageContainerProperty({
  xPosition: 188, // (576 - 200) / 2
  yPosition: 94,  // (288 - 100) / 2
  width: 200,
  height: 100,
  containerID: 2,
  containerName: 'main-image',
})

// 初期ページを作成（テキスト+画像コンテナ）
console.log('[G2] Creating startup page...')
await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 2,
    textObject: [textContainer],
    imageObject: [imageContainer],
  })
)
console.log('[G2] Startup page created successfully!')

// ファイル入力のイベントリスナー
const imageInput = document.getElementById('imageInput') as HTMLInputElement
imageInput?.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  try {
    updateStatus('Processing image...')
    console.log('[Image] Processing:', file.name)
    
    // 画像を処理
    const imageBytes = await processImage(file)
    console.log('[Image] Processed, size:', imageBytes.length, 'bytes')
    
    updateStatus('Sending image to G2...')
    
    // G2に画像を送信
    await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: 2,
        containerName: 'main-image',
        imageData: imageBytes,
      })
    )
    console.log('[G2] Image sent successfully')
    
    // テキストを更新
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 1,
        containerName: 'hello-text',
        contentOffset: 0,
        contentLength: 100,
        content: `Image: ${file.name}`,
      })
    )
    
    updateStatus(`Image displayed: ${file.name}`, 'success')
  } catch (error) {
    console.error('[Error]:', error)
    updateStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
  }
})
