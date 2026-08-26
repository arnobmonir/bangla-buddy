import { useCallback, useEffect, useRef, useState } from 'react'
import {
  stopSharedAudio,
  unlockAudioPlayback,
} from '../lib/audioPlayer'
import { fetchBanglaAudio, isTtsQuotaCooling } from '../lib/banglaTts'
import { playBanglaCloud } from '../lib/playBanglaCloud'
import { isOffline } from '../lib/network'
import type {
  BanglaEngine,
  BanglaVoiceId,
  GeminiVoiceId,
  SpeechMode,
} from '../types/word'

type SpeakOptions = {
  rate: number
  volume: number
  muted: boolean
  mode: SpeechMode
  banglaVoice: BanglaVoiceId
  geminiVoice: GeminiVoiceId
  banglaEngine: BanglaEngine
  enBnGapMs: number
  banglaRepeat: 1 | 2
}

type SpeakWordInput = {
  id: string
  en: string
  bn: string
  exampleEn?: string
  exampleBn?: string
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  langs: string[],
): SpeechSynthesisVoice | null {
  for (const lang of langs) {
    const exact = voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase())
    if (exact) return exact
    const prefix = voices.find((v) =>
      v.lang.toLowerCase().startsWith(lang.split('-')[0].toLowerCase()),
    )
    if (prefix) return prefix
  }
  return null
}

export function useSpeech() {
  const [voicesReady, setVoicesReady] = useState(false)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  /** Bumps on every cancel / new speakWord — stale async work must exit. */
  const generationRef = useRef(0)
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearGapTimer = () => {
    if (gapTimerRef.current != null) {
      clearTimeout(gapTimerRef.current)
      gapTimerRef.current = null
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
      if (voicesRef.current.length > 0) setVoicesReady(true)
    }

    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
      window.speechSynthesis.cancel()
      clearGapTimer()
      stopSharedAudio()
    }
  }, [])

  const cancel = useCallback(() => {
    generationRef.current += 1
    clearGapTimer()
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    stopSharedAudio()
  }, [])

  const waitGap = useCallback((ms: number, generation: number) => {
    return new Promise<void>((resolve) => {
      clearGapTimer()
      if (generation !== generationRef.current) {
        resolve()
        return
      }
      gapTimerRef.current = setTimeout(() => {
        gapTimerRef.current = null
        resolve()
      }, ms)
    })
  }, [])

  const speakBrowser = useCallback(
    (text: string, langPrefs: string[], rate: number, volume: number, generation: number) =>
      new Promise<void>((resolve) => {
        if (generation !== generationRef.current) {
          resolve()
          return
        }
        if (!window.speechSynthesis) {
          resolve()
          return
        }

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = rate
        utterance.volume = volume
        utterance.lang = langPrefs[0] ?? 'en-US'
        const voice = pickVoice(voicesRef.current, langPrefs)
        if (voice) utterance.voice = voice

        const finish = () => resolve()
        utterance.onend = finish
        utterance.onerror = finish
        window.speechSynthesis.speak(utterance)
      }),
    [],
  )

  const speakCloudText = useCallback(
    async (
      text: string,
      lang: 'en' | 'bn',
      options: SpeakOptions,
      generation: number,
    ) => {
      if (generation !== generationRef.current) return

      if (options.banglaEngine === 'device') {
        await speakBrowser(
          text,
          lang === 'en' ? ['en-US', 'en-GB', 'en'] : ['bn-BD', 'bn-IN', 'bn'],
          options.rate,
          options.volume,
          generation,
        )
        return
      }

      await playBanglaCloud({
        text,
        lang,
        engine: 'gemini',
        geminiVoice: options.geminiVoice,
        banglaVoice: options.banglaVoice,
        rate: options.rate,
        volume: options.volume,
        shouldAbort: () => generation !== generationRef.current,
        logSource: 'speech',
      })
    },
    [speakBrowser],
  )

  const speakBanglaText = useCallback(
    async (text: string, options: SpeakOptions, generation: number) => {
      await speakCloudText(text, 'bn', options, generation)
    },
    [speakCloudText],
  )

  const speakPair = useCallback(
    async (en: string, bn: string, options: SpeakOptions, generation: number) => {
      if (generation !== generationRef.current) return

      if (options.mode === 'en-bn' || options.mode === 'en-only') {
        await speakCloudText(en, 'en', options, generation)
        if (generation !== generationRef.current) return
        if (options.mode === 'en-only') return
        await waitGap(options.enBnGapMs, generation)
        if (generation !== generationRef.current) return
      }

      const times = options.banglaRepeat
      for (let i = 0; i < times; i++) {
        if (generation !== generationRef.current) return
        await speakBanglaText(bn, options, generation)
        if (generation !== generationRef.current) return
        if (i < times - 1) {
          await waitGap(Math.max(200, options.enBnGapMs), generation)
        }
      }
    },
    [speakBanglaText, speakCloudText, waitGap],
  )

  const speakWord = useCallback(
    async (word: SpeakWordInput, options: SpeakOptions) => {
      const generation = ++generationRef.current
      clearGapTimer()
      stopSharedAudio()
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }

      if (options.muted) return
      if (generation !== generationRef.current) return

      // Keep mobile media unlocked across Gemini clips / speechSynthesis gaps.
      await unlockAudioPlayback()

      if (window.speechSynthesis) {
        window.speechSynthesis.resume()
      }

      // Example EN/BN sentences hidden for now — headword only.
      await speakPair(word.en, word.bn, options, generation)
    },
    [speakPair],
  )

  const prefetchWordAudio = useCallback(
    (
      word: SpeakWordInput,
      voice: BanglaVoiceId | GeminiVoiceId,
      rate: number,
      engine: BanglaEngine,
      mode: SpeechMode = 'en-bn',
    ) => {
      if (engine === 'device' || isOffline() || isTtsQuotaCooling()) return
      if (mode !== 'bn-only' && word.en.trim()) {
        void fetchBanglaAudio(word.en, voice, rate, 'gemini', 'en', {
          priority: 'prefetch',
        }).catch(() => undefined)
      }
      if (mode !== 'en-only' && word.bn.trim()) {
        void fetchBanglaAudio(word.bn, voice, rate, 'gemini', 'bn', {
          priority: 'prefetch',
        }).catch(() => undefined)
      }
    },
    [],
  )

  return {
    speakWord,
    cancel,
    voicesReady,
    prefetchWordAudio,
    prefetchBangla: prefetchWordAudio,
    unlockAudio: unlockAudioPlayback,
  }
}
