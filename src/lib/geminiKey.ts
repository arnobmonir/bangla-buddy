export const GEMINI_API_KEY_STORAGE = 'baby-bangla-gemini-api-key'

export function getStoredGeminiApiKey(): string {
  try {
    if (typeof localStorage === 'undefined') return ''
    return localStorage.getItem(GEMINI_API_KEY_STORAGE)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function setStoredGeminiApiKey(key: string): void {
  const trimmed = key.trim()
  try {
    if (!trimmed) {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE)
      return
    }
    localStorage.setItem(GEMINI_API_KEY_STORAGE, trimmed)
  } catch {
    // quota / private mode
  }
}

export function clearStoredGeminiApiKey(): void {
  try {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE)
  } catch {
    // ignore
  }
}

/** Headers to attach when a device-local Gemini key is set. */
export function geminiApiKeyHeaders(): Record<string, string> {
  const key = getStoredGeminiApiKey()
  return key ? { 'x-gemini-api-key': key } : {}
}
