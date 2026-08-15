import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Category } from './types/word'
import { getCategories, prefetchCategories } from './data/loader'
import { useSettings } from './hooks/useSettings'
import { useProgress } from './hooks/useProgress'
import { DebugPanel } from './components/DebugPanel'
import { Home } from './pages/Home'
import { Player } from './pages/Player'
import { Settings } from './pages/Settings'
import { QuizPick } from './pages/QuizPick'
import { Quiz } from './pages/Quiz'
import './styles/tokens.css'
import './styles/app.css'

type Screen =
  | { name: 'home' }
  | { name: 'player'; category: Category }
  | { name: 'settings' }
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
  // Parent dashboard hidden for now — /parents falls back to home.
  if (path === PARENTS_PATH) return { name: 'home' }
  if (path === SETTINGS_PATH) return { name: 'settings' }
  return { name: 'home' }
}

function pathForScreen(screen: Screen): string | null {
  if (screen.name === 'settings') return SETTINGS_PATH
  if (screen.name === 'home') return '/'
  return null
}

export default function App() {
  const categories = useMemo(() => getCategories(), [])
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
  } = useProgress()
  const [screen, setScreen] = useState<Screen>(() =>
    typeof window === 'undefined' ? { name: 'home' } : screenFromPath(window.location.pathname),
  )
  const [debugOpen, setDebugOpen] = useState(false)

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return
      if (event.key.toLowerCase() !== 'd') return
      event.preventDefault()
      setDebugOpen((open) => !open)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      prefetchCategories(categories)
    }, 500)
    return () => window.clearTimeout(handle)
  }, [categories])

  let content: ReactNode = null

  if (screen.name === 'settings') {
    content = (
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
        onOpenDebug={() => setDebugOpen(true)}
        onBack={() => goTo({ name: 'home' })}
      />
    )
  } else if (screen.name === 'quiz-pick') {
    content = (
      <QuizPick
        categories={categories}
        onSelect={(category) => setScreen({ name: 'quiz', category })}
        onBack={() => goTo({ name: 'home' })}
      />
    )
  } else if (screen.name === 'quiz') {
    content = (
      <Quiz
        category={screen.category}
        settings={settings}
        onBackToPick={() => setScreen({ name: 'quiz-pick' })}
        onHome={() => goTo({ name: 'home' })}
        onQuizComplete={trackQuizResult}
      />
    )
  } else if (screen.name === 'player') {
    const catProgress = progress.categories[screen.category.id]
    content = (
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
  } else {
    content = (
      <Home
        categories={categories}
        onSelect={(category) => setScreen({ name: 'player', category })}
        onOpenQuiz={() => setScreen({ name: 'quiz-pick' })}
      />
    )
  }

  return (
    <>
      {content}
      <DebugPanel
        open={debugOpen}
        onClose={() => setDebugOpen(false)}
        settings={settings}
        screenName={screen.name}
      />
    </>
  )
}
