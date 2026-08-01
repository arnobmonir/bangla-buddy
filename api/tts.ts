import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseTtsParams, synthesizeBangla } from '../server/banglaTts'

export const config = {
  maxDuration: 20,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') params.set(key, value)
      else if (Array.isArray(value) && typeof value[0] === 'string') {
        params.set(key, value[0])
      }
    }

    const parsed = parseTtsParams(params)
    if (!parsed.ok) {
      res.status(parsed.status).json({ error: parsed.error })
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
    res.send(audio)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS failed'
    res.status(502).json({ error: message })
  }
}
