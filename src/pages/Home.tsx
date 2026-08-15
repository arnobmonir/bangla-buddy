import type { CSSProperties } from 'react'
import type { Category } from '../types/word'
import { CategoryTile } from '../components/CategoryTile'
import styles from './Home.module.css'

type Props = {
  categories: Category[]
  onSelect: (category: Category) => void
  onOpenQuiz: () => void
}

const FLOATERS = ['🐱', '🍎', '🌟', '🏠', '🎨', '🚌', '🌿', '👟']

export function Home({ categories, onSelect, onOpenQuiz }: Props) {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-label="Welcome">
        <div className={styles.topLeft}>
          <button
            type="button"
            className={styles.quizBtn}
            onClick={onOpenQuiz}
            aria-label="Open quiz"
          >
            <span aria-hidden>🎯</span>
            Quiz
          </button>
        </div>

        <div className={styles.heroGlow} aria-hidden />

        <div className={styles.floaters} aria-hidden>
          {FLOATERS.map((emoji, i) => (
            <span
              key={emoji}
              className={styles.floater}
              style={{ '--i': i } as CSSProperties}
            >
              {emoji}
            </span>
          ))}
        </div>

        <div className={styles.heroCopy}>
          <p className={styles.brand}>Bangla Buddy</p>
          <p className={styles.brandBn}>বাংলা বন্ধু</p>
          <h1 className={styles.title}>Little words. Big smiles.</h1>
          <p className={styles.sub}>
            Tap a category and hear English, then Bangla — one word at a time.
          </p>

          <div className={styles.sample} aria-hidden>
            <span className={styles.sampleEn}>cat</span>
            <span className={styles.sampleArrow}>→</span>
            <span className={styles.sampleBn}>বিড়াল</span>
          </div>
        </div>
      </section>

      <section className={styles.categories} aria-label="Word categories">
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
