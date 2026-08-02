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

export function useWordPlayer({ words, settings }: UseWordPlayerArgs) {
  const { speakWord, cancel, prefetchBangla } = useSpeech()
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

  const playFrom = useCallback(
    async (startIndex: number) => {
      const runId = ++runIdRef.current
      setPhase('playing')
      phaseRef.current = 'playing'

      const isStopped = () =>
        runId !== runIdRef.current || phaseRef.current === 'paused'

      for (let i = startIndex; i < playlistRef.current.length; i++) {
        if (isStopped()) return
        setIndex(i)
        indexRef.current = i
        const word = playlistRef.current[i]
        const s = settingsRef.current

        const nextWord = playlistRef.current[i + 1]
        if (nextWord && s.banglaEngine === 'neural' && s.speechMode !== 'en-only') {
          prefetchBangla(
            {
              id: nextWord.id,
              en: nextWord.en,
              bn: nextWord.bn,
              exampleEn: nextWord.exampleEn,
              exampleBn: nextWord.exampleBn,
            },
            s.banglaVoice,
            s.rate,
            s.banglaEngine,
          )
        }

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
              banglaEngine: s.banglaEngine,
              enBnGapMs: s.enBnGapMs,
              banglaRepeat: s.banglaRepeat,
            },
          )
        } catch {
          // continue even if speech fails
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
    [speakWord, prefetchBangla],
  )

  const reshuffleIfNeeded = useCallback(() => {
    if (!settingsRef.current.shuffle) return
    const next = buildPlaylist(wordsRef.current, true)
    playlistRef.current = next
    setPlaylist(next)
  }, [])

  const start = useCallback((fromWordId?: string | null) => {
    reshuffleIfNeeded()
    cancel()
    let startIndex = 0
    if (fromWordId) {
      const found = playlistRef.current.findIndex((w) => w.id === fromWordId)
      if (found >= 0) startIndex = found
    }
    setIndex(startIndex)
    void playFrom(startIndex)
  }, [cancel, playFrom, reshuffleIfNeeded])

  const pause = useCallback(() => {
    runIdRef.current += 1
    cancel()
    setPhase('paused')
    phaseRef.current = 'paused'
  }, [cancel])

  const resume = useCallback(() => {
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
  }, [playFrom])

  const next = useCallback(() => {
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
  }, [cancel, playFrom])

  const prev = useCallback(() => {
    const prevIndex = Math.max(indexRef.current - 1, 0)
    runIdRef.current += 1
    cancel()
    setIndex(prevIndex)
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
      void playFrom(prevIndex)
    }
  }, [cancel, playFrom])

  const replay = useCallback(() => {
    runIdRef.current += 1
    cancel()
    void playFrom(indexRef.current)
  }, [cancel, playFrom])

  const restart = useCallback(() => {
    reshuffleIfNeeded()
    cancel()
    setIndex(0)
    void playFrom(0)
  }, [cancel, playFrom, reshuffleIfNeeded])

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
