# Bangla Buddy

A small, mobile-first website that teaches Bangla from English — one word at a time, with automated text-to-speech.

## Features

- Category grid (animals, food, family, numbers, …)
- One-by-one word player with English → Bangla speech
- English: device Web Speech
- Bangla: **on-demand neural TTS** (Edge) with **IndexedDB cache** — no 5k MP3 bundle
- Controls: volume, speed, delay, mute, voice, neural/device engine, clear cache
- Chunked JSON data ready to scale toward ~5k words

## Why not ship 5k audio files?

At ~12 KB/word, 5k clips would be ~60 MB. Instead:

1. Fetch Bangla audio only when a word is played (`/api/tts`)
2. Cache that clip on the device
3. Replay from cache next time (no re-download)

Space grows only with words the baby actually hears.

## Run

```bash
npm install
npm run dev
```

Neural Bangla needs the TTS API:
- Local: Vite middleware (`npm run dev` / `npm run preview`)
- Vercel: serverless route at `/api/tts` (`api/tts.ts`)

## Deploy (Vercel)

Connect the repo and deploy. No env vars required for Edge TTS.

After deploy, Bangla audio should load from:

`https://<your-app>.vercel.app/api/tts?text=...&voice=bn-BD-NabanitaNeural&rate=0.85`

## Optional: pre-generate offline clips

```bash
npm run generate-audio
```

Writes MP3s under `public/audio/bn/` (gitignored). Prefer on-demand + cache for 5k scale.

## Grow to 5k words

```bash
npm run import-words -- path/to/words.csv
```

CSV columns: `categoryId,categoryNameEn,categoryNameBn,color,icon,en,bn,emoji,roman`

## Stack

Vite + React + TypeScript · Web Speech (EN) · Edge TTS API (BN) · IndexedDB cache · static JSON
# bangla-buddy
