import type { Recording } from './asr.ts'
import { app, clipboard } from 'electron'
import { record, transcribe } from './asr.ts'
import { restore, snapshot } from './clipboard.ts'
import { paste, startHotkey } from './hotkey.ts'
import { createTray } from './tray.ts'

// 目标应用读剪贴板有延迟
const RESTORE_DELAY = 300

let phase: 'idle' | 'recording' | 'working' = 'idle'
let session: Promise<Recording> | undefined

// 双开会抢全局键盘钩子
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
  // 不 await：开设备期间可能已经松手
  session = record()
  // 失败由 end() 处理，这里挡 unhandled rejection
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
    // 不足 250ms 不值得请求
    if (pcm.length < 8000)
      return

    const text = await transcribe(pcm)
    if (text)
      await deliver(text)
  }
  catch {
    // 失败静默回 idle
  }
  finally {
    phase = 'idle'
  }
}

async function deliver(text: string): Promise<void> {
  const saved = await snapshot()
  await clipboard.writeText(text)
  paste()
  setTimeout(() => void restore(saved, text).catch(() => {}), RESTORE_DELAY)
}
