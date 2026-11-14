import type { Recording } from './asr.ts'
import { app, clipboard } from 'electron'
import { record, transcribe } from './asr.ts'
import { restore, snapshot } from './clipboard.ts'
import { paste, startHotkey } from './hotkey.ts'
import { createTray } from './tray.ts'

let phase: 'idle' | 'recording' | 'working' = 'idle'
let session: Promise<Recording> | undefined

if (!app.requestSingleInstanceLock()) {
  app.quit()
}
else {
  void app.whenReady().then(() => {
    createTray()
    startHotkey(begin, end)
  })
}

function begin(): void {
  if (phase !== 'idle')
    return

  phase = 'recording'
  session = record()
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

    const text = await transcribe(pcm)
    if (text)
      await deliver(text)
  }
  catch {}
  finally {
    phase = 'idle'
  }
}

async function deliver(text: string): Promise<void> {
  const saved = await snapshot()
  await clipboard.writeText(text)
  paste()
  setTimeout(() => void restore(saved, text).catch(() => {}), 300)
}
