import { getCachedAudio, putCachedAudio } from './audioCache'
import type { BanglaVoiceId } from '../types/word'

const inflight = new Map<string, Promise<Blob>>()

function memKey(voice: BanglaVoiceId, text: string, rate: number) {
  return `${voice}|${rate.toFixed(2)}|${text}`
}

export async function fetchBanglaAudio(
  text: string,
  voice: BanglaVoiceId,
  rate: number,
): Promise<Blob> {
  const cached = await getCachedAudio(voice, text, rate)
  if (cached) return cached

  const key = memKey(voice, text, rate)
  const existing = inflight.get(key)
  if (existing) return existing

  const task = (async () => {
    const params = new URLSearchParams({
      text,
      voice,
      rate: String(rate),
    })
    const res = await fetch(`/api/tts?${params.toString()}`)
    if (!res.ok) {
      const body = await res.text()
      throw new Error(body || `TTS HTTP ${res.status}`)
    }
    const blob = await res.blob()
    await putCachedAudio(voice, text, rate, blob).catch(() => undefined)
    return blob
  })()

  inflight.set(key, task)
  try {
    return await task
  } finally {
    inflight.delete(key)
  }
}
