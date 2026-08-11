export type DebugLevel = 'info' | 'warn' | 'error' | 'ok'

export type DebugEntry = {
  id: number
  at: number
  level: DebugLevel
  source: string
  message: string
}

const MAX_ENTRIES = 80
const listeners = new Set<() => void>()

let nextId = 1
let entries: DebugEntry[] = []

function notify() {
  for (const listener of listeners) listener()
}

export function subscribeDebugLog(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDebugLog(): readonly DebugEntry[] {
  return entries
}

export function clearDebugLog(): void {
  entries = []
  notify()
}

export function pushDebug(
  source: string,
  message: string,
  level: DebugLevel = 'info',
): void {
  entries = [
    { id: nextId++, at: Date.now(), level, source, message },
    ...entries,
  ].slice(0, MAX_ENTRIES)
  notify()
}

export function formatDebugTime(at: number): string {
  try {
    return new Date(at).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return String(at)
  }
}
