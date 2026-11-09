import type { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { buffer } from 'node:stream/consumers'
import { Microphone } from 'decibri'
import { parse } from 'smol-toml'

const endpoint = 'https://ws-lcd36h8nvhamvqa8.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const model = 'qwen-audio-3.1-asr-flash'
// 采集与请求必须同一采样率，对不上只会识别出乱码
const SAMPLE_RATE = 16000

const confPath = join(homedir(), '.config', 'luozi', 'config.toml')

interface Asr { sk: string, hotwords?: Record<string, number> }

export interface Recording { stop: () => Promise<Buffer> }

// decibri 直接给 16k/mono/int16，正好是 ASR 要的格式
export async function record(): Promise<Recording> {
  const mic = await Microphone.open({ sampleRate: SAMPLE_RATE, channels: 1 })
  // buffer() 一直读到 stop()
  const pcm = buffer(mic)

  return {
    stop() {
      mic.stop()
      return pcm
    },
  }
}

// 静音时服务端回 400 ASR_RESPONSE_HAVE_NO_WORDS，当作没说话
export async function transcribe(pcm: Buffer): Promise<string> {
  const { asr } = parse(readFileSync(confPath, 'utf-8')) as { asr?: Asr }
  if (!asr?.sk)
    throw new Error(`${confPath} 里缺 [asr] sk`)

  const data = `data:audio/pcm;base64,${pcm.toString('base64')}`
  const input = {
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: { data },
          },
        ],
      },
    ],
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${asr.sk}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input,
      // 裸 PCM 直发：format 与 sample_rate 必须成对给
      parameters: { format: 'pcm', sample_rate: SAMPLE_RATE, vocabulary: asr.hotwords },
    }),
    signal: AbortSignal.timeout(20_000),
  })

  const body = await res.text()
  if (body.includes('ASR_RESPONSE_HAVE_NO_WORDS'))
    return ''

  if (!res.ok)
    throw new Error(`ASR ${res.status} ${body.slice(0, 200)}`)

  return ((JSON.parse(body) as { text?: string }).text ?? '').trim()
}
