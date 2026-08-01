export type CategoryProgress = {
  started: number
  completed: number
  wordsHeard: number
  lastPlayedAt: number
  /** Word id to resume from next visit; null when none / finished */
  resumeWordId: string | null
  /** 0-based playlist index hint from last session */
  resumeIndex: number
}

export type ProgressStore = {
  wordsHeard: Record<string, number>
  categories: Record<string, CategoryProgress>
  sessions: number
  totalWordPlays: number
  uniqueWords: number
  lastSessionAt: number | null
  streakDays: number
  lastActiveDay: string | null
}

export const PROGRESS_STORAGE_KEY = 'baby-bangla-progress'

export const EMPTY_PROGRESS: ProgressStore = {
  wordsHeard: {},
  categories: {},
  sessions: 0,
  totalWordPlays: 0,
  uniqueWords: 0,
  lastSessionAt: null,
  streakDays: 0,
  lastActiveDay: null,
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function yesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return todayKey(d)
}

function defaultCategoryProgress(now = Date.now()): CategoryProgress {
  return {
    started: 0,
    completed: 0,
    wordsHeard: 0,
    lastPlayedAt: now,
    resumeWordId: null,
    resumeIndex: 0,
  }
}

function sanitizeCategory(raw: unknown): CategoryProgress {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<CategoryProgress>
  return {
    started: Number(input.started ?? 0) || 0,
    completed: Number(input.completed ?? 0) || 0,
    wordsHeard: Number(input.wordsHeard ?? 0) || 0,
    lastPlayedAt: Number(input.lastPlayedAt ?? 0) || 0,
    resumeWordId:
      typeof input.resumeWordId === 'string' && input.resumeWordId
        ? input.resumeWordId
        : null,
    resumeIndex: Math.max(0, Number(input.resumeIndex ?? 0) || 0),
  }
}

function sanitize(raw: unknown): ProgressStore {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<ProgressStore>
  const categoriesIn =
    input.categories && typeof input.categories === 'object' ? input.categories : {}
  const categories: Record<string, CategoryProgress> = {}
  for (const [id, value] of Object.entries(categoriesIn)) {
    categories[id] = sanitizeCategory(value)
  }
  return {
    wordsHeard:
      input.wordsHeard && typeof input.wordsHeard === 'object' ? input.wordsHeard : {},
    categories,
    sessions: Number(input.sessions ?? 0) || 0,
    totalWordPlays: Number(input.totalWordPlays ?? 0) || 0,
    uniqueWords: Number(input.uniqueWords ?? 0) || 0,
    lastSessionAt: input.lastSessionAt ?? null,
    streakDays: Number(input.streakDays ?? 0) || 0,
    lastActiveDay: input.lastActiveDay ?? null,
  }
}

export function loadProgress(): ProgressStore {
  try {
    if (typeof localStorage === 'undefined') return EMPTY_PROGRESS
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (!raw) return EMPTY_PROGRESS
    return sanitize(JSON.parse(raw))
  } catch {
    return EMPTY_PROGRESS
  }
}

function persist(store: ProgressStore) {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore quota errors
  }
}

function touchStreak(store: ProgressStore): ProgressStore {
  const today = todayKey()
  if (store.lastActiveDay === today) return store
  if (store.lastActiveDay === yesterdayKey()) {
    return {
      ...store,
      streakDays: Math.max(1, store.streakDays) + 1,
      lastActiveDay: today,
    }
  }
  return { ...store, streakDays: 1, lastActiveDay: today }
}

export function recordSessionStart(
  store: ProgressStore,
  categoryId: string,
): ProgressStore {
  const now = Date.now()
  const prev = store.categories[categoryId] ?? defaultCategoryProgress(now)
  const next: ProgressStore = touchStreak({
    ...store,
    sessions: store.sessions + 1,
    lastSessionAt: now,
    categories: {
      ...store.categories,
      [categoryId]: {
        ...prev,
        started: prev.started + 1,
        lastPlayedAt: now,
      },
    },
  })
  persist(next)
  return next
}

export function recordWordHeard(
  store: ProgressStore,
  categoryId: string,
  wordId: string,
  resumeIndex = 0,
): ProgressStore {
  const prevCount = store.wordsHeard[wordId] ?? 0
  const isNew = prevCount === 0
  const cat = store.categories[categoryId] ?? defaultCategoryProgress()
  const next: ProgressStore = touchStreak({
    ...store,
    wordsHeard: { ...store.wordsHeard, [wordId]: prevCount + 1 },
    totalWordPlays: store.totalWordPlays + 1,
    uniqueWords: store.uniqueWords + (isNew ? 1 : 0),
    categories: {
      ...store.categories,
      [categoryId]: {
        ...cat,
        wordsHeard: cat.wordsHeard + 1,
        lastPlayedAt: Date.now(),
        resumeWordId: wordId,
        resumeIndex: Math.max(0, resumeIndex),
      },
    },
  })
  persist(next)
  return next
}

export function saveCategoryResume(
  store: ProgressStore,
  categoryId: string,
  wordId: string | null,
  resumeIndex = 0,
): ProgressStore {
  const cat = store.categories[categoryId] ?? defaultCategoryProgress()
  const next: ProgressStore = {
    ...store,
    categories: {
      ...store.categories,
      [categoryId]: {
        ...cat,
        resumeWordId: wordId,
        resumeIndex: Math.max(0, resumeIndex),
        lastPlayedAt: Date.now(),
      },
    },
  }
  persist(next)
  return next
}

export function recordCategoryComplete(
  store: ProgressStore,
  categoryId: string,
): ProgressStore {
  const cat = store.categories[categoryId] ?? defaultCategoryProgress()
  const next: ProgressStore = touchStreak({
    ...store,
    categories: {
      ...store.categories,
      [categoryId]: {
        ...cat,
        completed: cat.completed + 1,
        lastPlayedAt: Date.now(),
        resumeWordId: null,
        resumeIndex: 0,
      },
    },
  })
  persist(next)
  return next
}

export function clearCategoryResume(
  store: ProgressStore,
  categoryId: string,
): ProgressStore {
  return saveCategoryResume(store, categoryId, null, 0)
}

export function resetProgress(): ProgressStore {
  persist(EMPTY_PROGRESS)
  return EMPTY_PROGRESS
}

export function formatRelativeTime(ts: number | null): string {
  if (!ts) return 'Not yet'
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}
