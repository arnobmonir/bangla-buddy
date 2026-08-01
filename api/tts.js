import { createHash, randomBytes } from 'node:crypto'
import WebSocket from 'ws'

const ALLOWED_VOICES = new Set([
  'bn-IN-TanishaaNeural',
  'bn-IN-BashkarNeural',
  'bn-BD-NabanitaNeural',
  'bn-BD-PradeepNeural',
])

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const WINDOWS_FILE_TIME_EPOCH = 11644473600n

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

function parseTtsParams(query) {
  const text = String(query.text ?? '').trim()
  const voice = String(query.voice ?? 'bn-IN-TanishaaNeural')
  const rate = Number(query.rate ?? '0.85')

  if (!text) return { ok: false, status: 400, error: 'Missing text' }
  if (text.length > 120) return { ok: false, status: 400, error: 'Text too long' }
  if (!ALLOWED_VOICES.has(voice)) {
    return { ok: false, status: 400, error: 'Unsupported voice' }
  }
  return {
    ok: true,
    value: { text, voice, rate: Number.isFinite(rate) ? rate : 0.85 },
  }
}

function synthesizeBangla(text, voice, rate) {
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

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

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

    const parsed = parseTtsParams(req.query ?? {})
    if (!parsed.ok) {
      res.statusCode = parsed.status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: parsed.error }))
      return
    }

    const audio = await synthesizeBangla(
      parsed.value.text,
      parsed.value.voice,
      parsed.value.rate,
    )

    res.statusCode = 200
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.end(audio)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS failed'
    console.error('[api/tts]', message)
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: message }))
  }
}

export const config = {
  maxDuration: 20,
}
