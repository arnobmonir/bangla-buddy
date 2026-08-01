import type { CSSProperties } from 'react'
import type { Category } from '../types/word'
import styles from './CategoryTile.module.css'

type Props = {
  category: Category
  index?: number
  featured?: boolean
  onSelect: (category: Category) => void
}

export function CategoryTile({
  category,
  index = 0,
  featured = false,
  onSelect,
}: Props) {
  const unit = category.id === 'sentences' ? 'phrases' : 'words'

  return (
    <button
      type="button"
      className={`${styles.tile}${featured ? ` ${styles.featured}` : ''}`}
      style={
        {
          '--cat-color': category.color,
          '--stagger': `${Math.min(index, 12) * 45}ms`,
        } as CSSProperties
      }
      onClick={() => onSelect(category)}
      aria-label={`${category.nameEn}, ${category.nameBn}, ${category.wordCount} ${unit}`}
    >
      <span className={styles.icon} aria-hidden>
        {category.icon}
      </span>
      <span className={styles.copy}>
        <span className={styles.names}>
          <span className={styles.en}>{category.nameEn}</span>
          <span className={styles.bn}>{category.nameBn}</span>
        </span>
        {featured ? (
          <span className={styles.blurb}>
            Short everyday lines kids can say — English, then Bangla.
          </span>
        ) : null}
        <span className={styles.count}>
          {category.wordCount} {unit}
        </span>
      </span>
    </button>
  )
}
