import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import {
  parseTranslateBody,
  translateEnglishToBangla,
} from '../server/translate.ts'
import { readGeminiApiKeyHeader } from '../server/geminiKey.ts'

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function handleTranslate(
  req: IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) {
  try {
    const host = req.headers.host ?? 'localhost'
    const url = new URL(req.url ?? '/', `http://${host}`)
    if (
      !url.pathname.endsWith('/api/translate') &&
      url.pathname !== '/api/translate'
    ) {
      next()
      return
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key')
      res.end()
      return
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    let raw: unknown
    try {
      const body = await readBody(req)
      raw = body ? JSON.parse(body) : null
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' })
      return
    }

    const parsed = parseTranslateBody(raw)
    if (!parsed.ok) {
      sendJson(res, parsed.status, { error: parsed.error })
      return
    }

    const result = await translateEnglishToBangla(
      parsed.value,
      readGeminiApiKeyHeader(req.headers),
    )
    sendJson(res, 200, result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translate failed'
    const status =
      err &&
      typeof err === 'object' &&
      'status' in err &&
      typeof (err as { status: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 502
    sendJson(res, status, { error: message })
  }
}

export function translateApiPlugin(): Plugin {
  return {
    name: 'translate-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/translate')) {
          void handleTranslate(req, res, next)
          return
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/translate')) {
          void handleTranslate(req, res, next)
          return
        }
        next()
      })
    },
  }
}
