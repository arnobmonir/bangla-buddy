/**
 * Vercel serverless translate handler (CommonJS).
 * English → Bangla via Gemini text model. Keep GEMINI_API_KEY server-side.
 */

const GEMINI_TRANSLATE_MODEL = 'gemini-2.5-flash'
const MAX_TEXT_LENGTH = 200

function parseTranslateBody(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, status: 400, error: 'Expected JSON body with text' }
  }

  const text = raw.text
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

function extractJsonObject(text) {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function extractGeminiText(payload) {
  if (!payload || typeof payload !== 'object') return null
  const candidates = payload.candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const first = candidates[0]
  if (!first || typeof first !== 'object') return null
  const content = first.content
  if (!content || typeof content !== 'object') return null
  const parts = content.parts
  if (!Array.isArray(parts)) return null
  const texts = []
  for (const part of parts) {
    if (part && typeof part === 'object' && typeof part.text === 'string') {
      texts.push(part.text)
    }
  }
  const joined = texts.join('').trim()
  return joined || null
}

function resolveGeminiApiKey(clientKey) {
  const fromEnv = process.env.GEMINI_API_KEY?.trim()
  if (fromEnv) return fromEnv
  const fromClient = typeof clientKey === 'string' ? clientKey.trim() : ''
  if (fromClient) return fromClient
  const err = new Error(
    'GEMINI_API_KEY is not configured. Add it in Settings, or set GEMINI_API_KEY on the server (.env.local / Vercel).',
  )
  err.status = 503
  throw err
}

function readGeminiApiKeyHeader(req) {
  const raw = req.headers?.['x-gemini-api-key']
  if (typeof raw === 'string') return raw.trim() || undefined
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0].trim() || undefined
  return undefined
}

async function translateEnglishToBangla(en, clientApiKey) {
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
        const parsed = JSON.parse(bodyText)
        if (parsed.error?.message) message = parsed.error.message
      } catch {
        if (bodyText.trim()) message = bodyText.slice(0, 200)
      }
      throw new Error(message)
    }

    let payload
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    let raw = req.body
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw)
      } catch {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
        return
      }
    }

    const parsed = parseTranslateBody(raw)
    if (!parsed.ok) {
      res.statusCode = parsed.status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: parsed.error }))
      return
    }

    const result = await translateEnglishToBangla(
      parsed.value,
      readGeminiApiKeyHeader(req),
    )
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(result))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translate failed'
    const status = typeof err?.status === 'number' ? err.status : 502
    console.error('[api/translate]', message)
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: message }))
  }
}

module.exports.config = {
  maxDuration: 20,
}
