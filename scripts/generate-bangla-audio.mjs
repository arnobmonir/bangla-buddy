#!/usr/bin/env node
/**
 * Generate neural Bangla MP3 files via Microsoft Edge TTS.
 * English stays on Web Speech; Bangla plays these files (much clearer).
 *
 * Usage:
 *   node scripts/generate-bangla-audio.mjs
 *   node scripts/generate-bangla-audio.mjs --force
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EdgeTTS } from 'node-edge-tts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'src/data')
const outDir = path.join(root, 'public/audio/bn')
const force = process.argv.includes('--force')

const VOICE = 'bn-IN-TanishaaNeural'
const LANG = 'bn-IN'
const DELAY_MS = 120

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function loadWords() {
  const index = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'index.json'), 'utf8'),
  )
  const words = []
  for (const cat of index) {
    const file = path.join(dataDir, 'categories', cat.file)
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'))
    for (const word of payload.words) {
      words.push(word)
    }
  }
  return words
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const words = loadWords()
  const tts = new EdgeTTS({
    voice: VOICE,
    lang: LANG,
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    rate: '-10%',
    timeout: 20000,
  })

  let done = 0
  let skipped = 0
  let failed = 0

  console.log(`Generating Bangla audio for ${words.length} words…`)
  console.log(`Voice: ${VOICE}`)

  for (const word of words) {
    const outPath = path.join(outDir, `${word.id}.mp3`)
    if (!force && fs.existsSync(outPath) && fs.statSync(outPath).size > 500) {
      skipped++
      continue
    }

    try {
      await tts.ttsPromise(word.bn, outPath)
      done++
      process.stdout.write(`\r  ok ${done + skipped}/${words.length}: ${word.id}   `)
      await sleep(DELAY_MS)
    } catch (err) {
      failed++
      console.error(`\nFailed ${word.id} (${word.bn}):`, err?.message ?? err)
      await sleep(500)
    }
  }

  console.log(
    `\nDone. generated=${done} skipped=${skipped} failed=${failed} → ${outDir}`,
  )
  if (failed > 0) process.exitCode = 1
}

main()
