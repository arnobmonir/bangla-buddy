/**
 * Vercel serverless TTS handler (CommonJS).
 * Kept as .cjs because package.json has "type": "module", and loading `ws`
 * inside an ESM serverless bundle often causes FUNCTION_INVOCATION_FAILED.
 */
const { createHash, randomBytes } = require('node:crypto')

const ALLOWED_EDGE_VOICES = new Set([
  'bn-IN-TanishaaNeural',
  'bn-IN-BashkarNeural',
  'bn-BD-NabanitaNeural',
  'bn-BD-PradeepNeural',
])

const ALLOWED_GEMINI_VOICES = new Set([
  'Leda',
  'Achernar',
  'Puck',
  'Kore',
  'Aoede',
  'Zephyr',
])

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const WINDOWS_FILE_TIME_EPOCH = 11644473600n
const GEMINI_TTS_MODEL = 'gemini-3.1-flash-tts-preview'
const GEMINI_PCM_RATE = 24000

function generateSecMsGecToken() {
  const ticks =
    BigInt(Math.floor(Date.now() / 1000 + Number(WINDOWS_FILE_TIME_EPOCH))) *
    10000000n
  const roundedTicks = ticks - (ticks % 3000000000n)
  const strToHash = `${roundedTicks}${TRUSTED_CLIENT_TOKEN}`
  return createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase()
}

function rateToEdge(rate) {
  const pct = Math.round((rate - 1) * 100)
  const clamped = Math.max(-40, Math.min(20, pct))
  return clamped >= 0 ? `+${clamped}%` : `${clamped}%`
}

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&"']/g, (c) => {
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

function pcmToWav(pcm, sampleRate = GEMINI_PCM_RATE, channels = 1, sampleWidth = 2) {
  const blockAlign = channels * sampleWidth
  const byteRate = sampleRate * blockAlign
  const dataSize = pcm.length
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(sampleWidth * 8, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcm])
}

function extractGeminiAudioBase64(payload) {
  if (!payload || typeof payload !== 'object') return null

  const outputAudio = payload.output_audio ?? payload.outputAudio
  if (outputAudio && typeof outputAudio === 'object' && typeof outputAudio.data === 'string') {
    return outputAudio.data
  }

  const candidates = payload.candidates
  if (Array.isArray(candidates) && candidates[0]) {
    const parts = candidates[0]?.content?.parts
    if (Array.isArray(parts) && parts[0]) {
      const inline = parts[0].inlineData ?? parts[0].inline_data
      if (inline && typeof inline.data === 'string') return inline.data
    }
  }

  return null
}

function parseTtsParams(query) {
  const text = String(query.text ?? '').trim()
  const engineRaw = String(query.engine ?? 'neural').toLowerCase()
  const engine = engineRaw === 'gemini' ? 'gemini' : 'neural'
  const voice = String(
    query.voice ?? (engine === 'gemini' ? 'Leda' : 'bn-IN-TanishaaNeural'),
  )
  const rate = Number(query.rate ?? '0.85')

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
    },
  }
}

function synthesizeBangla(text, voice, rate) {
  // Lazy-load so Gemini requests don't need ws if Edge path isn't used.
  const WebSocket = require('ws')
  const lang = voice.startsWith('bn-BD') ? 'bn-BD' : 'bn-IN'
  const edgeRate = rateToEdge(rate)
  const chromeMajor = CHROMIUM_FULL_VERSION.split('.')[0]
  const wsUrl =
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
    `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${generateSecMsGecToken()}` +
    `&Sec-MS-GEC-Version=1-${CHROMIUM_FULL_VERSION}`

  const chunks = []

  return new Promise((resolve, reject) => {
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

    const fail = (err) => {
      clearTimeout(timeout)
      try {
        ws.close()
      } catch {
        // ignore
      }
      reject(err instanceof Error ? err : new Error(String(err)))
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
          `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}">` +
          `<voice name="${voice}">` +
          `<prosody rate="${edgeRate}" pitch="default" volume="default">` +
          `${escapeXml(text)}` +
          `</prosody></voice></speak>`,
      )
    })

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
        const separator = 'Path:audio\r\n'
        const index = buf.indexOf(separator)
        if (index >= 0) chunks.push(buf.subarray(index + separator.length))
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

    ws.on('error', fail)

    ws.on('close', () => {
      if (chunks.length > 0) {
        clearTimeout(timeout)
        resolve()
      }
    })
  }).then(() => {
    if (chunks.length === 0) throw new Error('TTS returned no audio')
    return Buffer.concat(chunks)
  })
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

async function synthesizeGeminiBangla(text, voice, clientApiKey) {
  const apiKey = resolveGeminiApiKey(clientApiKey)

  const prompt =
    `Speak clearly in Bangla for a young child learning words. Read exactly: «${text}»`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`,
      {
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
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voice,
                },
              },
            },
          },
        }),
      },
    )

    const bodyText = await res.text()
    if (!res.ok) {
      let message = `Gemini TTS HTTP ${res.status}`
      try {
        const parsed = JSON.parse(bodyText)
        if (parsed?.error?.message) message = parsed.error.message
      } catch {
        if (bodyText.trim()) message = bodyText.slice(0, 200)
      }
      throw new Error(message)
    }

    let payload
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

module.exports = async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key')

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    if (req.method !== 'GET') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }

    const query = {}
    for (const [key, value] of Object.entries(req.query ?? {})) {
      if (value == null) continue
      query[key] = Array.isArray(value) ? String(value[0]) : String(value)
    }

    const parsed = parseTtsParams(query)
    if (!parsed.ok) {
      res.statusCode = parsed.status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: parsed.error }))
      return
    }

    let audio
    let contentType
    if (parsed.value.engine === 'gemini') {
      audio = await synthesizeGeminiBangla(
        parsed.value.text,
        parsed.value.voice,
        readGeminiApiKeyHeader(req),
      )
      contentType = 'audio/wav'
    } else {
      audio = await synthesizeBangla(
        parsed.value.text,
        parsed.value.voice,
        parsed.value.rate,
      )
      contentType = 'audio/mpeg'
    }

    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.end(audio)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS failed'
    const status = typeof err?.status === 'number' ? err.status : 502
    console.error('[api/tts]', message)
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: message }))
  }
}

module.exports.config = {
  maxDuration: 20,
}
