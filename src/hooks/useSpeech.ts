import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchBanglaAudio } from '../lib/banglaTts'
import type { BanglaEngine, BanglaVoiceId, SpeechMode } from '../types/word'

type SpeakOptions = {
  rate: number
  volume: number
  muted: boolean
  mode: SpeechMode
  banglaVoice: BanglaVoiceId
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
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioWaitRef = useRef<(() => void) | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearGapTimer = () => {
    if (gapTimerRef.current != null) {
      clearTimeout(gapTimerRef.current)
      gapTimerRef.current = null
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    audioWaitRef.current?.()
    audioWaitRef.current = null
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
      stopAudio()
    }
  }, [])

  const cancel = useCallback(() => {
    generationRef.current += 1
    clearGapTimer()
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    stopAudio()
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

  const playBlob = useCallback((blob: Blob, rate: number, volume: number, generation: number) => {
    return new Promise<void>((resolve, reject) => {
      if (generation !== generationRef.current) {
        resolve()
        return
      }

      const finish = () => {
        if (audioWaitRef.current === finish) audioWaitRef.current = null
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = null
        }
        resolve()
      }
      audioWaitRef.current = finish

      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      const audio = new Audio(url)
      audio.playbackRate = Math.min(1.15, Math.max(0.85, rate > 1 ? 1 + (rate - 1) * 0.35 : rate))
      audio.volume = volume
      audioRef.current = audio

      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null
        finish()
      }
      audio.onerror = () => {
        if (audioRef.current === audio) audioRef.current = null
        if (audioWaitRef.current === finish) audioWaitRef.current = null
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = null
        }
        reject(new Error('Audio playback failed'))
      }
      void audio.play().catch((err) => {
        if (audioWaitRef.current === finish) audioWaitRef.current = null
        reject(err)
      })
    })
  }, [])

  const speakBanglaText = useCallback(
    async (text: string, options: SpeakOptions, generation: number) => {
      if (generation !== generationRef.current) return

      if (options.banglaEngine === 'device') {
        await speakBrowser(text, ['bn-BD', 'bn-IN', 'bn'], options.rate, options.volume, generation)
        return
      }

      try {
        const blob = await fetchBanglaAudio(text, options.banglaVoice, options.rate)
        if (generation !== generationRef.current) return
        await playBlob(blob, options.rate, options.volume, generation)
      } catch {
        if (generation !== generationRef.current) return
        await speakBrowser(text, ['bn-BD', 'bn-IN', 'bn'], options.rate, options.volume, generation)
      }
    },
    [playBlob, speakBrowser],
  )

  const speakPair = useCallback(
    async (en: string, bn: string, options: SpeakOptions, generation: number) => {
      if (generation !== generationRef.current) return

      if (options.mode === 'en-bn' || options.mode === 'en-only') {
        await speakBrowser(en, ['en-US', 'en-GB', 'en'], options.rate, options.volume, generation)
        if (generation !== generationRef.current) return
        if (options.mode === 'en-only') return
        await waitGap(options.enBnGapMs, generation)
        if (generation !== generationRef.current) return
      }

      if (options.mode === 'en-only') return

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
    [speakBanglaText, speakBrowser, waitGap],
  )

  const speakWord = useCallback(
    async (word: SpeakWordInput, options: SpeakOptions) => {
      const generation = ++generationRef.current
      clearGapTimer()
      stopAudio()
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }

      if (options.muted) return
      if (generation !== generationRef.current) return

      if (window.speechSynthesis) {
        window.speechSynthesis.resume()
      }

      await speakPair(word.en, word.bn, options, generation)
      if (generation !== generationRef.current) return

      const exampleEn = word.exampleEn?.trim()
      const exampleBn = word.exampleBn?.trim()
      if (!exampleEn || !exampleBn) return

      await waitGap(Math.max(280, options.enBnGapMs), generation)
      if (generation !== generationRef.current) return

      await speakPair(exampleEn, exampleBn, options, generation)
    },
    [speakPair, waitGap],
  )

  const prefetchBangla = useCallback(
    (word: SpeakWordInput, voice: BanglaVoiceId, rate: number, engine: BanglaEngine) => {
      if (engine !== 'neural') return
      void fetchBanglaAudio(word.bn, voice, rate).catch(() => undefined)
      const exampleBn = word.exampleBn?.trim()
      if (exampleBn) {
        void fetchBanglaAudio(exampleBn, voice, rate).catch(() => undefined)
      }
    },
    [],
  )

  return { speakWord, cancel, voicesReady, prefetchBangla }
}
