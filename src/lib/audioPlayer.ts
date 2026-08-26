/** Shared HTMLAudioElement so mobile browsers keep the user-gesture unlock. */

let sharedAudio: HTMLAudioElement | null = null
let unlockPromise: Promise<void> | null = null
let activeFinish: ((interrupted?: boolean, err?: Error) => void) | null = null

const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

function ensureAudio(): HTMLAudioElement {
  if (typeof window === 'undefined') {
    throw new Error('Audio not available')
  }
  if (!sharedAudio) {
    sharedAudio = new Audio()
    sharedAudio.setAttribute('playsinline', 'true')
    sharedAudio.setAttribute('webkit-playsinline', 'true')
    ;(sharedAudio as HTMLAudioElement & { playsInline?: boolean }).playsInline =
      true
    sharedAudio.preload = 'auto'
  }
  return sharedAudio
}

/**
 * Call from a user gesture (Start / mic press) so later Gemini clips can play
 * after speechSynthesis and async gaps on mobile.
 */
export function unlockAudioPlayback(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (unlockPromise) return unlockPromise

  unlockPromise = (async () => {
    const audio = ensureAudio()
    const previousVolume = audio.volume
    try {
      audio.src = SILENT_WAV
      audio.volume = 0.01
      await audio.play()
      audio.pause()
      audio.currentTime = 0
    } catch {
      // Still keep the element; a later play may succeed after gesture.
    } finally {
      audio.volume = previousVolume
    }
  })()

  return unlockPromise
}

export function stopSharedAudio(): void {
  const finish = activeFinish
  activeFinish = null
  if (sharedAudio) {
    sharedAudio.onended = null
    sharedAudio.onerror = null
    sharedAudio.onloadedmetadata = null
    sharedAudio.pause()
    try {
      sharedAudio.currentTime = 0
    } catch {
      /* ignore */
    }
  }
  finish?.(true)
}

export function playAudioBlob(
  blob: Blob,
  rate: number,
  volume: number,
): Promise<void> {
  const audio = ensureAudio()
  stopSharedAudio()

  const url = URL.createObjectURL(blob)
  const playbackRate = Math.min(
    1.15,
    Math.max(0.85, rate > 1 ? 1 + (rate - 1) * 0.35 : rate),
  )

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (interrupted?: boolean, err?: Error) => {
      if (settled) return
      settled = true
      if (activeFinish === finish) activeFinish = null
      audio.onended = null
      audio.onerror = null
      audio.onloadedmetadata = null
      URL.revokeObjectURL(url)
      if (interrupted) resolve()
      else if (err) reject(err)
      else resolve()
    }

    activeFinish = finish

    const applyPlayback = () => {
      audio.playbackRate = playbackRate
      audio.volume = Math.min(1, Math.max(0, volume))
    }

    audio.onended = () => {
      const duration = audio.duration
      const played = Number.isFinite(duration) ? duration : audio.currentTime
      if (played > 0 && played < 0.08) {
        finish(false, new Error('Audio clip ended before it could be heard'))
        return
      }
      finish()
    }
    audio.onerror = () => finish(false, new Error('Audio playback failed'))
    audio.onloadedmetadata = () => {
      applyPlayback()
      const duration = audio.duration
      if (Number.isFinite(duration) && duration > 0 && duration < 0.08) {
        finish(false, new Error('Audio clip too short'))
      }
    }
    audio.src = url
    applyPlayback()

    const tryPlay = async () => {
      try {
        await audio.play()
      } catch (first) {
        if (settled) return
        await new Promise((r) => window.setTimeout(r, 120))
        if (settled) return
        try {
          await unlockAudioPlayback()
          if (settled) return
          applyPlayback()
          await audio.play()
        } catch (second) {
          const message =
            second instanceof Error
              ? second.message
              : first instanceof Error
                ? first.message
                : 'Audio play blocked'
          finish(false, new Error(message))
        }
      }
    }

    void tryPlay()
  })
}
