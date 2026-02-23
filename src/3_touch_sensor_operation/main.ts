// G2 Touch Sensor Operation
// G2のタッチセンサー操作（single click, double click, scroll）を検出するアプリ

import { 
  TextContainerProperty, 
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  type EvenHubEvent,
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

// イベントログに追加する関数
function addEventLog(eventType: string) {
  const logEl = document.getElementById('eventLog')
  if (!logEl) return
  
  const timestamp = new Date().toLocaleTimeString('ja-JP')
  const entry = document.createElement('div')
  entry.className = 'log-entry'
  entry.innerHTML = `<span class="timestamp">[${timestamp}]</span><span class="event-type">${eventType}</span>`
  
  // 初回のメッセージを削除
  if (logEl.textContent === 'イベント待機中...') {
    logEl.textContent = ''
  }
  
  logEl.insertBefore(entry, logEl.firstChild)
  
  // 最大20件まで保持
  while (logEl.children.length > 20) {
    logEl.removeChild(logEl.lastChild!)
  }
}

// SDKブリッジの初期化（シミュレータモード対応）
updateStatus('Connecting to G2...')
const bridge = await getBridge()
updateStatus('Connected! Try touch operations on G2.', 'success')

// テキストコンテナ（イベント検出結果を表示）
const textContainer = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 2,
  borderColor: 10,
  paddingLength: 20,
  containerID: 1,
  containerName: 'event-display',
  content: 'タッチ操作を待っています...\n\nSingle Click\nDouble Click\nScroll\n\nを試してください',
  isEventCapture: 1, // このコンテナがイベントを受け取る
})

// 初期ページを作成
await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [textContainer],
  })
)

// イベントリスナーを登録
bridge.onEvenHubEvent((event: EvenHubEvent) => {
  console.log('Received event:', event)
  
  // textEvent, sysEvent, listEventからイベントタイプを取得
  const eventType = event.textEvent?.eventType ?? 
                    event.sysEvent?.eventType ?? 
                    event.listEvent?.eventType
  
  let displayText = ''
  let logText = ''
  
  // イベントタイプを数値として扱う（型安全性のため）
  const eventNum = eventType as number | undefined
  
  // DOUBLE_CLICK_EVENT = 3 (ダブルクリック)
  if (eventNum === 3) {
    displayText = 'ダブルクリックが検出されました\n\n'
    displayText += '━━━━━━━━━━━━━━━━\n\n'
    displayText += 'グラスを素早く2回タップ\nしました'
    logText = 'DOUBLE CLICK'
    
    updateEventDisplay(displayText)
    addEventLog(logText)
  }
  // SCROLL_TOP_EVENT = 1 (上スクロール)
  else if (eventNum === 1) {
    displayText = 'スクロールが検出されました\n\n'
    displayText += '━━━━━━━━━━━━━━━━\n\n'
    displayText += '上方向へのスクロール\n(トップに到達)'
    logText = 'SCROLL (TOP)'
    
    updateEventDisplay(displayText)
    addEventLog(logText)
  }
  // SCROLL_BOTTOM_EVENT = 2 (下スクロール)
  else if (eventNum === 2) {
    displayText = 'スクロールが検出されました\n\n'
    displayText += '━━━━━━━━━━━━━━━━\n\n'
    displayText += '下方向へのスクロール\n(ボトムに到達)'
    logText = 'SCROLL (BOTTOM)'
    
    updateEventDisplay(displayText)
    addEventLog(logText)
  }
  // CLICK_EVENT = 0 or undefined (シングルクリック)
  else if (event.textEvent || event.sysEvent) {
    displayText = 'シングルクリックが検出されました\n\n'
    displayText += '━━━━━━━━━━━━━━━━\n\n'
    displayText += 'グラスをタップすると\nこのメッセージが表示されます'
    logText = 'SINGLE CLICK'
    
    updateEventDisplay(displayText)
    addEventLog(logText)
  }
})

// テキストを更新する関数
async function updateEventDisplay(content: string) {
  try {
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 1,
        containerName: 'event-display',
        contentOffset: 0,
        contentLength: 500,
        content: content,
      })
    )
  } catch (error) {
    console.error('Error updating display:', error)
  }
}
