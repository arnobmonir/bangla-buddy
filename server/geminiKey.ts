/**
 * Prefer server env GEMINI_API_KEY; fall back to a client-provided key
 * (Settings → localStorage) when the env key is missing.
 */
import { ensureGeminiApiKeyFromFiles } from './loadGeminiEnv.ts'

export function resolveGeminiApiKey(clientKey?: string | null): string {
  const fromEnv = ensureGeminiApiKeyFromFiles()
  if (fromEnv) return fromEnv

  const fromClient = typeof clientKey === 'string' ? clientKey.trim() : ''
  if (fromClient) return fromClient

  const err = new Error(
    'GEMINI_API_KEY is not configured. Add it in Settings, or set GEMINI_API_KEY on the server (.env.local / Vercel).',
  ) as Error & { status?: number }
  err.status = 503
  throw err
}

export function readGeminiApiKeyHeader(
  headers: { get?(name: string): string | null | undefined } | Record<string, unknown> | undefined,
): string | undefined {
  if (!headers) return undefined
  if (typeof (headers as { get?: unknown }).get === 'function') {
    const value = (headers as { get(name: string): string | null }).get('x-gemini-api-key')
    return value?.trim() || undefined
  }
  const raw =
    (headers as Record<string, unknown>)['x-gemini-api-key'] ??
    (headers as Record<string, unknown>)['X-Gemini-Api-Key']
  if (typeof raw === 'string') return raw.trim() || undefined
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0].trim() || undefined
  return undefined
}
