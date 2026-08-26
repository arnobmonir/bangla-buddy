import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AppSettings } from '../types/word'
import {
  clearAudioCache,
  formatBytes,
  getAudioCacheStats,
} from '../lib/audioCache'
import {
  clearDebugLog,
  formatDebugTime,
  getDebugLog,
  pushDebug,
  subscribeDebugLog,
  type DebugEntry,
} from '../lib/debugLog'
import { fetchBanglaAudio } from '../lib/banglaTts'
import { getStoredGeminiApiKey } from '../lib/geminiKey'
import { translateEnglishToBangla } from '../lib/translate'
import styles from './DebugPanel.module.css'

type Props = {
  open: boolean
  onClose: () => void
  settings: AppSettings
  screenName: string
}

type PingState = {
  ok: boolean
  hasGeminiKey: boolean
  error?: string
} | null

function speechRecognitionSupported() {
  if (typeof window === 'undefined') return false
  const w = window as Window & {
    SpeechRecognition?: unknown
    webkitSpeechRecognition?: unknown
  }
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}

function maskKey(key: string) {
  if (!key) return '(none)'
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

export function DebugPanel({ open, onClose, settings, screenName }: Props) {
  const [log, setLog] = useState<readonly DebugEntry[]>(() => getDebugLog())
  const [ping, setPing] = useState<PingState>(null)
  const [cacheLabel, setCacheLabel] = useState('—')
  const [voiceCount, setVoiceCount] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const localKey = getStoredGeminiApiKey()

  const refreshLog = useCallback(() => setLog([...getDebugLog()]), [])

  useEffect(() => subscribeDebugLog(refreshLog), [refreshLog])

  const refreshCache = useCallback(async () => {
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
  }, [])

  const refreshPing = useCallback(async () => {
    try {
      const res = await fetch('/api/ping')
      const body = (await res.json()) as { ok?: boolean; hasGeminiKey?: boolean }
      const next = {
        ok: Boolean(res.ok && body.ok),
        hasGeminiKey: Boolean(body.hasGeminiKey),
      }
      setPing(next)
      pushDebug(
        'ping',
        `ok=${next.ok} hasGeminiKey=${next.hasGeminiKey}`,
        next.ok ? 'ok' : 'warn',
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ping failed'
      setPing({ ok: false, hasGeminiKey: false, error: message })
      pushDebug('ping', message, 'error')
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void refreshPing()
    void refreshCache()
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const load = () => setVoiceCount(window.speechSynthesis.getVoices().length)
      load()
      window.speechSynthesis.addEventListener('voiceschanged', load)
      return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
    }
  }, [open, refreshPing, refreshCache])

  const snapshot = useMemo(() => {
    return {
      screen: screenName,
      time: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      viewport:
        typeof window !== 'undefined'
          ? `${window.innerWidth}×${window.innerHeight}`
          : '',
      online: typeof navigator !== 'undefined' ? navigator.onLine : null,
      speechRecognition: speechRecognitionSupported(),
      speechVoices: voiceCount,
      serverPing: ping,
      localGeminiKey: maskKey(localKey),
      hasLocalGeminiKey: Boolean(localKey),
      audioCache: cacheLabel,
      settings: {
        banglaEngine: settings.banglaEngine,
        banglaVoice: settings.banglaVoice,
        geminiVoice: settings.geminiVoice,
        rate: settings.rate,
        volume: settings.volume,
        muted: settings.muted,
        speechMode: settings.speechMode,
        parentGate: settings.parentGate,
        autoAdvance: settings.autoAdvance,
        banglaRepeat: settings.banglaRepeat,
        shuffle: settings.shuffle,
      },
      recentLog: log.slice(0, 20),
    }
  }, [screenName, voiceCount, ping, localKey, cacheLabel, settings, log])

  const runTest = async (name: string, fn: () => Promise<void>) => {
    setBusy(name)
    try {
      await fn()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      pushDebug('test', `${name}: ${message}`, 'error')
    } finally {
      setBusy(null)
      void refreshCache()
    }
  }

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2))
      setCopied(true)
      pushDebug('debug', 'Copied report to clipboard', 'ok')
      window.setTimeout(() => setCopied(false), 1200)
    } catch (err) {
      pushDebug(
        'debug',
        err instanceof Error ? err.message : 'Copy failed',
        'error',
      )
    }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className={styles.root} role="dialog" aria-label="Debug panel">
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close debug panel"
        onClick={onClose}
      />
      <div className={styles.panel}>
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>Developer</p>
            <h2 className={styles.title}>Debug panel</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </header>

        <p className={styles.hint}>
          Shortcut: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>
        </p>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Status</h3>
          <dl className={styles.grid}>
            <div>
              <dt>Screen</dt>
              <dd>{screenName}</dd>
            </div>
            <div>
              <dt>API ping</dt>
              <dd data-tone={ping?.ok ? 'ok' : ping ? 'bad' : 'muted'}>
                {ping == null
                  ? '…'
                  : ping.ok
                    ? 'OK'
                    : ping.error ?? 'Failed'}
              </dd>
            </div>
            <div>
              <dt>Server Gemini key</dt>
              <dd data-tone={ping?.hasGeminiKey ? 'ok' : 'warn'}>
                {ping == null ? '…' : ping.hasGeminiKey ? 'Yes' : 'No'}
              </dd>
            </div>
            <div>
              <dt>Local Gemini key</dt>
              <dd data-tone={localKey ? 'ok' : 'warn'}>{maskKey(localKey)}</dd>
            </div>
            <div>
              <dt>Bangla engine</dt>
              <dd>{settings.banglaEngine}</dd>
            </div>
            <div>
              <dt>Voice</dt>
              <dd>
                {settings.banglaEngine === 'gemini'
                  ? settings.geminiVoice
                  : settings.banglaEngine === 'neural'
                    ? settings.banglaVoice
                    : 'device'}
              </dd>
            </div>
            <div>
              <dt>SpeechRecognition</dt>
              <dd data-tone={speechRecognitionSupported() ? 'ok' : 'bad'}>
                {speechRecognitionSupported() ? 'Supported' : 'Missing'}
              </dd>
            </div>
            <div>
              <dt>Browser voices</dt>
              <dd>{voiceCount}</dd>
            </div>
            <div>
              <dt>Audio cache</dt>
              <dd>{cacheLabel}</dd>
            </div>
            <div>
              <dt>Viewport</dt>
              <dd>
                {typeof window !== 'undefined'
                  ? `${window.innerWidth}×${window.innerHeight}`
                  : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Quick tests</h3>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              disabled={busy != null}
              onClick={() => void runTest('ping', refreshPing)}
            >
              {busy === 'ping' ? '…' : 'Ping API'}
            </button>
            <button
              type="button"
              className={styles.action}
              disabled={busy != null}
              onClick={() =>
                void runTest('translate', async () => {
                  await translateEnglishToBangla('cat')
                })
              }
            >
              {busy === 'translate' ? '…' : 'Translate “cat”'}
            </button>
            <button
              type="button"
              className={styles.action}
              disabled={busy != null}
              onClick={() =>
                void runTest('tts', async () => {
                  const engine =
                    settings.banglaEngine === 'gemini' ? 'gemini' : 'neural'
                  const voice =
                    engine === 'gemini'
                      ? settings.geminiVoice
                      : settings.banglaVoice
                  const blob = await fetchBanglaAudio(
                    'বিড়াল',
                    voice,
                    settings.rate,
                    engine,
                    'bn',
                  )
                  const url = URL.createObjectURL(blob)
                  const audio = new Audio(url)
                  await audio.play()
                  audio.onended = () => URL.revokeObjectURL(url)
                })
              }
            >
              {busy === 'tts' ? '…' : 'Speak বিড়াল'}
            </button>
            <button
              type="button"
              className={styles.action}
              disabled={busy != null || settings.banglaEngine === 'device'}
              onClick={() =>
                void runTest('tts-en', async () => {
                  const engine =
                    settings.banglaEngine === 'gemini' ? 'gemini' : 'neural'
                  const voice =
                    engine === 'gemini'
                      ? settings.geminiVoice
                      : settings.banglaVoice
                  const blob = await fetchBanglaAudio(
                    'cat',
                    voice,
                    settings.rate,
                    engine,
                    'en',
                  )
                  const url = URL.createObjectURL(blob)
                  const audio = new Audio(url)
                  await audio.play()
                  audio.onended = () => URL.revokeObjectURL(url)
                })
              }
            >
              {busy === 'tts-en' ? '…' : 'Speak cat'}
            </button>
            <button
              type="button"
              className={styles.action}
              disabled={busy != null}
              onClick={() => void copyReport()}
            >
              {copied ? 'Copied' : 'Copy report'}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionRow}>
            <h3 className={styles.sectionTitle}>Event log</h3>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                clearDebugLog()
                refreshLog()
              }}
            >
              Clear
            </button>
          </div>
          <ul className={styles.log}>
            {log.length === 0 ? (
              <li className={styles.empty}>No events yet</li>
            ) : (
              log.map((entry) => (
                <li key={entry.id} data-level={entry.level}>
                  <span className={styles.logTime}>
                    {formatDebugTime(entry.at)}
                  </span>
                  <span className={styles.logSource}>{entry.source}</span>
                  <span className={styles.logMsg}>{entry.message}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Danger zone</h3>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.danger}
              disabled={busy != null}
              onClick={() =>
                void runTest('clear-cache', async () => {
                  await clearAudioCache()
                  pushDebug('cache', 'Audio cache cleared', 'warn')
                })
              }
            >
              Clear audio cache
            </button>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  )
}
