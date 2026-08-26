import { loadEnv } from 'vite'

/**
 * Vite 8 evaluates `defineConfig` separately from the middleware process, so
 * assigning `process.env` in vite.config.ts does not reach /api/tts.
 * Read `.env` / `.env.local` here, in the server process.
 */
export function ensureGeminiApiKeyFromFiles(): string {
  const existing = process.env.GEMINI_API_KEY?.trim()
  if (existing) return existing

  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
  const fromFile = loadEnv(mode, process.cwd(), '').GEMINI_API_KEY?.trim() ?? ''
  if (fromFile) process.env.GEMINI_API_KEY = fromFile
  return fromFile
}
