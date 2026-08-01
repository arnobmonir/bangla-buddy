import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EdgeTTS } from 'node-edge-tts'

export const ALLOWED_VOICES = new Set([
  'bn-IN-TanishaaNeural',
  'bn-IN-BashkarNeural',
  'bn-BD-NabanitaNeural',
  'bn-BD-PradeepNeural',
])

export function rateToEdge(rate: number): string {
  // Map UI 0.6–1.2 → Edge rate percent around -25% … +10%
  const pct = Math.round((rate - 1) * 100)
  const clamped = Math.max(-40, Math.min(20, pct))
  return clamped >= 0 ? `+${clamped}%` : `${clamped}%`
}

export async function synthesizeBangla(
  text: string,
  voice: string,
  rate: number,
): Promise<Buffer> {
  const tmp = path.join(
    os.tmpdir(),
    `bangla-buddy-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
  )
  const tts = new EdgeTTS({
    voice,
    lang: voice.startsWith('bn-BD') ? 'bn-BD' : 'bn-IN',
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    rate: rateToEdge(rate),
    timeout: 20000,
  })

  try {
    await tts.ttsPromise(text, tmp)
    return fs.readFileSync(tmp)
  } finally {
    fs.promises.unlink(tmp).catch(() => undefined)
  }
}

export type TtsRequestParams = {
  text: string
  voice: string
  rate: number
}

export function parseTtsParams(searchParams: URLSearchParams): {
  ok: true
  value: TtsRequestParams
} | {
  ok: false
  status: number
  error: string
} {
  const text = (searchParams.get('text') ?? '').trim()
  const voice = searchParams.get('voice') ?? 'bn-IN-TanishaaNeural'
  const rate = Number(searchParams.get('rate') ?? '0.85')

  if (!text) return { ok: false, status: 400, error: 'Missing text' }
  if (text.length > 120) return { ok: false, status: 400, error: 'Text too long' }
  if (!ALLOWED_VOICES.has(voice)) {
    return { ok: false, status: 400, error: 'Unsupported voice' }
  }

  return {
    ok: true,
    value: {
      text,
      voice,
      rate: Number.isFinite(rate) ? rate : 0.85,
    },
  }
}
