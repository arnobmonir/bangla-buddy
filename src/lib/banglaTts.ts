import { geminiApiKeyHeaders } from './geminiKey'
import { getCachedAudio, putCachedAudio } from './audioCache'
import { pushDebug } from './debugLog'
import type { BanglaEngine, BanglaVoiceId, GeminiVoiceId } from '../types/word'

const inflight = new Map<string, Promise<Blob>>()
const memCache = new Map<string, Blob>()

let quotaUntil = 0

export function isTtsQuotaCooling(): boolean {
  return Date.now() < quotaUntil
}

function armQuotaCooldown(message: string) {
  const match = message.match(/retry in (\d+(?:\.\d+)?)\s*s/i)
  const ms = match ? Math.ceil(Number(match[1]) * 1000) + 400 : 12000
  quotaUntil = Math.max(quotaUntil, Date.now() + ms)
}
const MAX_PREFETCH = 2
let activePrefetch = 0
const prefetchWaiters: Array<() => void> = []

export type CloudBanglaEngine = Exclude<BanglaEngine, 'device'>
export type TtsLang = 'en' | 'bn'
export type TtsFetchPriority = 'play' | 'prefetch'

export type FetchAudioOptions = {
  priority?: TtsFetchPriority
}

function memKey(
  engine: CloudBanglaEngine,
  voice: string,
  lang: TtsLang,
  text: string,
  rate: number,
) {
  return `${engine}|${voice}|${lang}|${rate.toFixed(2)}|${text}`
}

async function acquirePrefetchSlot(): Promise<void> {
  if (activePrefetch < MAX_PREFETCH) {
    activePrefetch += 1
    return
  }
  await new Promise<void>((resolve) => {
    prefetchWaiters.push(resolve)
  })
  activePrefetch += 1
}

function releasePrefetchSlot() {
  activePrefetch = Math.max(0, activePrefetch - 1)
  const next = prefetchWaiters.shift()
  if (next) next()
}

export async function fetchBanglaAudio(
  text: string,
  voice: BanglaVoiceId | GeminiVoiceId,
  rate: number,
  engine: CloudBanglaEngine = 'gemini',
  lang: TtsLang = 'bn',
  options: FetchAudioOptions = {},
): Promise<Blob> {
  const priority = options.priority ?? 'play'
  if (priority === 'prefetch' && isTtsQuotaCooling()) {
    throw new Error('TTS quota cooldown')
  }
  const cachedKey = `${engine}:${voice}:${lang}`
  const key = memKey(engine, voice, lang, text, rate)

  const hit = async (): Promise<Blob | null> => {
    const fromMem = memCache.get(key)
    if (fromMem) return fromMem
    const cached = await getCachedAudio(cachedKey, text, rate)
    if (cached) {
      memCache.set(key, cached)
      return cached
    }
    return null
  }

  const cached = await hit()
  if (cached) return cached

  const existing = inflight.get(key)
  if (existing) return existing

  if (priority === 'prefetch') await acquirePrefetchSlot()

  try {
    const afterWait = await hit()
    if (afterWait) return afterWait

    const joined = inflight.get(key)
    if (joined) return joined

    const task = (async () => {
      const params = new URLSearchParams({
        text,
        voice,
        rate: String(rate),
        engine,
        lang,
      })
      const res = await fetch(`/api/tts?${params.toString()}`, {
        headers: geminiApiKeyHeaders(),
      })
      if (!res.ok) {
        const body = await res.text()
        const message = body || `TTS HTTP ${res.status}`
        if (/quota exceeded|resource exhausted|rate.?limit/i.test(message)) {
          armQuotaCooldown(message)
        }
        pushDebug('tts', `${engine}/${voice}/${lang}: ${message}`, 'error')
        throw new Error(message)
      }
      const blob = await res.blob()
      if (blob.size < 2000) {
        throw new Error('TTS returned empty audio')
      }
      memCache.set(key, blob)
      pushDebug('tts', `${engine} ${lang} ok · ${text.slice(0, 40)}`, 'ok')
      await putCachedAudio(cachedKey, text, rate, blob).catch(() => undefined)
      return blob
    })()

    inflight.set(key, task)
    try {
      return await task
    } finally {
      inflight.delete(key)
    }
  } finally {
    if (priority === 'prefetch') releasePrefetchSlot()
  }
}
