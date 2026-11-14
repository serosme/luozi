import { clipboard, ClipboardItem } from 'electron'

type Value = string | Blob | Electron.ClipboardBookmark
type Snapshot = Record<string, Value>[]

export async function snapshot(): Promise<Snapshot> {
  const items = await clipboard.read()
  return Promise.all(items.filter(item => item.types.length).map(async item =>
    Object.fromEntries(await Promise.all(item.types.map(async type => [type, await item.getType(type)] as const))),
  ))
}

export async function restore(saved: Snapshot, written: string): Promise<void> {
  if (await clipboard.readText() !== written)
    return

  if (!saved.length)
    return clipboard.clear()

  await clipboard.write(saved.map(values => new ClipboardItem(values)))
}
