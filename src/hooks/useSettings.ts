import { useCallback, useEffect, useState } from 'react'
import type {
  AppSettings,
  BanglaEngine,
  BanglaRepeat,
  BanglaVoiceId,
  GeminiVoiceId,
  ParentGate,
  SpeechMode,
} from '../types/word'
import { BANGLA_VOICES, DEFAULT_SETTINGS, GEMINI_VOICES } from '../types/word'

export const SETTINGS_STORAGE_KEY = 'baby-bangla-settings'
const GEMINI_TTS_DEFAULT_MIGRATED_KEY = 'baby-bangla-gemini-tts-default-v1'
const GEMINI_EN_BN_ALWAYS_KEY = 'baby-bangla-gemini-en-bn-always-v1'

const VOICE_IDS = new Set(BANGLA_VOICES.map((v) => v.id))
const GEMINI_VOICE_IDS = new Set(GEMINI_VOICES.map((v) => v.id))

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function sanitize(raw: unknown): AppSettings {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppSettings>
  const mode = input.speechMode
  const engine = input.banglaEngine
  const voice = input.banglaVoice
  const geminiVoice = input.geminiVoice
  const repeat = input.banglaRepeat

  const gate = input.parentGate
  const pinRaw = typeof input.parentPin === 'string' ? input.parentPin.replace(/\D/g, '') : ''

  return {
    rate: clamp(Number(input.rate ?? DEFAULT_SETTINGS.rate), 0.6, 1.2),
    volume: clamp(Number(input.volume ?? DEFAULT_SETTINGS.volume), 0, 1),
    advanceDelayMs: clamp(
      Number(input.advanceDelayMs ?? DEFAULT_SETTINGS.advanceDelayMs),
      200,
      3000,
    ),
    enBnGapMs: clamp(Number(input.enBnGapMs ?? DEFAULT_SETTINGS.enBnGapMs), 0, 1500),
    muted: Boolean(input.muted ?? DEFAULT_SETTINGS.muted),
    speechMode:
      mode === 'bn-only' || mode === 'en-only' || mode === 'en-bn'
        ? mode
        : DEFAULT_SETTINGS.speechMode,
    banglaVoice:
      typeof voice === 'string' && VOICE_IDS.has(voice as BanglaVoiceId)
        ? (voice as BanglaVoiceId)
        : DEFAULT_SETTINGS.banglaVoice,
    geminiVoice:
      typeof geminiVoice === 'string' && GEMINI_VOICE_IDS.has(geminiVoice as GeminiVoiceId)
        ? (geminiVoice as GeminiVoiceId)
        : DEFAULT_SETTINGS.geminiVoice,
    banglaEngine:
      engine === 'device' || engine === 'neural' || engine === 'gemini'
        ? engine
        : DEFAULT_SETTINGS.banglaEngine,
    autoAdvance: Boolean(input.autoAdvance ?? DEFAULT_SETTINGS.autoAdvance),
    banglaRepeat:
      repeat === 1 || repeat === 2 ? repeat : DEFAULT_SETTINGS.banglaRepeat,
    shuffle: Boolean(input.shuffle ?? DEFAULT_SETTINGS.shuffle),
    parentGate:
      gate === 'hold' || gate === 'pin' || gate === 'off' ? gate : DEFAULT_SETTINGS.parentGate,
    parentPin: pinRaw.length === 4 ? pinRaw : DEFAULT_SETTINGS.parentPin,
  }
}

function persist(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // quota / private mode — keep in-memory only
  }
}

function migrateToGeminiAlways(settings: AppSettings): AppSettings {
  try {
    if (typeof localStorage === 'undefined') return settings
    if (!localStorage.getItem(GEMINI_TTS_DEFAULT_MIGRATED_KEY)) {
      localStorage.setItem(GEMINI_TTS_DEFAULT_MIGRATED_KEY, '1')
    }
    if (localStorage.getItem(GEMINI_EN_BN_ALWAYS_KEY)) return settings
    localStorage.setItem(GEMINI_EN_BN_ALWAYS_KEY, '1')
    if (settings.banglaEngine === 'device') return settings
    const next: AppSettings = {
      ...settings,
      banglaEngine: 'gemini',
      geminiVoice: settings.geminiVoice,
    }
    persist(next)
    return next
  } catch {
    return settings
  }
}

export function loadSettings(): AppSettings {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return migrateToGeminiAlways(sanitize(JSON.parse(raw)))
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [saveFlash, setSaveFlash] = useState(false)

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SETTINGS_STORAGE_KEY && event.newValue) {
        try {
          setSettings(sanitize(JSON.parse(event.newValue)))
        } catch {
          // ignore bad cross-tab payloads
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = sanitize({ ...prev, ...patch })
      persist(next)
      return next
    })
    setSaveFlash(true)
  }, [])

  useEffect(() => {
    if (!saveFlash) return
    const t = window.setTimeout(() => setSaveFlash(false), 1200)
    return () => window.clearTimeout(t)
  }, [saveFlash, settings])

  const resetSettings = useCallback(() => {
    persist(DEFAULT_SETTINGS)
    setSettings(DEFAULT_SETTINGS)
    setSaveFlash(true)
  }, [])

  const applyPreset = useCallback(
    (patch: Partial<AppSettings>) => update(patch),
    [update],
  )

  const setRate = useCallback((rate: number) => update({ rate }), [update])
  const setVolume = useCallback((volume: number) => update({ volume }), [update])
  const setAdvanceDelayMs = useCallback(
    (advanceDelayMs: number) => update({ advanceDelayMs }),
    [update],
  )
  const setEnBnGapMs = useCallback((enBnGapMs: number) => update({ enBnGapMs }), [update])
  const setMuted = useCallback((muted: boolean) => update({ muted }), [update])
  const setSpeechMode = useCallback(
    (speechMode: SpeechMode) => update({ speechMode }),
    [update],
  )
  const setBanglaVoice = useCallback(
    (banglaVoice: BanglaVoiceId) => update({ banglaVoice }),
    [update],
  )
  const setGeminiVoice = useCallback(
    (geminiVoice: GeminiVoiceId) => update({ geminiVoice }),
    [update],
  )
  const setBanglaEngine = useCallback(
    (banglaEngine: BanglaEngine) => update({ banglaEngine }),
    [update],
  )
  const setAutoAdvance = useCallback(
    (autoAdvance: boolean) => update({ autoAdvance }),
    [update],
  )
  const setBanglaRepeat = useCallback(
    (banglaRepeat: BanglaRepeat) => update({ banglaRepeat }),
    [update],
  )
  const setShuffle = useCallback((shuffle: boolean) => update({ shuffle }), [update])
  const setParentGate = useCallback(
    (parentGate: ParentGate) => update({ parentGate }),
    [update],
  )
  const setParentPin = useCallback((parentPin: string) => update({ parentPin }), [update])

  return {
    settings,
    saveFlash,
    update,
    resetSettings,
    applyPreset,
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
  }
}
