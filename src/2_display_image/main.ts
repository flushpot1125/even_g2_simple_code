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

// 1ビットモノクロBMP作成（200x100固定、G2実機で表示するために必要）
function createMonochromeBMP(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const rowStride = Math.floor((width + 31) / 32) * 4
  const pixelDataSize = rowStride * height
  const fileSize = 62 + pixelDataSize
  
  const buf = new ArrayBuffer(fileSize)
  const view = new DataView(buf)
  const data = new Uint8Array(buf)
  
  // BMPヘッダー
  view.setUint8(0, 0x42); view.setUint8(1, 0x4D) // "BM"
  view.setUint32(2, fileSize, true)
  view.setUint32(10, 62, true) // ピクセルデータオフセット
  view.setUint32(14, 40, true) // DIBヘッダーサイズ
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true) // カラープレーン
  view.setUint16(28, 1, true) // 1ビット深度
  view.setUint32(34, pixelDataSize, true)
  view.setInt32(38, 2835, true); view.setInt32(42, 2835, true) // 72 DPI
  view.setUint32(46, 2, true) // 2色パレット
  view.setUint32(54, 0x00000000, true) // 黒
  view.setUint32(58, 0x00FFFFFF, true) // 白
  
  // ピクセルデータ（BMPは下から上）
  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y
    const dstOffset = 62 + y * rowStride
    for (let x = 0; x < width; x++) {
      if (pixels[srcRow * width + x]) {
        const byteIdx = dstOffset + Math.floor(x / 8)
        const bitIdx = 7 - (x % 8)
        data[byteIdx] |= 1 << bitIdx
      }
    }
  }
  
  return data
}

// 画像を200x100の1ビットモノクロBMPに変換（常に200x100で出力）
async function processImage(file: File): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    
    reader.onload = (e) => { img.src = e.target?.result as string }
    reader.onerror = () => reject(new Error('Failed to read file'))
    img.onerror = () => reject(new Error('Failed to load image'))
    
    img.onload = () => {
      const W = 200, H = 100 // G2画像コンテナサイズ
      const ratio = Math.min(W / img.width, H / img.height)
      const w = Math.floor(img.width * ratio)
      const h = Math.floor(img.height * ratio)
      const ox = Math.floor((W - w) / 2)
      const oy = Math.floor((H - h) / 2)
      
      console.log(`[Image] Original: ${img.width}x${img.height}, Scaled: ${w}x${h}, Target: ${W}x${H}`)
      console.log(`[Image] Offset: (${ox}, ${oy})`)
      
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!
      
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, W, H)
      ctx.drawImage(img, ox, oy, w, h)
      
      const data = ctx.getImageData(0, 0, W, H).data
      const pixels = new Uint8Array(W * H)
      
      // グレースケール変換 + 二値化（閾値128）
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
        pixels[i / 4] = gray >= 128 ? 1 : 0
      }
      
      const bmp = createMonochromeBMP(pixels, W, H)
      console.log(`[Image] BMP size: ${bmp.length} bytes (${W}x${H})`)
      
      resolve(Array.from(bmp))
    }
    
    reader.readAsDataURL(file)
  })
}

// 初期化
updateStatus('Connecting to G2...')
console.log('[Bridge] Waiting for Even App Bridge...')

const bridge = await getBridge()
console.log('[Bridge] Connected successfully')
updateStatus('Connected! Please select an image.', 'success')

// コンテナ設定
console.log('[G2] Creating startup page...')
await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 2,
    textObject: [new TextContainerProperty({
      xPosition: 0, yPosition: 0, width: 576, height: 80,
      borderWidth: 0, borderColor: 5, paddingLength: 10,
      containerID: 1, containerName: 'hello-text',
      content: 'Select an image below', isEventCapture: 1,
    })],
    imageObject: [new ImageContainerProperty({
      xPosition: 188, yPosition: 94, width: 200, height: 100,
      containerID: 2, containerName: 'main-image',
    })],
  })
)
console.log('[G2] Startup page created successfully!')

// 画像選択イベント
document.getElementById('imageInput')?.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  try {
    updateStatus('Processing image...')
    console.log('[Image] Processing:', file.name)
    
    const imageBytes = await processImage(file)
    console.log('[Image] Processed, size:', imageBytes.length, 'bytes')
    
    updateStatus('Sending image to G2...')
    await bridge.updateImageRawData(new ImageRawDataUpdate({
      containerID: 2, containerName: 'main-image', imageData: imageBytes,
    }))
    console.log('[G2] Image sent successfully')
    
    await bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: 1, containerName: 'hello-text',
      contentOffset: 0, contentLength: 100,
      content: `Image: ${file.name}`,
    }))
    
    updateStatus(`Image displayed: ${file.name}`, 'success')
  } catch (error) {
    console.error('[Error]:', error)
    updateStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
  }
})
