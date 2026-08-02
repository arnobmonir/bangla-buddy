import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { AppSettings, Category, Word } from '../types/word'
import { loadCategoryWords } from '../data/loader'
import { useSpeech } from '../hooks/useSpeech'
import {
  buildQuizRound,
  starCount,
  type QuizQuestion,
  QUIZ_ROUND_SIZE,
} from '../lib/quiz'
import styles from './Quiz.module.css'

type Props = {
  category: Category
  settings: AppSettings
  onBackToPick: () => void
  onHome: () => void
  onQuizComplete: (categoryId: string, score: number, total: number) => void
}

type Phase = 'loading' | 'error' | 'playing' | 'done'

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function Quiz({
  category,
  settings,
  onBackToPick,
  onHome,
  onQuizComplete,
}: Props) {
  const { speakWord, cancel } = useSpeech()
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedBn, setSelectedBn] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null)
  const [introPlaying, setIntroPlaying] = useState(false)
  const answeredCountRef = useRef(0)
  const scoredRef = useRef(false)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const answerTicketRef = useRef(0)
  const introTicketRef = useRef(0)

  const clearAdvance = () => {
    if (advanceTimerRef.current != null) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
  }

  const stopSpeechFlows = useCallback(() => {
    introTicketRef.current += 1
    answerTicketRef.current += 1
    clearAdvance()
    cancel()
    setFocusedIdx(null)
    setIntroPlaying(false)
  }, [cancel])

  const startRound = useCallback(
    (words: Word[]) => {
      stopSpeechFlows()
      const round = buildQuizRound(words, QUIZ_ROUND_SIZE)
      setQuestions(round)
      setIndex(0)
      setScore(0)
      setSelectedBn(null)
      setLocked(false)
      answeredCountRef.current = 0
      scoredRef.current = false
      setPhase(round.length ? 'playing' : 'error')
      if (!round.length) {
        setError('Need at least 2 words in this category for a quiz.')
      }
    },
    [stopSpeechFlows],
  )

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setError(null)
    loadCategoryWords(category)
      .then((data) => {
        if (cancelled) return
        startRound(data.words)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load words')
        setPhase('error')
      })
    return () => {
      cancelled = true
      stopSpeechFlows()
    }
  }, [category, startRound, stopSpeechFlows])

  const current = questions[index] ?? null

  const speakOpts = useCallback(
    () => ({
      rate: settings.rate,
      volume: settings.volume,
      muted: settings.muted,
      banglaVoice: settings.banglaVoice,
      banglaEngine: settings.banglaEngine,
      enBnGapMs: settings.enBnGapMs,
      banglaRepeat: 1 as const,
    }),
    [settings],
  )

  const speakEnglish = useCallback(
    async (word: Word) => {
      if (settings.muted) return
      await speakWord(
        { id: word.id, en: word.en, bn: word.bn },
        { ...speakOpts(), mode: 'en-only' },
      )
    },
    [speakWord, settings.muted, speakOpts],
  )

  const speakBangla = useCallback(
    async (id: string, bn: string) => {
      if (settings.muted || !bn.trim()) return
      await speakWord({ id, en: bn, bn }, { ...speakOpts(), mode: 'bn-only' })
    },
    [speakWord, settings.muted, speakOpts],
  )

  const playQuestionIntro = useCallback(
    async (question: QuizQuestion, ticket: number) => {
      setIntroPlaying(true)
      setFocusedIdx(null)

      await speakEnglish(question.word)
      if (ticket !== introTicketRef.current) return

      await wait(Math.max(220, settings.enBnGapMs))
      if (ticket !== introTicketRef.current) return

      for (let i = 0; i < question.choices.length; i++) {
        if (ticket !== introTicketRef.current) return
        const choice = question.choices[i]
        setFocusedIdx(i)
        if (settings.muted) {
          // Still walk focus visually when audio is off
          await wait(900)
        } else {
          await speakBangla(choice.wordId, choice.bn)
        }
        if (ticket !== introTicketRef.current) return
        if (i < question.choices.length - 1) {
          await wait(Math.max(240, settings.enBnGapMs))
          if (ticket !== introTicketRef.current) return
        }
      }

      if (ticket !== introTicketRef.current) return
      setFocusedIdx(null)
      setIntroPlaying(false)
    },
    [speakEnglish, speakBangla, settings.enBnGapMs, settings.muted],
  )

  useEffect(() => {
    if (phase !== 'playing' || !current || locked) return
    const ticket = ++introTicketRef.current
    void playQuestionIntro(current, ticket)
    return () => {
      introTicketRef.current += 1
      cancel()
      setFocusedIdx(null)
      setIntroPlaying(false)
    }
  }, [phase, index, current?.word.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const finishRound = useCallback(
    (finalScore: number, total: number) => {
      if (!scoredRef.current) {
        scoredRef.current = true
        onQuizComplete(category.id, finalScore, total)
      }
      setPhase('done')
    },
    [category.id, onQuizComplete],
  )

  const goNext = useCallback(
    (nextScore: number) => {
      const nextIndex = index + 1
      if (nextIndex >= questions.length) {
        finishRound(nextScore, questions.length)
        return
      }
      setIndex(nextIndex)
      setSelectedBn(null)
      setLocked(false)
      setFocusedIdx(null)
    },
    [index, questions.length, finishRound],
  )

  const onSelectChoice = (choiceIndex: number, bn: string, correct: boolean, wordId: string) => {
    if (locked || !current) return
    introTicketRef.current += 1
    setIntroPlaying(false)
    clearAdvance()
    cancel()
    setLocked(true)
    setSelectedBn(bn)
    setFocusedIdx(choiceIndex)
    answeredCountRef.current += 1
    const nextScore = correct ? score + 1 : score
    if (correct) setScore(nextScore)

    const correctIdx = current.choices.findIndex((c) => c.correct)
    const correctBn = current.choices[correctIdx]?.bn ?? current.word.bn
    const correctId = current.choices[correctIdx]?.wordId ?? current.word.id
    const ticket = ++answerTicketRef.current

    void (async () => {
      await speakBangla(wordId, bn)
      if (ticket !== answerTicketRef.current) return
      if (!correct && correctBn !== bn) {
        setFocusedIdx(correctIdx >= 0 ? correctIdx : null)
        await speakBangla(correctId, correctBn)
        if (ticket !== answerTicketRef.current) return
      }
      await new Promise<void>((resolve) => {
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null
          resolve()
        }, 450)
      })
      if (ticket !== answerTicketRef.current) return
      goNext(nextScore)
    })()
  }

  const requestExit = () => {
    const midRound =
      phase === 'playing' && answeredCountRef.current > 0 && index < questions.length
    if (midRound) {
      const ok = window.confirm('Leave this quiz? Your current round will not be saved.')
      if (!ok) return
    }
    stopSpeechFlows()
    onBackToPick()
  }

  const replay = () => {
    if (!current || locked) return
    cancel()
    const ticket = ++introTicketRef.current
    void playQuestionIntro(current, ticket)
  }

  const playAgain = () => {
    loadCategoryWords(category).then((data) => startRound(data.words))
  }

  if (phase === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.status}>Loading quiz…</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className={styles.page}>
        <p className={styles.status}>{error ?? 'Something went wrong.'}</p>
        <button type="button" className={styles.secondaryBtn} onClick={onBackToPick}>
          Back to categories
        </button>
      </div>
    )
  }

  if (phase === 'done') {
    const stars = starCount(score, questions.length)
    return (
      <div className={styles.page}>
        <div
          className={styles.summary}
          style={{ '--cat-color': category.color } as CSSProperties}
        >
          <p className={styles.summaryIcon} aria-hidden>
            {category.icon}
          </p>
          <h1 className={styles.summaryTitle}>Great job!</h1>
          <p className={styles.summaryBn}>দারুণ করেছো!</p>
          <p className={styles.stars} aria-label={`${stars} stars`}>
            {'★'.repeat(stars)}
            {'☆'.repeat(3 - stars)}
          </p>
          <p className={styles.summaryScore}>
            You got <strong>{score}</strong> / {questions.length}
          </p>
          <p className={styles.summaryCat}>
            {category.nameEn} · {category.nameBn}
          </p>
          <div className={styles.summaryActions}>
            <button type="button" className={styles.primaryBtn} onClick={playAgain}>
              Play again
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={onBackToPick}>
              Change category
            </button>
            <button type="button" className={styles.ghostBtn} onClick={onHome}>
              Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!current) return null

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button type="button" className={styles.back} onClick={requestExit}>
          ← Back
        </button>
        <p className={styles.progress}>
          {index + 1} / {questions.length}
        </p>
        <p className={styles.scoreChip} aria-live="polite">
          {score}★
        </p>
      </header>

      <div
        className={styles.prompt}
        style={{ '--cat-color': category.color } as CSSProperties}
      >
        <span className={styles.emoji} aria-hidden>
          {current.word.emoji ?? category.icon}
        </span>
        <h1 className={styles.en}>{current.word.en}</h1>
        <button
          type="button"
          className={styles.speaker}
          onClick={replay}
          disabled={locked || settings.muted}
          aria-label="Hear English and options again"
        >
          <span aria-hidden>🔊</span>
          Hear again
        </button>
      </div>

      <p className={styles.hint} aria-live="polite">
        {introPlaying
          ? 'Listen to each Bangla option…'
          : 'Tap the matching Bangla word'}
      </p>

      <div className={styles.choices} role="group" aria-label="Bangla answers">
        {current.choices.map((choice, choiceIndex) => {
          const classes = [styles.choiceWrap]
          if (locked && selectedBn != null) {
            if (choice.correct) classes.push(styles.correct)
            else if (choice.bn === selectedBn) classes.push(styles.wrong)
            else classes.push(styles.dimmed)
          } else if (focusedIdx === choiceIndex) {
            classes.push(styles.focused)
          }
          return (
            <button
              key={`${current.word.id}-${choice.wordId}-${choice.bn}`}
              type="button"
              className={classes.join(' ')}
              style={{ '--cat-color': category.color } as CSSProperties}
              disabled={locked}
              aria-current={focusedIdx === choiceIndex ? 'true' : undefined}
              onClick={() =>
                onSelectChoice(choiceIndex, choice.bn, choice.correct, choice.wordId)
              }
            >
              <span className={styles.choiceBn}>{choice.bn}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
