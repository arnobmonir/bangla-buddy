import type { Category } from '../types/word'
import { CategoryTile } from '../components/CategoryTile'
import styles from './QuizPick.module.css'

type Props = {
  categories: Category[]
  onSelect: (category: Category) => void
  onBack: () => void
}

export function QuizPick({ categories, onSelect, onBack }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Home
        </button>
        <div className={styles.copy}>
          <p className={styles.kicker}>Practice</p>
          <h1 className={styles.title}>Quiz</h1>
          <p className={styles.subtitle}>কুইজ</p>
          <p className={styles.lead}>
            Pick a category. Hear the English word, then tap the matching Bangla.
          </p>
        </div>
      </header>

      <section className={styles.categories} aria-label="Quiz categories">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Choose a category</h2>
          <p className={styles.sectionSub}>ক্যাটাগরি বেছে নিন</p>
        </div>
        <div className={styles.grid}>
          {categories.map((category, index) => (
            <CategoryTile
              key={category.id}
              category={category}
              index={index}
              onSelect={onSelect}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
