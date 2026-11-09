import { uIOhook, UiohookKey } from 'uiohook-napi'

let onDown: (() => void) | undefined
let onUp: (() => void) | undefined
let timer: NodeJS.Timeout | undefined
let armed = false

export function startHotkey(down: () => void, up: () => void): void {
  onDown = down
  onUp = up
  uIOhook.on('keydown', keydown)
  uIOhook.on('keyup', keyup)
  uIOhook.start()
}

export function paste(): void {
  uIOhook.keyTap(UiohookKey.V, [UiohookKey.Ctrl])
}

function keydown(e: { keycode: number }): void {
  // 自动重复会连发 keydown，只认第一次；长按 150ms 才开始
  if (e.keycode !== UiohookKey.CapsLock || armed || timer)
    return

  timer = setTimeout(() => {
    timer = undefined
    armed = true
    onDown?.()
  }, 150)
}

function keyup(e: { keycode: number }): void {
  if (e.keycode !== UiohookKey.CapsLock)
    return

  clearTimeout(timer)
  timer = undefined

  // 短按是正常的大小写切换，不动
  if (!armed)
    return

  armed = false
  onUp?.()
  // 长按已翻转一次大小写，再点一次抵消（要等物理 keyup 送完）
  setTimeout(() => uIOhook.keyTap(UiohookKey.CapsLock, []), 50)
}
