import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchBanglaAudio } from '../lib/banglaTts'
import { pushDebug } from '../lib/debugLog'
import { translateEnglishToBangla } from '../lib/translate'
import type {
  AppSettings,
  BanglaEngine,
  BanglaVoiceId,
  GeminiVoiceId,
} from '../types/word'
import styles from './SpeakTranslate.module.css'

type SpeakSettings = Pick<
  AppSettings,
  'rate' | 'volume' | 'muted' | 'banglaVoice' | 'geminiVoice' | 'banglaEngine'
>

type Props = {
  settings: SpeakSettings
}

type Phase =
  | 'idle'
  | 'listening'
  | 'translating'
  | 'speaking'
  | 'unsupported'
  | 'error'

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function cloudVoice(
  engine: BanglaEngine,
  banglaVoice: BanglaVoiceId,
  geminiVoice: GeminiVoiceId,
): BanglaVoiceId | GeminiVoiceId {
  return engine === 'gemini' ? geminiVoice : banglaVoice
}

function pickBrowserVoice(
  voices: SpeechSynthesisVoice[],
  langs: string[],
): SpeechSynthesisVoice | null {
  for (const lang of langs) {
    const exact = voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase())
    if (exact) return exact
    const prefix = voices.find((v) =>
      v.lang.toLowerCase().startsWith(lang.split('-')[0].toLowerCase()),
    )
    if (prefix) return prefix
  }
  return null
}

export function SpeakTranslate({ settings }: Props) {
  const supported = getSpeechRecognitionCtor() != null
  const [phase, setPhase] = useState<Phase>(supported ? 'idle' : 'unsupported')
  const [heard, setHeard] = useState('')
  const [bangla, setBangla] = useState('')
  const [errorMsg, setErrorMsg] = useState<{ en: string; bn: string } | null>(
    null,
  )

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef = useRef('')
  const holdingRef = useRef(false)
  const generationRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const pointerIdRef = useRef<number | null>(null)

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }, [])

  const cancelInFlight = useCallback(() => {
    generationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    stopAudio()
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        recognitionRef.current.abort()
      } catch {
        /* ignore */
      }
      recognitionRef.current = null
    }
  }, [stopAudio])

  useEffect(() => () => cancelInFlight(), [cancelInFlight])

  const playBangla = useCallback(
    async (bn: string, generation: number) => {
      if (generation !== generationRef.current) return
      if (settings.muted) {
        setPhase('idle')
        return
      }

      setPhase('speaking')

      const finish = () => {
        if (generation !== generationRef.current) return
        setPhase('idle')
      }

      if (settings.banglaEngine === 'device') {
        await new Promise<void>((resolve) => {
          if (generation !== generationRef.current || !window.speechSynthesis) {
            resolve()
            return
          }
          const utterance = new SpeechSynthesisUtterance(bn)
          utterance.rate = settings.rate
          utterance.volume = settings.volume
          utterance.lang = 'bn-BD'
          const voice = pickBrowserVoice(window.speechSynthesis.getVoices(), [
            'bn-BD',
            'bn-IN',
            'bn',
          ])
          if (voice) utterance.voice = voice
          utterance.onend = () => resolve()
          utterance.onerror = () => resolve()
          window.speechSynthesis.speak(utterance)
        })
        finish()
        return
      }

      try {
        const engine = settings.banglaEngine === 'gemini' ? 'gemini' : 'neural'
        const blob = await fetchBanglaAudio(
          bn,
          cloudVoice(
            settings.banglaEngine,
            settings.banglaVoice,
            settings.geminiVoice,
          ),
          settings.rate,
          engine,
        )
        if (generation !== generationRef.current) return

        await new Promise<void>((resolve, reject) => {
          const url = URL.createObjectURL(blob)
          objectUrlRef.current = url
          const audio = new Audio(url)
          audio.playbackRate = 1
          audio.volume = settings.volume
          audioRef.current = audio
          audio.onended = () => resolve()
          audio.onerror = () => reject(new Error('Audio playback failed'))
          void audio.play().catch(reject)
        })
      } catch {
        if (generation !== generationRef.current) return
        // Soft fallback to device voice
        if (window.speechSynthesis) {
          await new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(bn)
            utterance.rate = settings.rate
            utterance.volume = settings.volume
            utterance.lang = 'bn-BD'
            utterance.onend = () => resolve()
            utterance.onerror = () => resolve()
            window.speechSynthesis.speak(utterance)
          })
        }
      }

      finish()
    },
    [settings],
  )

  const processTranscript = useCallback(
    async (raw: string) => {
      const text = raw.trim().replace(/\s+/g, ' ')
      if (!text) {
        setErrorMsg({
          en: 'Didn’t catch that — hold and try again',
          bn: 'শোনা যায়নি — আবার চেপে ধরে বলুন',
        })
        setPhase('error')
        return
      }

      const generation = ++generationRef.current
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setHeard(text)
      setBangla('')
      setErrorMsg(null)
      setPhase('translating')

      try {
        const result = await translateEnglishToBangla(text, controller.signal)
        if (generation !== generationRef.current) return
        setHeard(result.en)
        setBangla(result.bn)
        await playBangla(result.bn, generation)
      } catch (err) {
        if (generation !== generationRef.current) return
        if (err instanceof Error && err.name === 'AbortError') return
        pushDebug(
          'speak',
          err instanceof Error ? err.message : 'Translate failed',
          'error',
        )
        setErrorMsg({
          en: 'Couldn’t translate — try again',
          bn: 'অনুবাদ হয়নি — আবার চেষ্টা করুন',
        })
        setPhase('error')
      }
    },
    [playBangla],
  )

  const beginHold = (pointerId: number) => {
    if (!supported) {
      setPhase('unsupported')
      return
    }
    if (holdingRef.current) return
    if (phase === 'translating' || phase === 'speaking') {
      cancelInFlight()
    }

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setPhase('unsupported')
      return
    }

    holdingRef.current = true
    pointerIdRef.current = pointerId
    transcriptRef.current = ''
    setErrorMsg(null)
    setPhase('listening')

    const recognition = new Ctor()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let finalText = ''
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript ?? ''
        if (event.results[i].isFinal) finalText += piece
        else interim += piece
      }
      if (finalText) {
        transcriptRef.current = `${transcriptRef.current} ${finalText}`.trim()
      }
      const live = (transcriptRef.current || interim).trim()
      if (live) setHeard(live)
    }

    recognition.onerror = (event) => {
      if (!holdingRef.current) return
      if (event.error === 'aborted' || event.error === 'no-speech') return
      if (event.error === 'not-allowed') {
        holdingRef.current = false
        setErrorMsg({
          en: 'Microphone permission needed',
          bn: 'মাইক্রোফোনের অনুমতি দিন',
        })
        setPhase('error')
      }
    }

    recognition.onend = () => {
      /* restart while holding — some browsers stop early */
      if (holdingRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start()
        } catch {
          /* ignore */
        }
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      holdingRef.current = false
      setErrorMsg({
        en: 'Couldn’t start listening',
        bn: 'শোনা শুরু হয়নি',
      })
      setPhase('error')
    }
  }

  const endHold = (pointerId?: number) => {
    if (!holdingRef.current) return
    if (
      pointerId != null &&
      pointerIdRef.current != null &&
      pointerId !== pointerIdRef.current
    ) {
      return
    }

    holdingRef.current = false
    pointerIdRef.current = null

    const recognition = recognitionRef.current
    recognitionRef.current = null

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      const text = transcriptRef.current.trim()
      void processTranscript(text)
    }

    if (!recognition) {
      finish()
      return
    }

    recognition.onerror = null
    recognition.onend = () => {
      finish()
    }
    try {
      recognition.stop()
      // Some browsers never fire onend after stop — safety net.
      window.setTimeout(finish, 600)
    } catch {
      try {
        recognition.abort()
      } catch {
        /* ignore */
      }
      finish()
    }
  }

  const replay = () => {
    if (!bangla || phase === 'listening' || phase === 'translating') return
    const generation = ++generationRef.current
    abortRef.current?.abort()
    stopAudio()
    void playBangla(bangla, generation)
  }

  const phaseClass =
    phase === 'listening'
      ? styles.listening
      : phase === 'translating'
        ? styles.translating
        : phase === 'speaking'
          ? styles.speaking
          : phase === 'error' || phase === 'unsupported'
            ? styles.error
            : ''

  const statusEn =
    phase === 'listening'
      ? 'Listening…'
      : phase === 'translating'
        ? 'Translating…'
        : phase === 'speaking'
          ? 'Speaking…'
          : phase === 'unsupported'
            ? 'Speech not supported here'
            : phase === 'error' && errorMsg
              ? errorMsg.en
              : 'Hold to speak'

  const statusBn =
    phase === 'listening'
      ? 'শুনছি…'
      : phase === 'translating'
        ? 'অনুবাদ হচ্ছে…'
        : phase === 'speaking'
          ? 'বাংলায় বলছি…'
          : phase === 'unsupported'
            ? 'এই ব্রাউজারে কাজ করে না'
            : phase === 'error' && errorMsg
              ? errorMsg.bn
              : 'চেপে ধরে বলুন'

  const busy =
    phase === 'listening' || phase === 'translating' || phase === 'speaking'

  return (
    <section
      className={`${styles.section} ${phaseClass}`}
      aria-label="Hold to speak and translate"
    >
      <div className={styles.stage}>
        <button
          type="button"
          className={styles.mic}
          disabled={phase === 'unsupported'}
          aria-label={
            phase === 'listening'
              ? 'Release to translate'
              : 'Hold to speak English and translate to Bangla'
          }
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.currentTarget.setPointerCapture(e.pointerId)
            beginHold(e.pointerId)
          }}
          onPointerUp={(e) => endHold(e.pointerId)}
          onPointerCancel={(e) => endHold(e.pointerId)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className={styles.ring} aria-hidden />
          <span className={styles.micFace} aria-hidden>
            {phase === 'speaking' ? (
              <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden>
                <path
                  fill="currentColor"
                  d="M4 10v4h2l5 4V6L6 10H4zm13.5 2a3.5 3.5 0 0 0-1.75-3.03v6.06A3.5 3.5 0 0 0 17.5 12zM14 5.23v2.06a5.5 5.5 0 0 1 0 9.42v2.06a7.5 7.5 0 0 0 0-13.54z"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"
                />
              </svg>
            )}
          </span>
          {!busy ? (
            <span className={styles.badge} aria-hidden>
              <svg viewBox="0 0 24 24" className={styles.badgeIcon}>
                <path
                  fill="currentColor"
                  d="M11 2a2 2 0 0 1 2 2v6.5l.8-.8a1.5 1.5 0 1 1 2.1 2.1l-3.4 3.4A2 2 0 0 1 11 16H8.5A2.5 2.5 0 0 1 6 13.5V9a1.5 1.5 0 0 1 3 0v1V4a2 2 0 0 1 2-2zm-1 16.5c0-.28.22-.5.5-.5h5c.28 0 .5.22.5.5V20a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1v-1.5z"
                />
              </svg>
            </span>
          ) : null}
        </button>
      </div>

      <div className={styles.labels}>
        <p className={styles.labelEn}>{statusEn}</p>
        <p className={styles.labelBn}>{statusBn}</p>
      </div>

      {(heard || bangla) ? (
        <div className={styles.result} aria-live="polite">
          {heard ? <span className={styles.resultEn}>{heard}</span> : null}
          {heard && bangla ? (
            <span className={styles.resultArrow} aria-hidden>
              →
            </span>
          ) : null}
          {bangla ? <span className={styles.resultBn}>{bangla}</span> : null}
          {bangla ? (
            <button
              type="button"
              className={styles.replay}
              onClick={replay}
              aria-label="Replay Bangla"
              disabled={phase === 'listening' || phase === 'translating'}
            >
              <svg viewBox="0 0 24 24" className={styles.replayIcon} aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
                />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
