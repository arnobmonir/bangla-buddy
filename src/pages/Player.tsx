import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { AppSettings, Category, Word } from '../types/word'
import { loadCategoryWords } from '../data/loader'
import { WordCard } from '../components/WordCard'
import { useWordPlayer } from '../hooks/useWordPlayer'
import styles from './Player.module.css'

type Props = {
  category: Category
  settings: AppSettings
  onBack: () => void
  onSessionStart: (categoryId: string) => void
  onWordHeard: (categoryId: string, wordId: string) => void
  onCategoryComplete: (categoryId: string) => void
}

export function Player({
  category,
  settings,
  onBack,
  onSessionStart,
  onWordHeard,
  onCategoryComplete,
}: Props) {
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const trackedWordsRef = useRef<Set<string>>(new Set())
  const completedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    trackedWordsRef.current = new Set()
    completedRef.current = false
    loadCategoryWords(category)
      .then((data) => {
        if (!cancelled) {
          setWords(data.words)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load words')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [category])

  const player = useWordPlayer({ words, settings })
  const prevPhase = useRef(player.phase)

  useEffect(() => {
    if (prevPhase.current !== 'playing' && player.phase === 'playing') {
      // Fresh start from idle/restart
      if (player.index === 0 && trackedWordsRef.current.size === 0) {
        onSessionStart(category.id)
      }
    }
    if (player.phase === 'done' && !completedRef.current) {
      completedRef.current = true
      onCategoryComplete(category.id)
    }
    if (player.phase === 'idle') {
      trackedWordsRef.current = new Set()
      completedRef.current = false
    }
    prevPhase.current = player.phase
  }, [player.phase, player.index, category.id, onSessionStart, onCategoryComplete])

  const currentWordId = player.current?.id

  useEffect(() => {
    if (
      (player.phase === 'playing' || player.phase === 'paused') &&
      currentWordId
    ) {
      if (!trackedWordsRef.current.has(currentWordId)) {
        trackedWordsRef.current.add(currentWordId)
        onWordHeard(category.id, currentWordId)
      }
    }
  }, [currentWordId, player.phase, category.id, onWordHeard])

  return (
    <div
      className={styles.page}
      style={{ '--cat-color': category.color } as CSSProperties}
    >
      <header className={styles.top}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Home
        </button>
        <div className={styles.catMeta}>
          <span aria-hidden>{category.icon}</span>
          <div>
            <p className={styles.catEn}>{category.nameEn}</p>
            <p className={styles.catBn}>{category.nameBn}</p>
          </div>
        </div>
        {!loading && words.length > 0 && player.phase !== 'done' ? (
          <p key={player.progress} className={styles.progress} aria-live="polite">
            {player.progress} / {player.total}
          </p>
        ) : (
          <span className={styles.progressSpacer} />
        )}
      </header>

      <main className={styles.main}>
        {loading ? <p className={styles.status}>Loading words…</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        {!loading && !error && player.phase === 'idle' ? (
          <div className={styles.startPanel}>
            <p className={styles.startIcon} aria-hidden>
              {category.icon}
            </p>
            <h1 className={styles.startTitle}>{category.nameEn}</h1>
            <p className={styles.startBn}>{category.nameBn}</p>
            <p className={styles.startHint}>
              Tap Start to hear each word — English, then Bangla.
            </p>
            <button type="button" className={styles.primary} onClick={player.start}>
              Start
            </button>
          </div>
        ) : null}

        {!loading && !error && player.phase === 'done' ? (
          <div className={styles.startPanel}>
            <p className={styles.startIcon} aria-hidden>
              🎉
            </p>
            <h1 className={styles.startTitle}>All done!</h1>
            <p className={styles.startHint}>
              You finished {category.nameEn} — {words.length} words.
            </p>
            <div className={styles.doneActions}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  trackedWordsRef.current = new Set()
                  completedRef.current = false
                  player.restart()
                }}
              >
                Play again
              </button>
              <button type="button" className={styles.secondary} onClick={onBack}>
                More categories
              </button>
            </div>
          </div>
        ) : null}

        {!loading &&
        !error &&
        player.current &&
        (player.phase === 'playing' || player.phase === 'paused') ? (
          <WordCard
            word={player.current}
            categoryIcon={category.icon}
            color={category.color}
            animateKey={player.index}
            showRoman={settings.showRoman}
          />
        ) : null}
      </main>

      {!loading &&
      !error &&
      (player.phase === 'playing' || player.phase === 'paused') ? (
        <nav className={styles.controls} aria-label="Playback controls">
          <button type="button" className={styles.ctrl} onClick={player.prev} disabled={player.index === 0}>
            Prev
          </button>
          {player.phase === 'playing' ? (
            <button type="button" className={styles.ctrlMain} onClick={player.pause}>
              Pause
            </button>
          ) : (
            <button type="button" className={styles.ctrlMain} onClick={player.resume}>
              {settings.autoAdvance ? 'Resume' : 'Next word'}
            </button>
          )}
          <button type="button" className={styles.ctrl} onClick={player.replay}>
            Replay
          </button>
          <button type="button" className={styles.ctrl} onClick={player.next}>
            Next
          </button>
        </nav>
      ) : null}
    </div>
  )
}
