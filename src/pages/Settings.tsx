import { useEffect, useState, type CSSProperties, type InputHTMLAttributes } from 'react'
import type {
  AppSettings,
  BanglaEngine,
  BanglaRepeat,
  BanglaVoiceId,
  ParentGate,
  SpeechMode,
} from '../types/word'
import { BANGLA_VOICES, SETTINGS_PRESETS } from '../types/word'
import {
  clearAudioCache,
  formatBytes,
  getAudioCacheStats,
} from '../lib/audioCache'
import { useSpeech } from '../hooks/useSpeech'
import styles from './Settings.module.css'

type Props = {
  settings: AppSettings
  saveFlash: boolean
  onRate: (rate: number) => void
  onVolume: (volume: number) => void
  onDelay: (ms: number) => void
  onEnBnGap: (ms: number) => void
  onMuted: (muted: boolean) => void
  onMode: (mode: SpeechMode) => void
  onBanglaVoice: (voice: BanglaVoiceId) => void
  onBanglaEngine: (engine: BanglaEngine) => void
  onAutoAdvance: (value: boolean) => void
  onBanglaRepeat: (value: BanglaRepeat) => void
  onShuffle: (value: boolean) => void
  onParentGate: (value: ParentGate) => void
  onParentPin: (value: string) => void
  onApplyPreset: (patch: Partial<AppSettings>) => void
  onReset: () => void
  onBack: () => void
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className={styles.switchRow}>
      <span className={styles.switchCopy}>
        <span className={styles.switchLabel}>{label}</span>
        {hint ? <span className={styles.switchHint}>{hint}</span> : null}
      </span>
      <span className={styles.switchTrack} data-on={checked ? 'true' : 'false'}>
        <input
          type="checkbox"
          className={styles.switchInput}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={styles.switchThumb} />
      </span>
    </label>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: T
  options: { id: T; label: string; hint?: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div className={styles.segmentBlock} data-disabled={disabled ? 'true' : 'false'}>
      <p className={styles.fieldLabel}>{label}</p>
      <div className={styles.segmented} role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            className={styles.segment}
            data-active={value === option.id ? 'true' : 'false'}
            disabled={disabled}
            onClick={() => onChange(option.id)}
          >
            <span className={styles.segmentLabel}>{option.label}</span>
            {option.hint ? <span className={styles.segmentHint}>{option.hint}</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function SliderRow({
  label,
  valueLabel,
  ...inputProps
}: {
  label: string
  valueLabel: string
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={styles.sliderRow}>
      <span className={styles.sliderHead}>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.valueChip}>{valueLabel}</span>
      </span>
      <input type="range" className={styles.slider} {...inputProps} />
    </label>
  )
}

export function Settings({
  settings,
  saveFlash,
  onRate,
  onVolume,
  onDelay,
  onEnBnGap,
  onMuted,
  onMode,
  onBanglaVoice,
  onBanglaEngine,
  onAutoAdvance,
  onBanglaRepeat,
  onShuffle,
  onParentGate,
  onParentPin,
  onApplyPreset,
  onReset,
  onBack,
}: Props) {
  const { speakWord, cancel } = useSpeech()
  const [cacheLabel, setCacheLabel] = useState('Measuring…')
  const [clearing, setClearing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [pinDraft, setPinDraft] = useState(settings.parentPin)
  const [pinSavedFlash, setPinSavedFlash] = useState(false)

  useEffect(() => {
    setPinDraft(settings.parentPin)
  }, [settings.parentPin])

  useEffect(() => {
    if (!pinSavedFlash) return
    const t = window.setTimeout(() => setPinSavedFlash(false), 1500)
    return () => window.clearTimeout(t)
  }, [pinSavedFlash])

  const savePin = () => {
    const next = pinDraft.replace(/\D/g, '').slice(0, 4)
    if (next.length !== 4) return
    onParentPin(next)
    setPinDraft(next)
    setPinSavedFlash(true)
  }

  const refreshCache = async () => {
    try {
      const stats = await getAudioCacheStats()
      setCacheLabel(
        stats.count === 0
          ? 'Empty'
          : `${stats.count} clips · ${formatBytes(stats.bytes)}`,
      )
    } catch {
      setCacheLabel('Unavailable')
    }
  }

  useEffect(() => {
    void refreshCache()
  }, [])

  const activePreset = SETTINGS_PRESETS.find(
    (preset) =>
      preset.patch.rate === settings.rate &&
      preset.patch.advanceDelayMs === settings.advanceDelayMs &&
      preset.patch.enBnGapMs === settings.enBnGapMs &&
      preset.patch.banglaRepeat === settings.banglaRepeat,
  )?.id

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden />
        <button type="button" className={styles.back} onClick={onBack}>
          ← Parents
        </button>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Preferences</p>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>সেটিংস</p>
          <p
            className={styles.savePill}
            data-saved={saveFlash ? 'true' : 'false'}
          >
            {saveFlash ? '✓ Saved on this device' : 'Autosaved in this browser'}
          </p>
        </div>
      </header>

      <section className={styles.card} style={{ '--i': 0 } as CSSProperties}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden>
            ⚡
          </span>
          <div>
            <h2 className={styles.sectionTitle}>Quick presets</h2>
            <p className={styles.sectionHint}>One tap for baby-friendly pacing</p>
          </div>
        </div>
        <div className={styles.presets}>
          {SETTINGS_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={styles.presetBtn}
              data-active={activePreset === preset.id ? 'true' : 'false'}
              onClick={() => onApplyPreset(preset.patch)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.card} style={{ '--i': 1 } as CSSProperties}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden>
            🔊
          </span>
          <div>
            <h2 className={styles.sectionTitle}>Sound</h2>
            <p className={styles.sectionHint}>Volume, speed, and a quick test</p>
          </div>
        </div>

        <SliderRow
          label="Volume"
          valueLabel={`${Math.round(settings.volume * 100)}%`}
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={(e) => onVolume(Number(e.target.value))}
        />

        <SliderRow
          label="Speech speed"
          valueLabel={`${settings.rate.toFixed(2)}×`}
          min={0.6}
          max={1.2}
          step={0.05}
          value={settings.rate}
          onChange={(e) => onRate(Number(e.target.value))}
        />

        <Switch
          checked={settings.muted}
          onChange={onMuted}
          label="Mute all speech"
          hint="Useful when the baby is asleep"
        />

        <button
          type="button"
          className={styles.testBtn}
          disabled={testing || settings.muted}
          onClick={() => {
            setTesting(true)
            cancel()
            void speakWord(
              { id: 'settings-test', en: 'cat', bn: 'বিড়াল' },
              {
                rate: settings.rate,
                volume: settings.volume,
                muted: settings.muted,
                mode: settings.speechMode === 'en-only' ? 'en-bn' : settings.speechMode,
                banglaVoice: settings.banglaVoice,
                banglaEngine: settings.banglaEngine,
                enBnGapMs: settings.enBnGapMs,
                banglaRepeat: 1,
              },
            ).finally(() => setTesting(false))
          }}
        >
          <span aria-hidden>🎧</span>
          {testing ? 'Playing sample…' : 'Test voice · cat / বিড়াল'}
        </button>
      </section>

      <section className={styles.card} style={{ '--i': 2 } as CSSProperties}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden>
            ▶️
          </span>
          <div>
            <h2 className={styles.sectionTitle}>Playback</h2>
            <p className={styles.sectionHint}>How each word is spoken and advanced</p>
          </div>
        </div>

        <Segmented<SpeechMode>
          label="Speech mode"
          value={settings.speechMode}
          onChange={onMode}
          options={[
            { id: 'en-bn', label: 'EN → BN', hint: 'Best for learning' },
            { id: 'bn-only', label: 'Bangla', hint: 'Practice only' },
            { id: 'en-only', label: 'English', hint: 'Warm-up' },
          ]}
        />

        <SliderRow
          label="Pause after each word"
          valueLabel={`${(settings.advanceDelayMs / 1000).toFixed(1)}s`}
          min={200}
          max={3000}
          step={100}
          value={settings.advanceDelayMs}
          disabled={!settings.autoAdvance}
          onChange={(e) => onDelay(Number(e.target.value))}
        />

        <SliderRow
          label="Gap between English & Bangla"
          valueLabel={`${(settings.enBnGapMs / 1000).toFixed(2)}s`}
          min={0}
          max={1200}
          step={40}
          value={settings.enBnGapMs}
          disabled={settings.speechMode !== 'en-bn'}
          onChange={(e) => onEnBnGap(Number(e.target.value))}
        />

        <Segmented<`${BanglaRepeat}`>
          label="Say Bangla"
          value={`${settings.banglaRepeat}`}
          disabled={settings.speechMode === 'en-only'}
          onChange={(v) => onBanglaRepeat(Number(v) as BanglaRepeat)}
          options={[
            { id: '1', label: 'Once' },
            { id: '2', label: 'Twice', hint: 'Extra practice' },
          ]}
        />

        <div className={styles.switchStack}>
          <Switch
            checked={settings.autoAdvance}
            onChange={onAutoAdvance}
            label="Auto-advance"
            hint="Off = tap Next word yourself"
          />
          <Switch
            checked={settings.shuffle}
            onChange={onShuffle}
            label="Shuffle order"
            hint="Fresh order each Start"
          />
        </div>
      </section>

      <section className={styles.card} style={{ '--i': 3 } as CSSProperties}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden>
            🗣️
          </span>
          <div>
            <h2 className={styles.sectionTitle}>Bangla voice</h2>
            <p className={styles.sectionHint}>Clear neural speech, cached on device</p>
          </div>
        </div>

        <Segmented<BanglaEngine>
          label="Engine"
          value={settings.banglaEngine}
          onChange={onBanglaEngine}
          options={[
            { id: 'neural', label: 'Neural', hint: 'Clearest' },
            { id: 'device', label: 'Device', hint: 'No download' },
          ]}
        />

        <div
          className={styles.voiceGrid}
          data-disabled={settings.banglaEngine !== 'neural' ? 'true' : 'false'}
        >
          {BANGLA_VOICES.map((voice) => (
            <button
              key={voice.id}
              type="button"
              className={styles.voiceCard}
              data-active={settings.banglaVoice === voice.id ? 'true' : 'false'}
              disabled={settings.banglaEngine !== 'neural'}
              onClick={() => onBanglaVoice(voice.id)}
            >
              <span className={styles.voiceName}>{voice.label.split(' (')[0]}</span>
              <span className={styles.voiceMeta}>
                {voice.label.includes('(')
                  ? voice.label.slice(voice.label.indexOf('(') + 1, -1)
                  : voice.id}
              </span>
            </button>
          ))}
        </div>

        <div className={styles.cacheBox}>
          <div>
            <p className={styles.cacheTitle}>Cached Bangla audio</p>
            <p className={styles.cacheMeta}>{cacheLabel}</p>
          </div>
          <button
            type="button"
            className={styles.clearBtn}
            disabled={clearing}
            onClick={() => {
              setClearing(true)
              void clearAudioCache()
                .then(refreshCache)
                .finally(() => setClearing(false))
            }}
          >
            {clearing ? 'Clearing…' : 'Clear'}
          </button>
        </div>
      </section>

      <section className={styles.card} style={{ '--i': 4 } as CSSProperties}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden>
            🔒
          </span>
          <div>
            <h2 className={styles.sectionTitle}>Baby lock</h2>
            <p className={styles.sectionHint}>
              Stop little hands from opening Parents or Settings by accident
            </p>
          </div>
        </div>

        <Segmented<ParentGate>
          label="Lock style"
          value={settings.parentGate}
          onChange={onParentGate}
          options={[
            { id: 'hold', label: 'Hold', hint: '~2 seconds' },
            { id: 'pin', label: 'PIN', hint: '4 digits' },
            { id: 'off', label: 'Off', hint: 'No lock' },
          ]}
        />

        {settings.parentGate === 'pin' ? (
          <div className={styles.pinRow}>
            <span className={styles.fieldLabel}>Parent PIN</span>
            <div className={styles.pinControls}>
              <input
                className={styles.pinInput}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={4}
                value={pinDraft}
                placeholder="••••"
                aria-label="Parent PIN, 4 digits"
                onChange={(e) => {
                  setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 4))
                  setPinSavedFlash(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') savePin()
                }}
              />
              <button
                type="button"
                className={styles.pinSaveBtn}
                disabled={pinDraft.replace(/\D/g, '').length !== 4}
                onClick={savePin}
              >
                Save PIN
              </button>
            </div>
            <span className={styles.sectionHint}>
              {pinSavedFlash
                ? 'PIN saved on this device.'
                : pinDraft.length === 4
                  ? 'Tap Save PIN to apply.'
                  : 'Enter exactly 4 digits, then Save PIN.'}
            </span>
          </div>
        ) : null}

        <p className={styles.sectionHint}>
          {settings.parentGate === 'hold'
            ? 'On Home, press and hold Parents until the button fills. Settings are inside the Parent Dashboard.'
            : settings.parentGate === 'pin'
              ? 'On Home, tap Parents and enter your PIN. Settings are inside the Parent Dashboard.'
              : 'Anyone can open Parents with one tap. Settings are inside the Parent Dashboard.'}
        </p>
      </section>

      <section className={styles.card} style={{ '--i': 5 } as CSSProperties}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden>
            💾
          </span>
          <div>
            <h2 className={styles.sectionTitle}>Saved on this device</h2>
            <p className={styles.sectionHint}>
              Preferences stay after reload. Clearing browser site data resets them.
            </p>
          </div>
        </div>
        <button type="button" className={styles.resetBtn} onClick={onReset}>
          Reset all settings
        </button>
      </section>
    </div>
  )
}
