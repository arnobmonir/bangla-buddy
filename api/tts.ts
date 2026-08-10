import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseTtsParams, synthesizeTts } from '../server/banglaTts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const query = req.query ?? {}
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue
      params.set(key, Array.isArray(value) ? String(value[0]) : String(value))
    }

    const parsed = parseTtsParams(params)
    if (!parsed.ok) {
      res.statusCode = parsed.status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: parsed.error }))
      return
    }

    const result = await synthesizeTts(parsed.value)

    res.statusCode = 200
    res.setHeader('Content-Type', result.contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.end(result.audio)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS failed'
    const status =
      err &&
      typeof err === 'object' &&
      'status' in err &&
      typeof (err as { status: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 502
    console.error('[api/tts]', message)
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: message }))
  }
}

export const config = {
  maxDuration: 20,
}
