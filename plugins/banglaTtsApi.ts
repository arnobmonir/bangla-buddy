import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'
import { EdgeTTS } from 'node-edge-tts'

const ALLOWED_VOICES = new Set([
  'bn-IN-TanishaaNeural',
  'bn-IN-BashkarNeural',
  'bn-BD-NabanitaNeural',
  'bn-BD-PradeepNeural',
])

function rateToEdge(rate: number): string {
  // Map UI 0.6–1.2 → Edge rate percent around -25% … +10%
  const pct = Math.round((rate - 1) * 100)
  const clamped = Math.max(-40, Math.min(20, pct))
  return clamped >= 0 ? `+${clamped}%` : `${clamped}%`
}

async function synthesize(text: string, voice: string, rate: number): Promise<Buffer> {
  const tmp = path.join(
    os.tmpdir(),
    `baby-bangla-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
  )
  const tts = new EdgeTTS({
    voice,
    lang: voice.startsWith('bn-BD') ? 'bn-BD' : 'bn-IN',
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    rate: rateToEdge(rate),
    timeout: 20000,
  })

  try {
    await tts.ttsPromise(text, tmp)
    return fs.readFileSync(tmp)
  } finally {
    fs.promises.unlink(tmp).catch(() => undefined)
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

async function handleTts(
  req: IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) {
  try {
    const host = req.headers.host ?? 'localhost'
    const url = new URL(req.url ?? '/', `http://${host}`)
    if (!url.pathname.endsWith('/api/tts') && url.pathname !== '/api/tts') {
      next()
      return
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
      res.end()
      return
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    const text = (url.searchParams.get('text') ?? '').trim()
    const voice = url.searchParams.get('voice') ?? 'bn-IN-TanishaaNeural'
    const rate = Number(url.searchParams.get('rate') ?? '0.85')

    if (!text) {
      sendJson(res, 400, { error: 'Missing text' })
      return
    }
    if (text.length > 120) {
      sendJson(res, 400, { error: 'Text too long' })
      return
    }
    if (!ALLOWED_VOICES.has(voice)) {
      sendJson(res, 400, { error: 'Unsupported voice' })
      return
    }

    const audio = await synthesize(text, voice, Number.isFinite(rate) ? rate : 0.85)
    res.statusCode = 200
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(audio)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS failed'
    sendJson(res, 502, { error: message })
  }
}

export function banglaTtsApiPlugin(): Plugin {
  return {
    name: 'bangla-tts-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/tts')) {
          void handleTts(req, res, next)
          return
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/tts')) {
          void handleTts(req, res, next)
          return
        }
        next()
      })
    },
  }
}
