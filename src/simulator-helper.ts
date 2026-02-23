// Simulator Helper
// URLパラメータに?simulator=trueがある場合、シミュレータモードで動作

import { waitForEvenAppBridge, type EvenAppBridge } from '@evenrealities/even_hub_sdk'

// URLパラメータをチェック
export function isSimulatorMode(): boolean {
  const params = new URLSearchParams(window.location.search)
  return params.get('simulator') === 'true'
}

// シミュレータモードの場合、UI上に指示を表示
export function showSimulatorInstructions(): void {
  if (!isSimulatorMode()) {
    return
  }

  console.log('[Simulator] Simulator mode detected')
  console.log('[Simulator] Please run the simulator manually:')
  console.log('[Simulator]   npx @evenrealities/evenhub-simulator')
  
  // UI上に指示を表示
  const instruction = document.createElement('div')
  instruction.id = 'simulator-instruction'
  instruction.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #2196f3;
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    max-width: 300px;
  `
  instruction.innerHTML = `
    <strong>📱 Simulator Mode</strong><br>
    Run in terminal:<br>
    <code style="background: rgba(0,0,0,0.2); padding: 2px 4px; border-radius: 2px;">
      npx @evenrealities/evenhub-simulator
    </code>
    <div style="margin-top: 8px; font-size: 10px; opacity: 0.9;">
      The simulator will appear in a new window
    </div>
  `
  document.body.appendChild(instruction)
}

// ブリッジを取得（シミュレータモードでもそのまま使える）
export async function getBridge(): Promise<EvenAppBridge> {
  // シミュレータモードの場合は指示を表示
  showSimulatorInstructions()
  
  // ブリッジを待つ
  console.log('[Bridge] Waiting for Even App Bridge...')
  const bridge = await waitForEvenAppBridge()
  console.log('[Bridge] Connected successfully')
  
  return bridge
}
