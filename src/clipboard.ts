import { clipboard, ClipboardItem } from 'electron'

type Value = string | Blob | Electron.ClipboardBookmark
type Snapshot = Record<string, Value>[]

// ClipboardItem 不能直接写回，要用 getType() 的值重建
export async function snapshot(): Promise<Snapshot> {
  const items = await clipboard.read()
  // 空剪贴板会给一个零类型条目，重建会抛错
  return Promise.all(items.filter(item => item.types.length).map(async (item) => {
    const payloads = await Promise.all(item.types.map(type => item.getType(type)))
    return Object.fromEntries(item.types.map((type, i) => [type, payloads[i]]))
  }))
}

// 剪贴板已被用户改过就不还原
export async function restore(saved: Snapshot, written: string): Promise<void> {
  if (await clipboard.readText() !== written)
    return

  if (!saved.length)
    return clipboard.clear()

  await clipboard.write(saved.map(values => new ClipboardItem(values)))
}
