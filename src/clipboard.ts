import { clipboard, ClipboardItem } from 'electron'

type Value = string | Blob | Electron.ClipboardBookmark
type Snapshot = Record<string, Value>[]

// read() 返回的 ClipboardItem 不能直接写回，必须用 getType() 的值重建
export async function snapshot(): Promise<Snapshot> {
  const items = await clipboard.read()
  // 空剪贴板会给一个零类型条目，重建会抛错，丢掉
  return Promise.all(items.filter(item => item.types.length).map(async (item) => {
    const payloads = await Promise.all(item.types.map(type => item.getType(type)))
    return Object.fromEntries(item.types.map((type, i) => [type, payloads[i]]))
  }))
}

// 只在剪贴板仍是自己刚写的内容时还原，避免覆盖用户中途复制的东西
export async function restore(saved: Snapshot, written: string): Promise<void> {
  if (await clipboard.readText() !== written)
    return

  if (!saved.length)
    return clipboard.clear()

  await clipboard.write(saved.map(values => new ClipboardItem(values)))
}
