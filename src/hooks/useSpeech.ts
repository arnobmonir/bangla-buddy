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
  const cancelRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioWaitRef = useRef<(() => void) | null>(null)
  const objectUrlRef = useRef<string | null>(null)

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
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      audioWaitRef.current?.()
      audioWaitRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    cancelRef.current = true
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
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
  }, [])

  const speakBrowser = useCallback(
    (text: string, langPrefs: string[], rate: number, volume: number) =>
      new Promise<void>((resolve) => {
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

        utterance.onend = () => resolve()
        utterance.onerror = () => resolve()
        window.speechSynthesis.speak(utterance)
      }),
    [],
  )

  const playBlob = useCallback((blob: Blob, rate: number, volume: number) => {
    return new Promise<void>((resolve, reject) => {
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
      // Rate already baked into neural synth; keep near 1 for clarity
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

  const speakBangla = useCallback(
    async (word: SpeakWordInput, options: SpeakOptions) => {
      if (options.banglaEngine === 'device') {
        await speakBrowser(word.bn, ['bn-BD', 'bn-IN', 'bn'], options.rate, options.volume)
        return
      }

      try {
        const blob = await fetchBanglaAudio(word.bn, options.banglaVoice, options.rate)
        if (cancelRef.current) return
        await playBlob(blob, options.rate, options.volume)
      } catch {
        if (cancelRef.current) return
        await speakBrowser(word.bn, ['bn-BD', 'bn-IN', 'bn'], options.rate, options.volume)
      }
    },
    [playBlob, speakBrowser],
  )

  const speakWord = useCallback(
    async (word: SpeakWordInput, options: SpeakOptions) => {
      cancelRef.current = false
      if (options.muted) return

      if (window.speechSynthesis) {
        window.speechSynthesis.resume()
      }

      if (options.mode === 'en-bn' || options.mode === 'en-only') {
        await speakBrowser(word.en, ['en-US', 'en-GB', 'en'], options.rate, options.volume)
        if (cancelRef.current) return
        if (options.mode === 'en-only') return
        await new Promise((r) => setTimeout(r, options.enBnGapMs))
        if (cancelRef.current) return
      }

      const times = options.banglaRepeat
      for (let i = 0; i < times; i++) {
        if (cancelRef.current) return
        await speakBangla(word, options)
        if (cancelRef.current) return
        if (i < times - 1) {
          await new Promise((r) => setTimeout(r, Math.max(200, options.enBnGapMs)))
        }
      }
    },
    [speakBangla, speakBrowser],
  )

  const prefetchBangla = useCallback(
    (word: SpeakWordInput, voice: BanglaVoiceId, rate: number, engine: BanglaEngine) => {
      if (engine !== 'neural') return
      void fetchBanglaAudio(word.bn, voice, rate).catch(() => undefined)
    },
    [],
  )

  return { speakWord, cancel, voicesReady, prefetchBangla }
}
