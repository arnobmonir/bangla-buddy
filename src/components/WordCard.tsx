import type { CSSProperties } from 'react'
import type { Word } from '../types/word'
import styles from './WordCard.module.css'

type Props = {
  word: Word
  categoryIcon: string
  color: string
  animateKey: number
  showRoman: boolean
}

export function WordCard({ word, categoryIcon, color, animateKey, showRoman }: Props) {
  const isSentence = word.kind === 'sentence'

  return (
    <article
      key={animateKey}
      className={`${styles.card}${isSentence ? ` ${styles.sentence}` : ''}`}
      style={{ '--cat-color': color } as CSSProperties}
      aria-live="polite"
    >
      <div className={styles.emoji} aria-hidden>
        {word.emoji ?? categoryIcon}
      </div>
      <h1 className={styles.en}>{word.en}</h1>
      <p className={styles.bn}>{word.bn}</p>
      {showRoman && word.roman ? <p className={styles.roman}>{word.roman}</p> : null}
    </article>
  )
}
