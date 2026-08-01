export type Word = {
  id: string
  en: string
  bn: string
  emoji?: string
  roman?: string
  kind?: 'word' | 'sentence'
}

export type Category = {
  id: string
  nameEn: string
  nameBn: string
  color: string
  icon: string
  wordCount: number
  file: string
}

export type CategoryWords = {
  categoryId: string
  words: Word[]
}

export type SpeechMode = 'en-bn' | 'bn-only' | 'en-only'

export type BanglaVoiceId =
  | 'bn-IN-TanishaaNeural'
  | 'bn-IN-BashkarNeural'
  | 'bn-BD-NabanitaNeural'
  | 'bn-BD-PradeepNeural'

export type BanglaEngine = 'neural' | 'device'

export type BanglaRepeat = 1 | 2

export type ParentGate = 'hold' | 'pin' | 'off'

export type AppSettings = {
  rate: number
  volume: number
  advanceDelayMs: number
  enBnGapMs: number
  muted: boolean
  speechMode: SpeechMode
  banglaVoice: BanglaVoiceId
  banglaEngine: BanglaEngine
  autoAdvance: boolean
  banglaRepeat: BanglaRepeat
  showRoman: boolean
  shuffle: boolean
  parentGate: ParentGate
  parentPin: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  rate: 0.85,
  volume: 1,
  advanceDelayMs: 900,
  enBnGapMs: 280,
  muted: false,
  speechMode: 'en-bn',
  banglaVoice: 'bn-IN-TanishaaNeural',
  banglaEngine: 'neural',
  autoAdvance: true,
  banglaRepeat: 1,
  showRoman: true,
  shuffle: false,
  parentGate: 'hold',
  parentPin: '1234',
}

export const BANGLA_VOICES: { id: BanglaVoiceId; label: string }[] = [
  { id: 'bn-IN-TanishaaNeural', label: 'Tanishaa (soft, India)' },
  { id: 'bn-IN-BashkarNeural', label: 'Bashkar (clear, India)' },
  { id: 'bn-BD-NabanitaNeural', label: 'Nabanita (Bangladesh)' },
  { id: 'bn-BD-PradeepNeural', label: 'Pradeep (Bangladesh)' },
]

export const SETTINGS_PRESETS: {
  id: string
  label: string
  patch: Partial<AppSettings>
}[] = [
  {
    id: 'slow',
    label: 'Slow (baby)',
    patch: { rate: 0.7, advanceDelayMs: 1400, enBnGapMs: 450, banglaRepeat: 2 },
  },
  {
    id: 'normal',
    label: 'Normal',
    patch: { rate: 0.85, advanceDelayMs: 900, enBnGapMs: 280, banglaRepeat: 1 },
  },
  {
    id: 'fast',
    label: 'Faster',
    patch: { rate: 1.05, advanceDelayMs: 500, enBnGapMs: 180, banglaRepeat: 1 },
  },
]
