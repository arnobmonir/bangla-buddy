#!/usr/bin/env node
/**
 * Merge scripts/vocab-extra.mjs into existing category JSON files,
 * add Bangla numbers 0–100 to mathematics, refresh index word counts.
 *
 * Usage: node scripts/expand-to-2k.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import EXTRA from './vocab-extra.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'src/data')
const categoriesDir = path.join(dataDir, 'categories')

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Bangla names for 0–100 (common BD/IN spellings). */
const BN_0_TO_100 = [
  'শূন্য',
  'এক',
  'দুই',
  'তিন',
  'চার',
  'পাঁচ',
  'ছয়',
  'সাত',
  'আট',
  'নয়',
  'দশ',
  'এগারো',
  'বারো',
  'তেরো',
  'চৌদ্দ',
  'পনেরো',
  'ষোলো',
  'সতেরো',
  'আঠারো',
  'উনিশ',
  'বিশ',
  'একুশ',
  'বাইশ',
  'তেইশ',
  'চব্বিশ',
  'পঁচিশ',
  'ছাব্বিশ',
  'সাতাশ',
  'আটাশ',
  'ঊনত্রিশ',
  'ত্রিশ',
  'একত্রিশ',
  'বত্রিশ',
  'তেত্রিশ',
  'চৌত্রিশ',
  'পঁয়ত্রিশ',
  'ছত্রিশ',
  'সাঁইত্রিশ',
  'আটত্রিশ',
  'ঊনচল্লিশ',
  'চল্লিশ',
  'একচল্লিশ',
  'বিয়াল্লিশ',
  'তেতাল্লিশ',
  'চুয়াল্লিশ',
  'পঁয়তাল্লিশ',
  'ছেচল্লিশ',
  'সাতচল্লিশ',
  'আটচল্লিশ',
  'ঊনপঞ্চাশ',
  'পঞ্চাশ',
  'একান্ন',
  'বায়ান্ন',
  'তিপ্পান্ন',
  'চুয়ান্ন',
  'পঞ্চান্ন',
  'ছাপ্পান্ন',
  'সাতান্ন',
  'আটান্ন',
  'ঊনষাট',
  'ষাট',
  'একষট্টি',
  'বাষট্টি',
  'তেষট্টি',
  'চৌষট্টি',
  'পঁয়ষট্টি',
  'ছেষট্টি',
  'সাতষট্টি',
  'আটষট্টি',
  'ঊনসত্তর',
  'সত্তর',
  'একাত্তর',
  'বাহাত্তর',
  'তিয়াত্তর',
  'চুয়াত্তর',
  'পঁচাত্তর',
  'ছিয়াত্তর',
  'সাতাত্তর',
  'আটাত্তর',
  'ঊনআশি',
  'আশি',
  'একাশি',
  'বিরাশি',
  'তিরাশি',
  'চুরাশি',
  'পঁচাশি',
  'ছিয়াশি',
  'সাতাশি',
  'আটাশি',
  'ঊননব্বই',
  'নব্বই',
  'একানব্বই',
  'বিরানব্বই',
  'তিরানব্বই',
  'চুরানব্বই',
  'পঁচানব্বই',
  'ছিয়ানব্বই',
  'সাতানব্বই',
  'আটানব্বই',
  'নিরানব্বই',
  'একশো',
]

const EN_0_TO_100 = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
  'twenty-one',
  'twenty-two',
  'twenty-three',
  'twenty-four',
  'twenty-five',
  'twenty-six',
  'twenty-seven',
  'twenty-eight',
  'twenty-nine',
  'thirty',
  'thirty-one',
  'thirty-two',
  'thirty-three',
  'thirty-four',
  'thirty-five',
  'thirty-six',
  'thirty-seven',
  'thirty-eight',
  'thirty-nine',
  'forty',
  'forty-one',
  'forty-two',
  'forty-three',
  'forty-four',
  'forty-five',
  'forty-six',
  'forty-seven',
  'forty-eight',
  'forty-nine',
  'fifty',
  'fifty-one',
  'fifty-two',
  'fifty-three',
  'fifty-four',
  'fifty-five',
  'fifty-six',
  'fifty-seven',
  'fifty-eight',
  'fifty-nine',
  'sixty',
  'sixty-one',
  'sixty-two',
  'sixty-three',
  'sixty-four',
  'sixty-five',
  'sixty-six',
  'sixty-seven',
  'sixty-eight',
  'sixty-nine',
  'seventy',
  'seventy-one',
  'seventy-two',
  'seventy-three',
  'seventy-four',
  'seventy-five',
  'seventy-six',
  'seventy-seven',
  'seventy-eight',
  'seventy-nine',
  'eighty',
  'eighty-one',
  'eighty-two',
  'eighty-three',
  'eighty-four',
  'eighty-five',
  'eighty-six',
  'eighty-seven',
  'eighty-eight',
  'eighty-nine',
  'ninety',
  'ninety-one',
  'ninety-two',
  'ninety-three',
  'ninety-four',
  'ninety-five',
  'ninety-six',
  'ninety-seven',
  'ninety-eight',
  'ninety-nine',
  'one hundred',
]

function mathNumberWords() {
  return EN_0_TO_100.map((en, i) => ({
    en,
    bn: BN_0_TO_100[i],
    emoji: i <= 10 ? `${['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][i]}` : undefined,
  }))
}

function normalizeWord(categoryId, raw) {
  const en = String(raw.en || '').trim()
  const bn = String(raw.bn || '').trim()
  if (!en || !bn) return null
  const word = {
    id: `${categoryId}-${slug(en)}`,
    en,
    bn,
  }
  if (raw.emoji) word.emoji = String(raw.emoji)
  if (raw.exampleEn) word.exampleEn = String(raw.exampleEn).trim()
  if (raw.exampleBn) word.exampleBn = String(raw.exampleBn).trim()
  return word
}

function mergeWords(categoryId, existing, extras) {
  const byEn = new Map()
  for (const w of existing) {
    byEn.set(String(w.en).toLowerCase(), w)
  }
  for (const raw of extras) {
    const word = normalizeWord(categoryId, raw)
    if (!word) continue
    const key = word.en.toLowerCase()
    if (byEn.has(key)) {
      const prev = byEn.get(key)
      // Curated bank wins for translation quality
      prev.bn = word.bn
      if (word.emoji) prev.emoji = word.emoji
      if (word.exampleEn) prev.exampleEn = word.exampleEn
      if (word.exampleBn) prev.exampleBn = word.exampleBn
      continue
    }
    byEn.set(key, word)
  }
  return [...byEn.values()]
}

function main() {
  const indexPath = path.join(dataDir, 'index.json')
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))

  let total = 0
  for (const cat of index) {
    const filePath = path.join(categoriesDir, cat.file)
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const extras = [...(EXTRA[cat.id] || [])]
    if (cat.id === 'mathematics') {
      extras.push(...mathNumberWords())
    }
    const words = mergeWords(cat.id, payload.words || [], extras)
    payload.categoryId = cat.id
    payload.words = words
    cat.wordCount = words.length
    total += words.length
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    console.log(`${cat.id}: ${words.length}`)
  }

  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
  console.log(`TOTAL: ${total}`)
  if (total < 2000) {
    console.error(`Expected at least 2000 words, got ${total}`)
    process.exit(1)
  }
}

main()
