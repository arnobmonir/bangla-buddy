import { useCallback, useEffect, useState } from 'react'
import {
  PROGRESS_STORAGE_KEY,
  clearCategoryResume,
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

  const trackWordHeard = useCallback(
    (categoryId: string, wordId: string, resumeIndex = 0) => {
      setProgress((prev) => recordWordHeard(prev, categoryId, wordId, resumeIndex))
    },
    [],
  )

  const trackCategoryComplete = useCallback((categoryId: string) => {
    setProgress((prev) => recordCategoryComplete(prev, categoryId))
  }, [])

  const clearResume = useCallback((categoryId: string) => {
    setProgress((prev) => clearCategoryResume(prev, categoryId))
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
    clearResume,
    clearProgress,
    refresh,
  }
}
