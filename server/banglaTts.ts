import { createHash, randomBytes } from 'node:crypto'
import WebSocket from 'ws'
import { resolveGeminiApiKey } from './geminiKey.ts'

export const ALLOWED_EDGE_VOICES = new Set([
  'bn-IN-TanishaaNeural',
  'bn-IN-BashkarNeural',
  'bn-BD-NabanitaNeural',
  'bn-BD-PradeepNeural',
])

/** @deprecated Use ALLOWED_EDGE_VOICES */
export const ALLOWED_VOICES = ALLOWED_EDGE_VOICES

export const ALLOWED_GEMINI_VOICES = new Set([
  'Leda',
  'Achernar',
  'Puck',
  'Kore',
  'Aoede',
  'Zephyr',
])

export type TtsEngine = 'neural' | 'gemini'
export type TtsLang = 'en' | 'bn'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const WINDOWS_FILE_TIME_EPOCH = 11644473600n
const GEMINI_TTS_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
] as const
const GEMINI_PCM_RATE = 24000
const GEMINI_PCM_CHANNELS = 1
const GEMINI_PCM_SAMPLE_WIDTH = 2

function generateSecMsGecToken() {
  const ticks =
    BigInt(Math.floor(Date.now() / 1000 + Number(WINDOWS_FILE_TIME_EPOCH))) *
    10000000n
  const roundedTicks = ticks - (ticks % 3000000000n)
  const strToHash = `${roundedTicks}${TRUSTED_CLIENT_TOKEN}`
  return createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase()
}

export function rateToEdge(rate: number): string {
  const pct = Math.round((rate - 1) * 100)
  const clamped = Math.max(-40, Math.min(20, pct))
  return clamped >= 0 ? `+${clamped}%` : `${clamped}%`
}

function escapeXml(unsafe: string) {
  return unsafe.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case '"':
        return '&quot;'
      case "'":
        return '&apos;'
      default:
        return c
    }
  })
}

/**
 * Wrap raw PCM (s16le) in a minimal RIFF/WAVE header for browser playback.
 */
export function pcmToWav(
  pcm: Buffer,
  sampleRate = GEMINI_PCM_RATE,
  channels = GEMINI_PCM_CHANNELS,
  sampleWidth = GEMINI_PCM_SAMPLE_WIDTH,
): Buffer {
  const blockAlign = channels * sampleWidth
  const byteRate = sampleRate * blockAlign
  const dataSize = pcm.length
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(sampleWidth * 8, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcm])
}

/**
 * Synthesize Bangla speech via Microsoft Edge read-aloud WebSocket.
 * Returns MP3 bytes in memory (Vercel-friendly, no temp files).
 */
export async function synthesizeBangla(
  text: string,
  voice: string,
  rate: number,
  spokenLang: TtsLang = 'bn',
): Promise<Buffer> {
  const xmlLang = voice.startsWith('bn-BD') ? 'bn-BD' : 'bn-IN'
  const spoken =
    spokenLang === 'en'
      ? `<lang xml:lang="en-US">${escapeXml(text)}</lang>`
      : escapeXml(text)
  const edgeRate = rateToEdge(rate)
  const chromeMajor = CHROMIUM_FULL_VERSION.split('.')[0]
  const wsUrl =
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
    `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${generateSecMsGecToken()}` +
    `&Sec-MS-GEC-Version=1-${CHROMIUM_FULL_VERSION}`

  const chunks: Buffer[] = []

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      host: 'speech.platform.bing.com',
      origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36 Edg/${chromeMajor}.0.0.0`,
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    const timeout = setTimeout(() => {
      try {
        ws.close()
      } catch {
        // ignore
      }
      reject(new Error('TTS timed out'))
    }, 15000)

    const fail = (err: Error) => {
      clearTimeout(timeout)
      try {
        ws.close()
      } catch {
        // ignore
      }
      reject(err)
    }

    ws.on('open', () => {
      ws.send(
        `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: {
                    sentenceBoundaryEnabled: 'false',
                    wordBoundaryEnabled: 'false',
                  },
                  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
                },
              },
            },
          }),
      )

      const requestId = randomBytes(16).toString('hex')
      ws.send(
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n` +
          `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${xmlLang}">` +
          `<voice name="${voice}">` +
          `<prosody rate="${edgeRate}" pitch="default" volume="default">` +
          `${spoken}` +
          `</prosody></voice></speak>`,
      )
    })

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
        const separator = 'Path:audio\r\n'
        const index = buf.indexOf(separator)
        if (index >= 0) {
          chunks.push(buf.subarray(index + separator.length))
        }
        return
      }

      const message = data.toString()
      if (message.includes('Path:turn.end')) {
        clearTimeout(timeout)
        try {
          ws.close()
        } catch {
          // ignore
        }
        resolve()
      }
    })

    ws.on('error', (err) => {
      fail(err instanceof Error ? err : new Error(String(err)))
    })

    ws.on('close', () => {
      // If closed before turn.end with some audio, still resolve
      if (chunks.length > 0) {
        clearTimeout(timeout)
        resolve()
      }
    })
  })

  if (chunks.length === 0) {
    throw new Error('TTS returned no audio')
  }
  return Buffer.concat(chunks)
}

function extractGeminiAudioBase64(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as Record<string, unknown>

  const outputAudio = root.output_audio ?? root.outputAudio
  if (outputAudio && typeof outputAudio === 'object') {
    const data = (outputAudio as Record<string, unknown>).data
    if (typeof data === 'string' && data.length > 0) return data
  }

  // Fallback: generateContent-shaped responses if the API returns that layout.
  const candidates = root.candidates
  if (Array.isArray(candidates) && candidates[0]) {
    const content = (candidates[0] as Record<string, unknown>).content as
      | Record<string, unknown>
      | undefined
    const parts = content?.parts
    if (Array.isArray(parts) && parts[0]) {
      const inline =
        (parts[0] as Record<string, unknown>).inlineData ??
        (parts[0] as Record<string, unknown>).inline_data
      if (inline && typeof inline === 'object') {
        const data = (inline as Record<string, unknown>).data
        if (typeof data === 'string' && data.length > 0) return data
      }
    }
  }

  return null
}

function geminiPrompt(text: string, lang: TtsLang): string {
  if (lang === 'en') {
    return `Speak clearly in English for a young child learning words. Read exactly: «${text}»`
  }
  return `Speak clearly in Bangla for a young child learning words. Read exactly: «${text}»`
}

function geminiLanguageCode(lang: TtsLang): string | undefined {
  return lang === 'en' ? 'en-US' : undefined
}

function isQuotaMessage(message: string, httpStatus: number) {
  return (
    httpStatus === 429 ||
    /quota exceeded|resource exhausted|rate.?limit/i.test(message)
  )
}

async function synthesizeGeminiWithModel(
  model: string,
  text: string,
  voice: string,
  apiKey: string,
  lang: TtsLang,
): Promise<Buffer> {
  const prompt = geminiPrompt(text, lang)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${model}:generateContent`

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
          responseModalities: ['AUDIO'],
          speechConfig: {
            languageCode: geminiLanguageCode(lang),
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        },
      }),
    })

    const bodyText = await res.text()
    if (!res.ok) {
      let message = `Gemini TTS HTTP ${res.status}`
      try {
        const parsed = JSON.parse(bodyText) as {
          error?: { message?: string }
        }
        if (parsed.error?.message) message = parsed.error.message
      } catch {
        if (bodyText.trim()) message = bodyText.slice(0, 200)
      }
      const err = new Error(message) as Error & { status?: number }
      err.status = isQuotaMessage(message, res.status) ? 429 : res.status
      throw err
    }

    let payload: unknown
    try {
      payload = JSON.parse(bodyText)
    } catch {
      throw new Error('Gemini TTS returned invalid JSON')
    }

    const b64 = extractGeminiAudioBase64(payload)
    if (!b64) throw new Error('Gemini TTS returned no audio')

    const pcm = Buffer.from(b64, 'base64')
    if (pcm.length === 0) throw new Error('Gemini TTS returned empty audio')
    return pcmToWav(pcm)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Synthesize speech via Gemini TTS (generateContent).
 * Same prebuilt voice for English and Bangla. Returns WAV bytes.
 * Tries 3.1 first, then 2.5 if that model is rate-limited.
 */
export async function synthesizeGeminiBangla(
  text: string,
  voice: string,
  clientApiKey?: string | null,
  lang: TtsLang = 'bn',
): Promise<Buffer> {
  const apiKey = resolveGeminiApiKey(clientApiKey)
  let lastError: Error | null = null

  for (const model of GEMINI_TTS_MODELS) {
    try {
      return await synthesizeGeminiWithModel(model, text, voice, apiKey, lang)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const status =
        err && typeof err === 'object' && 'status' in err
          ? Number((err as { status?: number }).status)
          : 0
      if (!isQuotaMessage(lastError.message, status)) throw lastError
    }
  }

  const fail = lastError ?? new Error('Gemini TTS failed')
  ;(fail as Error & { status?: number }).status = 429
  throw fail
}

export type TtsRequestParams = {
  text: string
  voice: string
  rate: number
  engine: TtsEngine
  lang: TtsLang
  clientApiKey?: string | null
}

export type TtsResult = {
  audio: Buffer
  contentType: 'audio/mpeg' | 'audio/wav'
}

export function parseTtsParams(searchParams: URLSearchParams):
  | { ok: true; value: TtsRequestParams }
  | { ok: false; status: number; error: string } {
  const text = (searchParams.get('text') ?? '').trim()
  const engineRaw = (searchParams.get('engine') ?? 'gemini').toLowerCase()
  const engine: TtsEngine = engineRaw === 'neural' ? 'neural' : 'gemini'
  const langRaw = (searchParams.get('lang') ?? 'bn').toLowerCase()
  const lang: TtsLang = langRaw === 'en' ? 'en' : 'bn'
  const voice =
    searchParams.get('voice') ??
    (engine === 'gemini' ? 'Leda' : 'bn-IN-TanishaaNeural')
  const rate = Number(searchParams.get('rate') ?? '0.85')

  if (!text) return { ok: false, status: 400, error: 'Missing text' }
  if (text.length > 500) return { ok: false, status: 400, error: 'Text too long' }

  if (engine === 'gemini') {
    if (!ALLOWED_GEMINI_VOICES.has(voice)) {
      return { ok: false, status: 400, error: 'Unsupported voice' }
    }
  } else if (!ALLOWED_EDGE_VOICES.has(voice)) {
    return { ok: false, status: 400, error: 'Unsupported voice' }
  }

  return {
    ok: true,
    value: {
      text,
      voice,
      rate: Number.isFinite(rate) ? rate : 0.85,
      engine,
      lang,
    },
  }
}

export async function synthesizeTts(params: TtsRequestParams): Promise<TtsResult> {
  if (params.engine === 'gemini') {
    const audio = await synthesizeGeminiBangla(
      params.text,
      params.voice,
      params.clientApiKey,
      params.lang,
    )
    return { audio, contentType: 'audio/wav' }
  }
  const audio = await synthesizeBangla(
    params.text,
    params.voice,
    params.rate,
    params.lang,
  )
  return { audio, contentType: 'audio/mpeg' }
}
