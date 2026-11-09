import path from 'node:path'
import { app, Menu, Tray } from 'electron'

let tray: Tray | undefined

export function createTray(): void {
  // 必须留引用，否则 Tray 被 GC，图标消失
  tray = new Tray(path.join(app.getAppPath(), 'assets', 'tray.png'))
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]))
}
