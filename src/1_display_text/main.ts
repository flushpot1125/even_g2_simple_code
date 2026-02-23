//起動直後にグラスに「Hello Even G2」と表示するだけ
//コード作成の参考にしたページ
//https://www.npmjs.com/package/@evenrealities/even_hub_sdk

import { 
  TextContainerProperty, 
  CreateStartUpPageContainer 
} from '@evenrealities/even_hub_sdk'
import { getBridge } from '../simulator-helper'

// シミュレータモード対応
const bridge = await getBridge()

// テキストの表示
const textContainer = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 10,
  containerID: 1,
  containerName: 'hello-text',
  content: 'Hello Even G2',
  isEventCapture: 1,  
})

// 起動ページを作成してグラスに表示
await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [textContainer],
  })
)
