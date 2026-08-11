import { pushDebug } from './debugLog'
import { geminiApiKeyHeaders } from './geminiKey'

export type TranslateResult = {
  en: string
  bn: string
}

export async function translateEnglishToBangla(
  text: string,
  signal?: AbortSignal,
): Promise<TranslateResult> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...geminiApiKeyHeaders(),
    },
    body: JSON.stringify({ text }),
    signal,
  })

  const body = await res.text()
  let parsed: unknown = null
  try {
    parsed = body ? JSON.parse(body) : null
  } catch {
    parsed = null
  }

  if (!res.ok) {
    const message =
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : body || `Translate HTTP ${res.status}`
    pushDebug('translate', message, 'error')
    throw new Error(message)
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as { en?: unknown }).en !== 'string' ||
    typeof (parsed as { bn?: unknown }).bn !== 'string'
  ) {
    pushDebug('translate', 'Invalid translate response', 'error')
    throw new Error('Invalid translate response')
  }

  const result = {
    en: (parsed as TranslateResult).en,
    bn: (parsed as TranslateResult).bn,
  }
  pushDebug('translate', `${result.en} → ${result.bn}`, 'ok')
  return result
}
