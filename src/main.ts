import type { Recording } from './asr.ts'
import { app, clipboard } from 'electron'
import { record, transcribe } from './asr.ts'
import { restore, snapshot } from './clipboard.ts'
import { paste, startHotkey } from './hotkey.ts'
import { createTray } from './tray.ts'

// 目标应用读剪贴板有延迟，等它读完再还原
const RESTORE_DELAY = 300

let phase: 'idle' | 'recording' | 'working' = 'idle'
let session: Promise<Recording> | undefined

// 双开会抢全局键盘钩子；启动失败就直接退，别留僵尸进程
if (!app.requestSingleInstanceLock()) {
  app.quit()
}
else {
  app.whenReady().then(() => {
    createTray()
    startHotkey(begin, () => void end())
  }).catch(() => app.quit())
}

function begin(): void {
  if (phase !== 'idle')
    return

  phase = 'recording'
  // 不 await：开设备期间用户可能已松手，交给 end() 等
  session = record()
  // 失败由 end() 处理，这里只避免 unhandled rejection
  session.catch(() => {})
}

async function end(): Promise<void> {
  const current = session
  session = undefined
  if (!current)
    return

  phase = 'working'

  try {
    const { stop } = await current
    const pcm = await stop()
    // 不到 250ms 的音频（16k/mono/int16 = 8000 字节）不值得请求一次
    if (pcm.length < 8000)
      return

    const text = await transcribe(pcm)
    // 没识别出内容就别占剪贴板
    if (text)
      await deliver(text)
  }
  catch {
    // 开麦、网络、识别失败都静默回到 idle
  }
  finally {
    phase = 'idle'
  }
}

async function deliver(text: string): Promise<void> {
  const saved = await snapshot()
  await clipboard.writeText(text)
  paste()
  // 还原失败不影响主流程
  setTimeout(() => void restore(saved, text).catch(() => {}), RESTORE_DELAY)
}
