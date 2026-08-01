import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { parseTtsParams, synthesizeBangla } from '../server/banglaTts.ts'

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

    const parsed = parseTtsParams(url.searchParams)
    if (!parsed.ok) {
      sendJson(res, parsed.status, { error: parsed.error })
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
