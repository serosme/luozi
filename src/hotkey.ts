import { uIOhook, UiohookKey } from 'uiohook-napi'

export function startHotkey(down: () => unknown, up: () => unknown): void {
  let timer: NodeJS.Timeout | undefined
  let armed = false

  uIOhook.on('keydown', (e) => {
    if (e.keycode !== UiohookKey.CapsLock || armed || timer)
      return

    timer = setTimeout(() => {
      timer = undefined
      armed = true
      down()
    }, 150)
  })

  uIOhook.on('keyup', (e) => {
    if (e.keycode !== UiohookKey.CapsLock)
      return

    clearTimeout(timer)
    timer = undefined

    if (!armed)
      return

    armed = false
    void up()
    setTimeout(() => uIOhook.keyTap(UiohookKey.CapsLock, []), 50)
  })

  uIOhook.start()
}

export function paste(): void {
  uIOhook.keyTap(UiohookKey.V, [UiohookKey.Ctrl])
}
