import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings, Word } from '../types/word'
import { useSpeech } from './useSpeech'

export type PlayerPhase = 'idle' | 'playing' | 'paused' | 'done'

type UseWordPlayerArgs = {
  words: Word[]
  settings: AppSettings
}

function shuffleList<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function buildPlaylist(words: Word[], shuffle: boolean) {
  return shuffle ? shuffleList(words) : words
}

/** Current word is spoken on demand; only the next word is prefetched. */
const PREFETCH_AHEAD = 1

export function useWordPlayer({ words, settings }: UseWordPlayerArgs) {
  const { speakWord, cancel, prefetchWordAudio, unlockAudio } = useSpeech()
  const [playlist, setPlaylist] = useState<Word[]>(() =>
    buildPlaylist(words, settings.shuffle),
  )
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<PlayerPhase>('idle')
  const runIdRef = useRef(0)
  const phaseRef = useRef<PlayerPhase>('idle')
  const indexRef = useRef(0)
  const settingsRef = useRef(settings)
  const playlistRef = useRef(playlist)
  const wordsRef = useRef(words)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    wordsRef.current = words
    const next = buildPlaylist(words, settings.shuffle)
    playlistRef.current = next
    setPlaylist(next)
    runIdRef.current += 1
    cancel()
    setIndex(0)
    setPhase('idle')
  }, [words, settings.shuffle, cancel])

  const prefetchWindow = useCallback(
    (fromIndex: number) => {
      const s = settingsRef.current
      if (s.muted || s.banglaEngine === 'device') return
      const list = playlistRef.current
      const last = Math.min(list.length, fromIndex + PREFETCH_AHEAD)
      for (let i = Math.max(0, fromIndex); i < last; i++) {
        const word = list[i]
        prefetchWordAudio(
          {
            id: word.id,
            en: word.en,
            bn: word.bn,
            exampleEn: word.exampleEn,
            exampleBn: word.exampleBn,
          },
          s.geminiVoice,
          s.rate,
          s.banglaEngine,
          s.speechMode,
        )
      }
    },
    [prefetchWordAudio],
  )

  const playFrom = useCallback(
    async (startIndex: number) => {
      const runId = ++runIdRef.current
      setPhase('playing')
      phaseRef.current = 'playing'

      const isStopped = () =>
        runId !== runIdRef.current || phaseRef.current === 'paused'

      prefetchWindow(startIndex + 1)

      for (let i = startIndex; i < playlistRef.current.length; i++) {
        if (isStopped()) return
        setIndex(i)
        indexRef.current = i
        const word = playlistRef.current[i]
        const s = settingsRef.current

        prefetchWindow(i + 1)

        let heard = false
        while (!heard) {
          if (isStopped()) return
          try {
            await speakWord(
              {
                id: word.id,
                en: word.en,
                bn: word.bn,
                exampleEn: word.exampleEn,
                exampleBn: word.exampleBn,
              },
              {
                rate: s.rate,
                volume: s.volume,
                muted: s.muted,
                mode: s.speechMode,
                banglaVoice: s.banglaVoice,
                geminiVoice: s.geminiVoice,
                banglaEngine: s.banglaEngine,
                enBnGapMs: s.enBnGapMs,
                banglaRepeat: s.banglaRepeat,
              },
            )
            heard = true
          } catch {
            if (isStopped()) return
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, 600)
            })
          }
        }

        if (isStopped()) return

        if (!s.autoAdvance) {
          setPhase('paused')
          phaseRef.current = 'paused'
          return
        }

        if (i < playlistRef.current.length - 1) {
          await new Promise<void>((resolve) => {
            const delay = settingsRef.current.advanceDelayMs
            const t = window.setTimeout(resolve, delay)
            const check = window.setInterval(() => {
              if (isStopped()) {
                window.clearTimeout(t)
                window.clearInterval(check)
                resolve()
              }
            }, 80)
            window.setTimeout(() => window.clearInterval(check), delay + 50)
          })
        }

        if (isStopped()) return
      }

      if (runId === runIdRef.current) {
        setPhase('done')
        phaseRef.current = 'done'
      }
    },
    [speakWord, prefetchWindow],
  )

  const reshuffleIfNeeded = useCallback(() => {
    if (!settingsRef.current.shuffle) return
    const next = buildPlaylist(wordsRef.current, true)
    playlistRef.current = next
    setPlaylist(next)
  }, [])

  const start = useCallback((fromWordId?: string | null) => {
    void unlockAudio()
    reshuffleIfNeeded()
    cancel()
    let startIndex = 0
    if (fromWordId) {
      const found = playlistRef.current.findIndex((w) => w.id === fromWordId)
      if (found >= 0) startIndex = found
    }
    setIndex(startIndex)
    prefetchWindow(startIndex + 1)
    void playFrom(startIndex)
  }, [cancel, playFrom, prefetchWindow, reshuffleIfNeeded, unlockAudio])

  const pause = useCallback(() => {
    runIdRef.current += 1
    cancel()
    setPhase('paused')
    phaseRef.current = 'paused'
  }, [cancel])

  const resume = useCallback(() => {
    void unlockAudio()
    const s = settingsRef.current
    if (!s.autoAdvance) {
      const nextIndex = Math.min(indexRef.current + 1, playlistRef.current.length - 1)
      if (nextIndex === indexRef.current) {
        setPhase('done')
        phaseRef.current = 'done'
        return
      }
      void playFrom(nextIndex)
      return
    }
    void playFrom(indexRef.current)
  }, [playFrom, unlockAudio])

  const next = useCallback(() => {
    void unlockAudio()
    const nextIndex = Math.min(indexRef.current + 1, playlistRef.current.length - 1)
    if (nextIndex === indexRef.current) {
      runIdRef.current += 1
      cancel()
      setPhase('done')
      return
    }
    runIdRef.current += 1
    cancel()
    setIndex(nextIndex)
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
      void playFrom(nextIndex)
    }
  }, [cancel, playFrom, unlockAudio])

  const prev = useCallback(() => {
    void unlockAudio()
    const prevIndex = Math.max(indexRef.current - 1, 0)
    runIdRef.current += 1
    cancel()
    setIndex(prevIndex)
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
      void playFrom(prevIndex)
    }
  }, [cancel, playFrom, unlockAudio])

  const replay = useCallback(() => {
    void unlockAudio()
    runIdRef.current += 1
    cancel()
    void playFrom(indexRef.current)
  }, [cancel, playFrom, unlockAudio])

  const restart = useCallback(() => {
    void unlockAudio()
    reshuffleIfNeeded()
    cancel()
    setIndex(0)
    void playFrom(0)
  }, [cancel, playFrom, reshuffleIfNeeded, unlockAudio])

  useEffect(() => {
    const pauseIfHidden = () => {
      if (typeof document !== 'undefined' && document.hidden && phaseRef.current === 'playing') {
        pause()
      }
    }

    document.addEventListener('visibilitychange', pauseIfHidden)
    window.addEventListener('pagehide', pauseIfHidden)
    return () => {
      document.removeEventListener('visibilitychange', pauseIfHidden)
      window.removeEventListener('pagehide', pauseIfHidden)
    }
  }, [pause])

  useEffect(
    () => () => {
      runIdRef.current += 1
      cancel()
    },
    [cancel],
  )

  const current = playlist[index] ?? null
  const progress = playlist.length ? index + 1 : 0

  return {
    current,
    index,
    progress,
    total: playlist.length,
    phase,
    start,
    pause,
    resume,
    next,
    prev,
    replay,
    restart,
  }
}
