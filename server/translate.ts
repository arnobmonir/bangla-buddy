import { resolveGeminiApiKey } from './geminiKey.ts'

const GEMINI_TRANSLATE_MODEL = 'gemini-2.5-flash'
const MAX_TEXT_LENGTH = 200

export type TranslateResult = {
  en: string
  bn: string
}

export type TranslateParseResult =
  | { ok: true; value: string }
  | { ok: false; status: number; error: string }

export function parseTranslateBody(raw: unknown): TranslateParseResult {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, status: 400, error: 'Expected JSON body with text' }
  }

  const text = (raw as { text?: unknown }).text
  if (typeof text !== 'string') {
    return { ok: false, status: 400, error: 'Missing text' }
  }

  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) {
    return { ok: false, status: 400, error: 'Text is empty' }
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `Text too long (max ${MAX_TEXT_LENGTH} characters)`,
    }
  }

  return { ok: true, value: trimmed }
}

function extractJsonObject(text: string): { bn?: string } | null {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed) as { bn?: string }
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as { bn?: string }
      } catch {
        return null
      }
    }
    return null
  }
}

function extractGeminiText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const first = candidates[0]
  if (!first || typeof first !== 'object') return null
  const content = (first as { content?: unknown }).content
  if (!content || typeof content !== 'object') return null
  const parts = (content as { parts?: unknown }).parts
  if (!Array.isArray(parts)) return null
  const texts: string[] = []
  for (const part of parts) {
    if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
      texts.push((part as { text: string }).text)
    }
  }
  const joined = texts.join('').trim()
  return joined || null
}

/**
 * Translate short English child speech to Bangla via Gemini text model.
 */
export async function translateEnglishToBangla(
  en: string,
  clientApiKey?: string | null,
): Promise<TranslateResult> {
  const apiKey = resolveGeminiApiKey(clientApiKey)

  const prompt = [
    'You translate short English speech from a young child into Bangla (Bengali script).',
    'Return ONLY a JSON object: {"bn":"<bangla translation>"}.',
    'Rules:',
    '- Use natural child-friendly Bangla.',
    '- No English letters in bn.',
    '- No explanation, markdown, or extra keys.',
    `- English: «${en}»`,
  ].join('\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${GEMINI_TRANSLATE_MODEL}:generateContent`

    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 256,
          responseMimeType: 'application/json',
        },
      }),
    })

    const bodyText = await res.text()
    if (!res.ok) {
      let message = `Gemini translate HTTP ${res.status}`
      try {
        const parsed = JSON.parse(bodyText) as { error?: { message?: string } }
        if (parsed.error?.message) message = parsed.error.message
      } catch {
        if (bodyText.trim()) message = bodyText.slice(0, 200)
      }
      throw new Error(message)
    }

    let payload: unknown
    try {
      payload = JSON.parse(bodyText)
    } catch {
      throw new Error('Gemini translate returned invalid JSON')
    }

    const modelText = extractGeminiText(payload)
    if (!modelText) throw new Error('Gemini translate returned no text')

    const parsed = extractJsonObject(modelText)
    const bn = parsed?.bn?.trim()
    if (!bn) throw new Error('Gemini translate returned empty Bangla')

    return { en, bn }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Gemini translate timed out')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
