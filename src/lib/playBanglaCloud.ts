import { playAudioBlob, unlockAudioPlayback } from './audioPlayer'
import { fetchBanglaAudio } from './banglaTts'
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
}

function voiceFor(
  engine: CloudBanglaPlayEngine,
  geminiVoice: GeminiVoiceId,
  banglaVoice: BanglaVoiceId,
) {
  return engine === 'gemini' ? geminiVoice : banglaVoice
}

/**
 * Play cloud Bangla TTS.
 * - Gemini: up to 3 attempts (1 + 2 retries), then auto-fallback to Neural.
 * - Neural: up to 3 attempts.
 * - Device speech is ONLY used when offline.
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
  } = args

  const aborted = () => Boolean(shouldAbort?.())

  const speakDevice = async () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = rate
      utterance.volume = volume
      utterance.lang = 'bn-BD'
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      window.speechSynthesis.speak(utterance)
    })
  }

  if (isOffline()) {
    pushDebug(logSource, 'Offline — using device Bangla voice', 'warn')
    await speakDevice()
    return
  }

  const attemptEngine = async (
    useEngine: CloudBanglaPlayEngine,
    retries: number,
  ): Promise<void> => {
    const voice = voiceFor(useEngine, geminiVoice, banglaVoice)
    let lastError: unknown

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (aborted()) return
      if (isOffline()) {
        pushDebug(logSource, 'Offline mid-play — device Bangla', 'warn')
        await speakDevice()
        return
      }

      try {
        if (attempt > 0) {
          pushDebug(
            logSource,
            `${useEngine} retry ${attempt}/${retries}`,
            'warn',
          )
          await unlockAudioPlayback()
          await new Promise((r) => window.setTimeout(r, 150 * attempt))
        }
        if (aborted()) return
        const blob = await fetchBanglaAudio(text, voice, rate, useEngine)
        if (aborted()) return
        // Neural already bakes rate into SSML; applying playbackRate again makes
        // the first play sound too slow. Gemini has no server rate — client only.
        const playRate = useEngine === 'neural' ? 1 : rate
        await playAudioBlob(blob, playRate, volume)
        return
      } catch (err) {
        lastError = err
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`${useEngine} failed after ${retries} retries`)
  }

  if (engine === 'neural') {
    try {
      await attemptEngine('neural', 2)
    } catch (err) {
      if (aborted()) return
      if (isOffline()) {
        pushDebug(logSource, 'Neural failed offline — device Bangla', 'warn')
        await speakDevice()
        return
      }
      pushDebug(
        logSource,
        err instanceof Error
          ? `Neural failed online: ${err.message}`
          : 'Neural failed online',
        'error',
      )
    }
    return
  }

  // Gemini: 2 retries, then Neural.
  try {
    await attemptEngine('gemini', 2)
  } catch (err) {
    if (aborted()) return
    if (isOffline()) {
      pushDebug(logSource, 'Gemini failed offline — device Bangla', 'warn')
      await speakDevice()
      return
    }
    const msg = err instanceof Error ? err.message : String(err)
    pushDebug(logSource, `Gemini failed after retries — Neural fallback: ${msg}`, 'warn')
    try {
      await attemptEngine('neural', 2)
    } catch (neuralErr) {
      if (aborted()) return
      if (isOffline()) {
        pushDebug(logSource, 'Neural fallback offline — device Bangla', 'warn')
        await speakDevice()
        return
      }
      pushDebug(
        logSource,
        neuralErr instanceof Error
          ? `Neural fallback failed: ${neuralErr.message}`
          : 'Neural fallback failed',
        'error',
      )
    }
  }
}
