import { getCachedAudio, putCachedAudio } from './audioCache'
import type { BanglaEngine, BanglaVoiceId, GeminiVoiceId } from '../types/word'

const inflight = new Map<string, Promise<Blob>>()

export type CloudBanglaEngine = Exclude<BanglaEngine, 'device'>

function memKey(
  engine: CloudBanglaEngine,
  voice: string,
  text: string,
  rate: number,
) {
  return `${engine}|${voice}|${rate.toFixed(2)}|${text}`
}

export async function fetchBanglaAudio(
  text: string,
  voice: BanglaVoiceId | GeminiVoiceId,
  rate: number,
  engine: CloudBanglaEngine = 'neural',
): Promise<Blob> {
  const cached = await getCachedAudio(`${engine}:${voice}`, text, rate)
  if (cached) return cached

  const key = memKey(engine, voice, text, rate)
  const existing = inflight.get(key)
  if (existing) return existing

  const task = (async () => {
    const params = new URLSearchParams({
      text,
      voice,
      rate: String(rate),
      engine,
    })
    const res = await fetch(`/api/tts?${params.toString()}`)
    if (!res.ok) {
      const body = await res.text()
      throw new Error(body || `TTS HTTP ${res.status}`)
    }
    const blob = await res.blob()
    await putCachedAudio(`${engine}:${voice}`, text, rate, blob).catch(() => undefined)
    return blob
  })()

  inflight.set(key, task)
  try {
    return await task
  } finally {
    inflight.delete(key)
  }
}
