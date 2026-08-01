import { useCallback, useEffect, useState } from 'react'
import {
  PROGRESS_STORAGE_KEY,
  loadProgress,
  recordCategoryComplete,
  recordSessionStart,
  recordWordHeard,
  resetProgress,
  type ProgressStore,
} from '../lib/progress'

export function useProgress() {
  const [progress, setProgress] = useState<ProgressStore>(() => loadProgress())

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PROGRESS_STORAGE_KEY && event.newValue) {
        try {
          setProgress(loadProgress())
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const trackSessionStart = useCallback((categoryId: string) => {
    setProgress((prev) => recordSessionStart(prev, categoryId))
  }, [])

  const trackWordHeard = useCallback((categoryId: string, wordId: string) => {
    setProgress((prev) => recordWordHeard(prev, categoryId, wordId))
  }, [])

  const trackCategoryComplete = useCallback((categoryId: string) => {
    setProgress((prev) => recordCategoryComplete(prev, categoryId))
  }, [])

  const clearProgress = useCallback(() => {
    setProgress(resetProgress())
  }, [])

  const refresh = useCallback(() => {
    setProgress(loadProgress())
  }, [])

  return {
    progress,
    trackSessionStart,
    trackWordHeard,
    trackCategoryComplete,
    clearProgress,
    refresh,
  }
}
