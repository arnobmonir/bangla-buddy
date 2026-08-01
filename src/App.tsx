import { useEffect, useMemo, useState } from 'react'
import type { Category } from './types/word'
import { getCategories, prefetchCategories } from './data/loader'
import { useSettings } from './hooks/useSettings'
import { useProgress } from './hooks/useProgress'
import { Home } from './pages/Home'
import { Player } from './pages/Player'
import { Settings } from './pages/Settings'
import { ParentDashboard } from './pages/ParentDashboard'
import './styles/tokens.css'
import './styles/app.css'

type Screen =
  | { name: 'home' }
  | { name: 'player'; category: Category }
  | { name: 'settings' }
  | { name: 'dashboard' }

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
    setBanglaEngine,
    setAutoAdvance,
    setBanglaRepeat,
    setShowRoman,
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
    clearResume,
    clearProgress,
    refresh,
  } = useProgress()
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  useEffect(() => {
    const handle = window.setTimeout(() => {
      prefetchCategories(categories)
    }, 500)
    return () => window.clearTimeout(handle)
  }, [categories])

  useEffect(() => {
    if (screen.name === 'dashboard') refresh()
  }, [screen.name, refresh])

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
        onBanglaEngine={setBanglaEngine}
        onAutoAdvance={setAutoAdvance}
        onBanglaRepeat={setBanglaRepeat}
        onShowRoman={setShowRoman}
        onShuffle={setShuffle}
        onParentGate={setParentGate}
        onParentPin={setParentPin}
        onApplyPreset={applyPreset}
        onReset={resetSettings}
        onBack={() => setScreen({ name: 'dashboard' })}
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
        onBack={() => setScreen({ name: 'home' })}
        onOpenSettings={() => setScreen({ name: 'settings' })}
        onPlayCategory={(category) => setScreen({ name: 'player', category })}
        onClearProgress={clearProgress}
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
        onBack={() => setScreen({ name: 'home' })}
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
      onOpenDashboard={() => setScreen({ name: 'dashboard' })}
    />
  )
}
