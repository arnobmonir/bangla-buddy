import type { CSSProperties } from 'react'
import type { Category } from '../types/word'
import styles from './CategoryTile.module.css'

type Props = {
  category: Category
  index?: number
  onSelect: (category: Category) => void
}

export function CategoryTile({ category, index = 0, onSelect }: Props) {
  return (
    <button
      type="button"
      className={styles.tile}
      style={
        {
          '--cat-color': category.color,
          '--stagger': `${Math.min(index, 12) * 45}ms`,
        } as CSSProperties
      }
      onClick={() => onSelect(category)}
      aria-label={`${category.nameEn}, ${category.nameBn}, ${category.wordCount} words`}
    >
      <span className={styles.icon} aria-hidden>
        {category.icon}
      </span>
      <span className={styles.copy}>
        <span className={styles.names}>
          <span className={styles.en}>{category.nameEn}</span>
          <span className={styles.bn}>{category.nameBn}</span>
        </span>
        <span className={styles.count}>{category.wordCount} words</span>
      </span>
    </button>
  )
}
