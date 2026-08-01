import type { CSSProperties } from 'react'
import type { AppSettings, Category } from '../types/word'
import { BANGLA_VOICES } from '../types/word'
import {
  formatRelativeTime,
  type ProgressStore,
} from '../lib/progress'
import styles from './ParentDashboard.module.css'

type Props = {
  categories: Category[]
  settings: AppSettings
  progress: ProgressStore
  totalWordCatalog: number
  onBack: () => void
  onOpenSettings: () => void
  onPlayCategory: (category: Category) => void
  onClearProgress: () => void
}

export function ParentDashboard({
  categories,
  settings,
  progress,
  totalWordCatalog,
  onBack,
  onOpenSettings,
  onPlayCategory,
  onClearProgress,
}: Props) {
  const completedCategories = categories.filter(
    (c) => (progress.categories[c.id]?.completed ?? 0) > 0,
  ).length

  const coverage = totalWordCatalog
    ? Math.min(100, Math.round((progress.uniqueWords / totalWordCatalog) * 100))
    : 0

  const recent = [...categories]
    .map((category) => ({
      category,
      lastPlayedAt: progress.categories[category.id]?.lastPlayedAt ?? 0,
      stats: progress.categories[category.id],
    }))
    .filter((row) => row.lastPlayedAt > 0)
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
    .slice(0, 4)

  const voiceLabel =
    BANGLA_VOICES.find((v) => v.id === settings.banglaVoice)?.label.split(' (')[0] ??
    'Neural'

  const modeLabel =
    settings.speechMode === 'en-bn'
      ? 'English → Bangla'
      : settings.speechMode === 'bn-only'
        ? 'Bangla only'
        : 'English only'

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden />
        <button type="button" className={styles.back} onClick={onBack}>
          ← Home
        </button>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>For parents</p>
          <h1 className={styles.title}>Parent Dashboard</h1>
          <p className={styles.subtitle}>অভিভাবক ড্যাশবোর্ড</p>
          <p className={styles.lead}>
            Track what your baby has heard, jump back into a category, and tweak
            learning settings.
          </p>
        </div>
      </header>

      <section className={styles.stats} aria-label="Learning summary">
        <article className={styles.statCard}>
          <p className={styles.statValue}>{progress.uniqueWords}</p>
          <p className={styles.statLabel}>Unique words</p>
          <p className={styles.statHint}>of {totalWordCatalog} in the app</p>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statValue}>{progress.totalWordPlays}</p>
          <p className={styles.statLabel}>Times heard</p>
          <p className={styles.statHint}>{progress.sessions} play sessions</p>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statValue}>{completedCategories}</p>
          <p className={styles.statLabel}>Categories done</p>
          <p className={styles.statHint}>of {categories.length} total</p>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statValue}>{progress.streakDays}</p>
          <p className={styles.statLabel}>Day streak</p>
          <p className={styles.statHint}>
            {formatRelativeTime(progress.lastSessionAt)}
          </p>
        </article>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden>
            📈
          </span>
          <div>
            <h2 className={styles.sectionTitle}>Word coverage</h2>
            <p className={styles.sectionHint}>
              How many different words your baby has heard at least once
            </p>
          </div>
        </div>
        <div className={styles.coverageRow}>
          <div className={styles.coverageTrack} aria-hidden>
            <div className={styles.coverageFill} style={{ width: `${coverage}%` }} />
          </div>
          <p className={styles.coverageValue}>{coverage}%</p>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden>
            🗂️
          </span>
          <div>
            <h2 className={styles.sectionTitle}>Category progress</h2>
            <p className={styles.sectionHint}>Completions and practice per topic</p>
          </div>
        </div>
        <ul className={styles.catList}>
          {categories.map((category) => {
            const stats = progress.categories[category.id]
            const softPct =
              stats && stats.completed > 0
                ? 100
                : Math.min(
                    100,
                    Math.round(
                      ((stats?.wordsHeard ?? 0) / Math.max(category.wordCount, 1)) * 100,
                    ),
                  )

            return (
              <li key={category.id} className={styles.catRow}>
                <button
                  type="button"
                  className={styles.catBtn}
                  style={{ '--cat-color': category.color } as CSSProperties}
                  onClick={() => onPlayCategory(category)}
                >
                  <span className={styles.catIcon} aria-hidden>
                    {category.icon}
                  </span>
                  <span className={styles.catCopy}>
                    <span className={styles.catName}>{category.nameEn}</span>
                    <span className={styles.catMeta}>
                      {stats?.completed
                        ? `${stats.completed}× finished`
                        : stats
                          ? 'In progress'
                          : 'Not started'}
                      {' · '}
                      {category.wordCount} words
                    </span>
                    <span className={styles.catBar} aria-hidden>
                      <span
                        className={styles.catFill}
                        style={{ width: `${softPct}%` }}
                      />
                    </span>
                  </span>
                  <span className={styles.catAction}>Play</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {recent.length > 0 ? (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardIcon} aria-hidden>
              ⏱️
            </span>
            <div>
              <h2 className={styles.sectionTitle}>Continue recently</h2>
              <p className={styles.sectionHint}>Jump back into what you played last</p>
            </div>
          </div>
          <div className={styles.recentGrid}>
            {recent.map(({ category, lastPlayedAt, stats }) => (
              <button
                key={category.id}
                type="button"
                className={styles.recentCard}
                style={{ '--cat-color': category.color } as CSSProperties}
                onClick={() => onPlayCategory(category)}
              >
                <span className={styles.recentIcon} aria-hidden>
                  {category.icon}
                </span>
                <span className={styles.recentName}>{category.nameEn}</span>
                <span className={styles.recentMeta}>
                  {formatRelativeTime(lastPlayedAt)}
                  {stats?.completed ? ` · ${stats.completed}× done` : ''}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden>
            ⚙️
          </span>
          <div>
            <h2 className={styles.sectionTitle}>Current setup</h2>
            <p className={styles.sectionHint}>Saved on this device with your preferences</p>
          </div>
        </div>
        <dl className={styles.setupGrid}>
          <div>
            <dt>Mode</dt>
            <dd>{modeLabel}</dd>
          </div>
          <div>
            <dt>Bangla voice</dt>
            <dd>
              {settings.banglaEngine === 'neural' ? voiceLabel : 'Device voice'}
            </dd>
          </div>
          <div>
            <dt>Speed</dt>
            <dd>{settings.rate.toFixed(2)}×</dd>
          </div>
          <div>
            <dt>Volume</dt>
            <dd>{Math.round(settings.volume * 100)}%</dd>
          </div>
        </dl>
        <button type="button" className={styles.primaryBtn} onClick={onOpenSettings}>
          Open settings
        </button>
        <p className={styles.sectionHint}>
          Speech, baby lock, voices, and more — only available here for parents.
        </p>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden>
            💡
          </span>
          <div>
            <h2 className={styles.sectionTitle}>Parent tips</h2>
            <p className={styles.sectionHint}>Small habits that help babies learn</p>
          </div>
        </div>
        <ul className={styles.tips}>
          <li>Keep sessions short — 3 to 5 minutes is plenty.</li>
          <li>Point to the emoji while the word is spoken.</li>
          <li>Repeat the Bangla word yourself after the app.</li>
          <li>Use Slow preset at first, then Normal as they grow.</li>
        </ul>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden>
            🧹
          </span>
          <div>
            <h2 className={styles.sectionTitle}>Reset progress</h2>
            <p className={styles.sectionHint}>
              Clears hearing history and streaks on this browser only. Settings are kept.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={() => {
            if (window.confirm('Clear all learning progress on this device?')) {
              onClearProgress()
            }
          }}
        >
          Clear progress
        </button>
      </section>
    </div>
  )
}
