import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { buffer } from 'node:stream/consumers'
import { Microphone } from 'decibri'
import { parse } from 'smol-toml'

const endpoint = 'https://api.deepseek.com/v1/tools/asr'
// ASR 只支持 16k 采样，采集端必须给同一个
const SAMPLE_RATE = 16000
const CHANNELS = 1
// 服务端上限 120 秒、8 MiB；16k 单声道每秒 32 KB，先卡时长
const MAX_SECONDS = 120
const MAX_BYTES = MAX_SECONDS * SAMPLE_RATE * CHANNELS * 2
const confPath = join(homedir(), '.config', 'luozi', 'config.toml')

export interface Recording { stop: () => Promise<Buffer> }

export async function record(): Promise<Recording> {
  // decibri 出的就是 16k/mono/int16 裸 PCM
  const mic = await Microphone.open({ sampleRate: SAMPLE_RATE, channels: CHANNELS })
  const pcm = buffer(mic)
  // 到 120 秒自动停，别让长按把内存撑爆
  const timer = setTimeout(() => mic.stop(), MAX_SECONDS * 1000)

  return {
    stop() {
      clearTimeout(timer)
      mic.stop()
      return pcm
    },
  }
}

export async function transcribe(pcm: Buffer): Promise<string> {
  const { asr } = parse(readFileSync(confPath, 'utf-8')) as { asr?: { sk: string } }
  if (!asr?.sk)
    throw new Error(`${confPath} 的 asr.sk 未配置`)

  // Content-Type 不能手写，multipart 的 boundary 得由 fetch 生成
  const form = new FormData()
  form.append('file', new Blob([
    wav(pcm),
  ], { type: 'audio/wav' }), 'speech.wav')

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${asr.sk}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  })

  const body = await res.text()
  if (!res.ok)
    throw new Error(`response ${res.status} ${body}`)

  // 静音时 text 为空串
  return ((JSON.parse(body) as { text?: string }).text ?? '').trim()
}

// 服务端只认 WAV/Ogg，给裸 PCM 套 44 字节头
function wav(pcm: Buffer): Buffer {
  const data = pcm.subarray(0, MAX_BYTES)
  const head = Buffer.alloc(44)
  head.write('RIFF', 0)
  head.writeUInt32LE(36 + data.length, 4)
  head.write('WAVEfmt ', 8)
  head.writeUInt32LE(16, 16) // fmt 块长度
  head.writeUInt16LE(1, 20) // 1 = PCM
  head.writeUInt16LE(CHANNELS, 22)
  head.writeUInt32LE(SAMPLE_RATE, 24)
  head.writeUInt32LE(SAMPLE_RATE * CHANNELS * 2, 28) // 字节率
  head.writeUInt16LE(CHANNELS * 2, 32) // 块对齐
  head.writeUInt16LE(16, 34) // 位深
  head.write('data', 36)
  head.writeUInt32LE(data.length, 40)

  return Buffer.concat([head, data])
}
