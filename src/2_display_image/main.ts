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

// 画像を200x100以下にリサイズし、グレースケールPNGに変換
async function processImage(file: File): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    
    img.onload = () => {
      // G2の画像コンテナの最大サイズは200x100
      const maxWidth = 200
      const maxHeight = 100
      
      let width = img.width
      let height = img.height
      
      // アスペクト比を保持してリサイズ
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.floor(width * ratio)
        height = Math.floor(height * ratio)
      }
      
      // Canvasで画像を描画
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }
      
      // グレースケールに変換
      ctx.drawImage(img, 0, 0, width, height)
      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data
      
      for (let i = 0; i < data.length; i += 4) {
        // BT.601 luminance formula
        const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
      }
      
      ctx.putImageData(imageData, 0, 0)
      
      // PNGとしてエンコード
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'))
          return
        }
        
        // Blobをnumber[]に変換
        blob.arrayBuffer().then(buffer => {
          const bytes = Array.from(new Uint8Array(buffer))
          resolve(bytes)
        })
      }, 'image/png')
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
