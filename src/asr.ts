import type { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { buffer } from 'node:stream/consumers'
import { Microphone } from 'decibri'
import { parse } from 'smol-toml'

const endpoint = 'https://ws-lcd36h8nvhamvqa8.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const confPath = join(homedir(), '.config', 'luozi', 'config.toml')
const SAMPLE_RATE = 16000

export interface Recording { stop: () => Promise<Buffer> }

export async function record(): Promise<Recording> {
  const mic = await Microphone.open({ sampleRate: SAMPLE_RATE, channels: 1 })
  const pcm = buffer(mic)

  return {
    stop() {
      mic.stop()
      return pcm
    },
  }
}

export async function transcribe(pcm: Buffer): Promise<string> {
  const { asr } = parse(readFileSync(confPath, 'utf-8')) as { asr?: { sk: string, hotwords?: Record<string, number> } }
  if (!asr?.sk)
    throw new Error('missing asr.sk')

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${asr.sk}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-audio-3.1-asr-flash',
      input: {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: { data: `data:audio/pcm;base64,${pcm.toString('base64')}` },
              },
            ],
          },
        ],
      },
      parameters: { format: 'pcm', sample_rate: SAMPLE_RATE, vocabulary: asr.hotwords },
    }),
    signal: AbortSignal.timeout(20_000),
  })

  const body = await res.text()
  if (!res.ok)
    throw new Error(`${res.status} ${body}`)

  return (JSON.parse(body) as { text: string }).text.trim()
}
