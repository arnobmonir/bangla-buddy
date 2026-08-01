import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './ParentGateButton.module.css'

type Props = {
  className?: string
  label: string
  ariaLabel: string
  holdMs?: number
  mode: 'hold' | 'pin' | 'off'
  pin: string
  onUnlock: () => void
  children?: ReactNode
}

export function ParentGateButton({
  className,
  label,
  ariaLabel,
  holdMs = 1800,
  mode,
  pin,
  onUnlock,
  children,
}: Props) {
  const [progress, setProgress] = useState(0)
  const [showPin, setShowPin] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const timerRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const unlockedRef = useRef(false)

  const clearHold = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setProgress(0)
    unlockedRef.current = false
  }, [])

  const tick = useCallback(() => {
    const elapsed = performance.now() - startRef.current
    const pct = Math.min(100, (elapsed / holdMs) * 100)
    setProgress(pct)
    if (pct < 100) {
      rafRef.current = window.requestAnimationFrame(tick)
    }
  }, [holdMs])

  const beginHold = () => {
    if (mode === 'off') {
      onUnlock()
      return
    }
    if (mode === 'pin') {
      setShowPin(true)
      setPinInput('')
      setPinError(false)
      return
    }

    clearHold()
    unlockedRef.current = false
    startRef.current = performance.now()
    rafRef.current = window.requestAnimationFrame(tick)
    timerRef.current = window.setTimeout(() => {
      unlockedRef.current = true
      setProgress(100)
      onUnlock()
      window.setTimeout(() => setProgress(0), 200)
    }, holdMs)
  }

  const endHold = () => {
    if (mode !== 'hold') return
    if (!unlockedRef.current) clearHold()
  }

  const submitPin = () => {
    if (pinInput === pin) {
      setShowPin(false)
      setPinInput('')
      setPinError(false)
      onUnlock()
      return
    }
    setPinError(true)
    setPinInput('')
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.gateBtn} ${className ?? ''}`}
        aria-label={
          mode === 'hold'
            ? `${ariaLabel}. Press and hold to unlock.`
            : mode === 'pin'
              ? `${ariaLabel}. Enter parent PIN.`
              : ariaLabel
        }
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          beginHold()
        }}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        onPointerLeave={endHold}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span
          className={styles.progress}
          style={{ '--p': `${progress}%` } as CSSProperties}
          aria-hidden
        />
        <span className={styles.label}>{children ?? label}</span>
        {mode === 'hold' ? (
          <span className={styles.hint} title="Press and hold" aria-hidden>
            <svg className={styles.hintIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M8.5 11V7.5a1.5 1.5 0 0 1 3 0V11"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M11.5 10.5V6.75a1.5 1.5 0 0 1 3 0V11"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M14.5 10.25V8.5a1.5 1.5 0 0 1 3 0V12.5c0 2.8-1.7 5.5-4.2 6.75L12 20"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8.5 11.5c-1.2.4-2 1.6-2 2.9V15c0 2.5 1.5 4.7 3.7 5.7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
        ) : null}
        {mode === 'pin' ? (
          <span className={styles.hint} title="PIN required" aria-hidden>
            <svg className={styles.hintIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect
                x="5"
                y="10"
                width="14"
                height="11"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="12" cy="15.5" r="1.3" fill="currentColor" />
            </svg>
          </span>
        ) : null}
      </button>

      {showPin
        ? createPortal(
            <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Parent PIN">
              <div className={styles.sheet}>
                <h2 className={styles.sheetTitle}>Parent unlock</h2>
                <p className={styles.sheetSub}>Enter the 4-digit PIN</p>
                <div className={styles.dots} aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={styles.dot}
                      data-filled={pinInput.length > i ? 'true' : 'false'}
                    />
                  ))}
                </div>
                {pinError ? <p className={styles.error}>Wrong PIN — try again</p> : null}
                <div className={styles.pad}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', 'Go'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={styles.key}
                      onClick={() => {
                        if (key === '←') {
                          setPinInput((v) => v.slice(0, -1))
                          setPinError(false)
                          return
                        }
                        if (key === 'Go') {
                          submitPin()
                          return
                        }
                        setPinInput((v) => {
                          const next = (v + key).slice(0, 4)
                          if (next.length === 4) {
                            window.setTimeout(() => {
                              if (next === pin) {
                                setShowPin(false)
                                setPinInput('')
                                setPinError(false)
                                onUnlock()
                              } else {
                                setPinError(true)
                                setPinInput('')
                              }
                            }, 80)
                          }
                          return next
                        })
                        setPinError(false)
                      }}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={styles.cancel}
                  onClick={() => {
                    setShowPin(false)
                    setPinInput('')
                    setPinError(false)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
