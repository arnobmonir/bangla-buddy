import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { parseTtsParams, synthesizeTts } from '../server/banglaTts.ts'

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

    const result = await synthesizeTts(parsed.value)
    res.statusCode = 200
    res.setHeader('Content-Type', result.contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(result.audio)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS failed'
    const status =
      err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 502
    sendJson(res, status, { error: message })
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
