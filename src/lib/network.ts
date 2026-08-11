/** True when the browser reports no network (best-effort). */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}
