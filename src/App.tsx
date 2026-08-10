import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category } from './types/word'
import { getCategories, prefetchCategories } from './data/loader'
import { useSettings } from './hooks/useSettings'
import { useProgress } from './hooks/useProgress'
import { Home } from './pages/Home'
import { Player } from './pages/Player'
import { Settings } from './pages/Settings'
import { ParentDashboard } from './pages/ParentDashboard'
import { QuizPick } from './pages/QuizPick'
import { Quiz } from './pages/Quiz'
import './styles/tokens.css'
import './styles/app.css'

type Screen =
  | { name: 'home' }
  | { name: 'player'; category: Category }
  | { name: 'settings' }
  | { name: 'dashboard' }
  | { name: 'quiz-pick' }
  | { name: 'quiz'; category: Category }

const PARENTS_PATH = '/parents'
const SETTINGS_PATH = '/settings'

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname || '/'
}

function screenFromPath(pathname: string): Screen {
  const path = normalizePath(pathname)
  if (path === PARENTS_PATH) return { name: 'dashboard' }
  if (path === SETTINGS_PATH) return { name: 'settings' }
  return { name: 'home' }
}

function pathForScreen(screen: Screen): string | null {
  if (screen.name === 'dashboard') return PARENTS_PATH
  if (screen.name === 'settings') return SETTINGS_PATH
  if (screen.name === 'home') return '/'
  return null
}

export default function App() {
  const categories = useMemo(() => getCategories(), [])
  const totalWordCatalog = useMemo(
    () => categories.reduce((sum, c) => sum + c.wordCount, 0),
    [categories],
  )
  const {
    settings,
    saveFlash,
    setRate,
    setVolume,
    setAdvanceDelayMs,
    setEnBnGapMs,
    setMuted,
    setSpeechMode,
    setBanglaVoice,
    setGeminiVoice,
    setBanglaEngine,
    setAutoAdvance,
    setBanglaRepeat,
    setShuffle,
    setParentGate,
    setParentPin,
    applyPreset,
    resetSettings,
  } = useSettings()
  const {
    progress,
    trackSessionStart,
    trackWordHeard,
    trackCategoryComplete,
    trackQuizResult,
    clearResume,
    clearProgress,
    refresh,
  } = useProgress()
  const [screen, setScreen] = useState<Screen>(() =>
    typeof window === 'undefined' ? { name: 'home' } : screenFromPath(window.location.pathname),
  )

  const goTo = useCallback((next: Screen, mode: 'push' | 'replace' = 'push') => {
    setScreen(next)
    const path = pathForScreen(next)
    if (!path) return
    const current = normalizePath(window.location.pathname)
    if (current === path) return
    if (mode === 'replace') {
      window.history.replaceState(null, '', path)
    } else {
      window.history.pushState(null, '', path)
    }
  }, [])

  useEffect(() => {
    const onPopState = () => {
      setScreen(screenFromPath(window.location.pathname))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      prefetchCategories(categories)
    }, 500)
    return () => window.clearTimeout(handle)
  }, [categories])

  useEffect(() => {
    if (screen.name === 'dashboard') refresh()
  }, [screen.name, refresh])

  const openDashboardInNewTab = useCallback(() => {
    const url = new URL(PARENTS_PATH, window.location.origin)
    const opened = window.open(url.href, '_blank', 'noopener,noreferrer')
    if (!opened) {
      // Popup blocked — fall back to same-tab navigation.
      goTo({ name: 'dashboard' })
    }
  }, [goTo])

  if (screen.name === 'settings') {
    return (
      <Settings
        settings={settings}
        saveFlash={saveFlash}
        onRate={setRate}
        onVolume={setVolume}
        onDelay={setAdvanceDelayMs}
        onEnBnGap={setEnBnGapMs}
        onMuted={setMuted}
        onMode={setSpeechMode}
        onBanglaVoice={setBanglaVoice}
        onGeminiVoice={setGeminiVoice}
        onBanglaEngine={setBanglaEngine}
        onAutoAdvance={setAutoAdvance}
        onBanglaRepeat={setBanglaRepeat}
        onShuffle={setShuffle}
        onParentGate={setParentGate}
        onParentPin={setParentPin}
        onApplyPreset={applyPreset}
        onReset={resetSettings}
        onBack={() => goTo({ name: 'dashboard' })}
      />
    )
  }

  if (screen.name === 'dashboard') {
    return (
      <ParentDashboard
        categories={categories}
        settings={settings}
        progress={progress}
        totalWordCatalog={totalWordCatalog}
        onBack={() => goTo({ name: 'home' })}
        onOpenSettings={() => goTo({ name: 'settings' })}
        onOpenQuiz={() => setScreen({ name: 'quiz-pick' })}
        onPlayCategory={(category) => setScreen({ name: 'player', category })}
        onClearProgress={clearProgress}
      />
    )
  }

  if (screen.name === 'quiz-pick') {
    return (
      <QuizPick
        categories={categories}
        onSelect={(category) => setScreen({ name: 'quiz', category })}
        onBack={() => goTo({ name: 'home' })}
      />
    )
  }

  if (screen.name === 'quiz') {
    return (
      <Quiz
        category={screen.category}
        settings={settings}
        onBackToPick={() => setScreen({ name: 'quiz-pick' })}
        onHome={() => goTo({ name: 'home' })}
        onQuizComplete={trackQuizResult}
      />
    )
  }

  if (screen.name === 'player') {
    const catProgress = progress.categories[screen.category.id]
    return (
      <Player
        category={screen.category}
        settings={settings}
        resumeWordId={catProgress?.resumeWordId ?? null}
        resumeIndex={catProgress?.resumeIndex ?? 0}
        onBack={() => goTo({ name: 'home' })}
        onSessionStart={trackSessionStart}
        onWordHeard={trackWordHeard}
        onCategoryComplete={trackCategoryComplete}
        onClearResume={clearResume}
      />
    )
  }

  return (
    <Home
      categories={categories}
      parentGate={settings.parentGate}
      parentPin={settings.parentPin}
      onSelect={(category) => setScreen({ name: 'player', category })}
      onOpenQuiz={() => setScreen({ name: 'quiz-pick' })}
      onOpenDashboard={openDashboardInNewTab}
    />
  )
}
