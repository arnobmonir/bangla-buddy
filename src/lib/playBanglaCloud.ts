import { playAudioBlob, unlockAudioPlayback } from './audioPlayer'
import { fetchBanglaAudio, type TtsLang } from './banglaTts'
import { pushDebug } from './debugLog'
import { isOffline } from './network'
import type { BanglaVoiceId, GeminiVoiceId } from '../types/word'

export type CloudBanglaPlayEngine = 'gemini' | 'neural'

type PlayArgs = {
  text: string
  engine: CloudBanglaPlayEngine
  geminiVoice: GeminiVoiceId
  banglaVoice: BanglaVoiceId
  rate: number
  volume: number
  /** Return true to abort mid-flight (e.g. generation changed). */
  shouldAbort?: () => boolean
  logSource?: string
  lang?: TtsLang
}

function voiceFor(
  engine: CloudBanglaPlayEngine,
  geminiVoice: GeminiVoiceId,
  banglaVoice: BanglaVoiceId,
) {
  return engine === 'gemini' ? geminiVoice : banglaVoice
}

function deviceLang(lang: TtsLang) {
  return lang === 'en' ? 'en-US' : 'bn-BD'
}

function retryDelayMs(err: unknown, fallback: number) {
  const msg = err instanceof Error ? err.message : String(err)
  const match = msg.match(/retry in (\d+(?:\.\d+)?)\s*s/i)
  if (match) {
    return Math.min(15000, Math.ceil(Number(match[1]) * 1000) + 250)
  }
  return fallback
}

function wait(ms: number, shouldAbort?: () => boolean) {
  return new Promise<void>((resolve) => {
    const started = Date.now()
    const tick = () => {
      if (shouldAbort?.() || Date.now() - started >= ms) {
        resolve()
        return
      }
      window.setTimeout(tick, 80)
    }
    window.setTimeout(tick, Math.min(80, ms))
  })
}

/**
 * Play cloud TTS and do not resolve until a clip actually plays
 * (unless the caller aborts). Gemini is retried on failure — no skip-ahead.
 */
export async function playBanglaCloud(args: PlayArgs): Promise<void> {
  const {
    text,
    engine,
    geminiVoice,
    banglaVoice,
    rate,
    volume,
    shouldAbort,
    logSource = 'speech',
    lang = 'bn',
  } = args

  const aborted = () => Boolean(shouldAbort?.())
  const langLabel = lang === 'en' ? 'English' : 'Bangla'

  const speakDevice = async () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    if (aborted()) return
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = rate
      utterance.volume = volume
      utterance.lang = deviceLang(lang)
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      window.speechSynthesis.speak(utterance)
    })
  }

  if (isOffline()) {
    pushDebug(logSource, `Offline — using device ${langLabel} voice`, 'warn')
    await speakDevice()
    return
  }

  const attemptEngine = async (
    useEngine: CloudBanglaPlayEngine,
    retries: number,
  ): Promise<boolean> => {
    const voice = voiceFor(useEngine, geminiVoice, banglaVoice)
    let lastError: unknown

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (aborted()) return false
      if (isOffline()) {
        pushDebug(logSource, `Offline mid-play — device ${langLabel}`, 'warn')
        await speakDevice()
        return !aborted()
      }

      try {
        if (attempt > 0) {
          pushDebug(
            logSource,
            `${useEngine} ${lang} retry ${attempt}/${retries}`,
            'warn',
          )
          await unlockAudioPlayback()
          await wait(150 * attempt, aborted)
          if (aborted()) return false
        }
        const blob = await fetchBanglaAudio(text, voice, rate, useEngine, lang, {
          priority: 'play',
        })
        if (aborted()) return false
        const playRate = useEngine === 'neural' ? 1 : rate
        await playAudioBlob(blob, playRate, volume)
        if (aborted()) return false
        return true
      } catch (err) {
        lastError = err
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`${useEngine} failed after ${retries} retries`)
  }

  const playUntilHeard = async (useEngine: CloudBanglaPlayEngine) => {
    let delay = 500
    for (;;) {
      if (aborted()) return
      try {
        const played = await attemptEngine(useEngine, 2)
        if (aborted()) return
        if (played) return
        await wait(400, aborted)
      } catch (err) {
        if (aborted()) return
        if (isOffline()) {
          pushDebug(logSource, `${useEngine} failed offline — device ${langLabel}`, 'warn')
          await speakDevice()
          return
        }
        const msg = err instanceof Error ? err.message : String(err)
        delay = retryDelayMs(err, delay)
        pushDebug(
          logSource,
          `${useEngine} ${langLabel} not played — waiting ${Math.round(delay)}ms: ${msg}`,
          'warn',
        )
        await wait(delay, aborted)
        delay = Math.min(8000, Math.round(delay * 1.4))
      }
    }
  }

  await playUntilHeard(engine === 'neural' ? 'neural' : 'gemini')
}
