import type { CSSProperties } from 'react'
import type { Word } from '../types/word'
import styles from './WordCard.module.css'

type Props = {
  word: Word
  categoryIcon: string
  color: string
  animateKey: number
}

export function WordCard({ word, categoryIcon, color, animateKey }: Props) {
  const hasExample = Boolean(word.exampleEn?.trim() && word.exampleBn?.trim())

  return (
    <article
      key={animateKey}
      className={styles.card}
      style={{ '--cat-color': color } as CSSProperties}
      aria-live="polite"
    >
      <div className={styles.emoji} aria-hidden>
        {word.emoji ?? categoryIcon}
      </div>
      <h1 className={styles.en}>{word.en}</h1>
      <p className={styles.bn}>{word.bn}</p>
      {hasExample ? (
        <div className={styles.example}>
          <p className={styles.exampleEn}>{word.exampleEn}</p>
          <p className={styles.exampleBn}>{word.exampleBn}</p>
        </div>
      ) : null}
    </article>
  )
}
