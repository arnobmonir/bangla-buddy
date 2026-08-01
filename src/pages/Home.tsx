import { useMemo, type CSSProperties } from 'react'
import type { Category, ParentGate } from '../types/word'
import { CategoryTile } from '../components/CategoryTile'
import { ParentGateButton } from '../components/ParentGateButton'
import styles from './Home.module.css'

type Props = {
  categories: Category[]
  parentGate: ParentGate
  parentPin: string
  onSelect: (category: Category) => void
  onOpenDashboard: () => void
}

const FLOATERS = ['🐱', '🍎', '🌟', '🏠', '🎨', '🚌', '🌿', '👟']

export function Home({
  categories,
  parentGate,
  parentPin,
  onSelect,
  onOpenDashboard,
}: Props) {
  const { featured, wordCategories } = useMemo(() => {
    const featuredCat = categories.find((c) => c.id === 'sentences') ?? null
    const rest = categories.filter((c) => c.id !== 'sentences')
    return { featured: featuredCat, wordCategories: rest }
  }, [categories])

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-label="Welcome">
        <div className={styles.topActions}>
          <ParentGateButton
            className={styles.dashboardBtn}
            label="Parents"
            ariaLabel="Open parent dashboard"
            mode={parentGate}
            pin={parentPin}
            onUnlock={onOpenDashboard}
          />
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

        {featured ? (
          <div className={styles.featuredWrap}>
            <CategoryTile
              category={featured}
              index={0}
              featured
              onSelect={onSelect}
            />
          </div>
        ) : null}

        <div className={styles.grid}>
          {wordCategories.map((category, index) => (
            <CategoryTile
              key={category.id}
              category={category}
              index={index + (featured ? 1 : 0)}
              onSelect={onSelect}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
