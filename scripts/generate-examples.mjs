#!/usr/bin/env node
/**
 * Add kid-friendly bilingual use-case sentences to every vocabulary word.
 *
 * Usage:
 *   node scripts/generate-examples.mjs
 *   node scripts/generate-examples.mjs --force   # overwrite existing examples
 *   node scripts/generate-examples.mjs --check   # validate only
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const categoriesDir = path.join(root, 'src/data/categories')
const MAX_BN = 120

const force = process.argv.includes('--force')
const checkOnly = process.argv.includes('--check')

function article(en) {
  const w = en.trim().toLowerCase()
  if (!w) return 'a'
  // Plural-ish / mass / clothing that usually skip a/an
  if (
    /s$/.test(w) &&
    !/(us|ss|is|as|os)$/.test(w) &&
    !['bus', 'glass', 'dress', 'grass', 'kiss'].includes(w)
  ) {
    return ''
  }
  if (
    [
      'pants',
      'shorts',
      'glasses',
      'scissors',
      'clothes',
      'rice',
      'milk',
      'water',
      'bread',
      'tea',
      'coffee',
      'juice',
      'soup',
      'hair',
      'zero',
    ].includes(w)
  ) {
    return ''
  }
  return /^[aeiou]/.test(w) ? 'an' : 'a'
}

function withArticle(en) {
  const a = article(en)
  return a ? `${a} ${en}` : en
}

function capitalize(s) {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function pick(templates, index) {
  return templates[index % templates.length]
}

/** @type {Record<string, Array<(en: string, bn: string) => { exampleEn: string, exampleBn: string }>>} */
const CATEGORY_TEMPLATES = {
  animals: [
    (en, bn) => ({
      exampleEn: `I see ${withArticle(en)}.`,
      exampleBn: `আমি একটি ${bn} দেখছি।`,
    }),
    (en, bn) => ({
      exampleEn: `The ${en} is cute.`,
      exampleBn: `${bn}টা খুব সুন্দর।`,
    }),
    (en, bn) => ({
      exampleEn: `I like ${withArticle(en)}.`,
      exampleBn: `আমার ${bn} ভালো লাগে।`,
    }),
    (en, bn) => ({
      exampleEn: `Look at the ${en}!`,
      exampleBn: `${bn}টা দেখো!`,
    }),
  ],
  food: [
    (en, bn) => ({
      exampleEn: `I want ${withArticle(en)}.`,
      exampleBn: `আমি ${bn} চাই।`,
    }),
    (en, bn) => ({
      exampleEn: `I like ${en}.`,
      exampleBn: `আমার ${bn} ভালো লাগে।`,
    }),
    (en, bn) => ({
      exampleEn: `Please give me ${en}.`,
      exampleBn: `দয়া করে আমাকে ${bn} দাও।`,
    }),
    (en, bn) => ({
      exampleEn: `This ${en} tastes good.`,
      exampleBn: `এই ${bn} ভালো লাগে।`,
    }),
  ],
  colors: [
    (en, bn) => ({
      exampleEn: `This color is ${en}.`,
      exampleBn: `এই রংটা ${bn}।`,
    }),
    (en, bn) => ({
      exampleEn: `I like ${en}.`,
      exampleBn: `আমার ${bn} রং ভালো লাগে।`,
    }),
    (en, bn) => ({
      exampleEn: `My toy is ${en}.`,
      exampleBn: `আমার খেলনা ${bn}।`,
    }),
    (en, bn) => ({
      exampleEn: `The ball is ${en}.`,
      exampleBn: `বলটা ${bn}।`,
    }),
  ],
  family: [
    (en, bn) => ({
      exampleEn: `I love my ${en}.`,
      exampleBn: `আমি আমার ${bn}কে ভালোবাসি।`,
    }),
    (en, bn) => ({
      exampleEn: `This is my ${en}.`,
      exampleBn: `এটা আমার ${bn}।`,
    }),
    (en, bn) => ({
      exampleEn: `Where is my ${en}?`,
      exampleBn: `আমার ${bn} কোথায়?`,
    }),
    (en, bn) => ({
      exampleEn: `My ${en} is kind.`,
      exampleBn: `আমার ${bn} খুব ভালো।`,
    }),
  ],
  body: [
    (en, bn) => ({
      exampleEn: `This is my ${en}.`,
      exampleBn: `এটা আমার ${bn}।`,
    }),
    (en, bn) => ({
      exampleEn: `I wash my ${en}.`,
      exampleBn: `আমি আমার ${bn} ধুই।`,
    }),
    (en, bn) => ({
      exampleEn: `Look at my ${en}.`,
      exampleBn: `আমার ${bn} দেখো।`,
    }),
    (en, bn) => ({
      exampleEn: `My ${en} feels fine.`,
      exampleBn: `আমার ${bn} ভালো আছে।`,
    }),
  ],
  clothes: [
    (en, bn) => ({
      exampleEn: `I wear ${withArticle(en)}.`,
      exampleBn: `আমি ${bn} পরি।`,
    }),
    (en, bn) => ({
      exampleEn: `Please put on your ${en}.`,
      exampleBn: `দয়া করে তোমার ${bn} পরো।`,
    }),
    (en, bn) => ({
      exampleEn: `My ${en} is soft.`,
      exampleBn: `আমার ${bn} নরম।`,
    }),
    (en, bn) => ({
      exampleEn: `I like this ${en}.`,
      exampleBn: `আমার এই ${bn} ভালো লাগে।`,
    }),
  ],
  home: [
    (en, bn) => ({
      exampleEn: `I see ${withArticle(en)}.`,
      exampleBn: `আমি একটি ${bn} দেখছি।`,
    }),
    (en, bn) => ({
      exampleEn: `This is our ${en}.`,
      exampleBn: `এটা আমাদের ${bn}।`,
    }),
    (en, bn) => ({
      exampleEn: `Please open the ${en}.`,
      exampleBn: `দয়া করে ${bn} খোলো।`,
    }),
    (en, bn) => ({
      exampleEn: `The ${en} is clean.`,
      exampleBn: `${bn}টা পরিষ্কার।`,
    }),
  ],
  nature: [
    (en, bn) => ({
      exampleEn: `I see the ${en}.`,
      exampleBn: `আমি ${bn} দেখছি।`,
    }),
    (en, bn) => ({
      exampleEn: `The ${en} is beautiful.`,
      exampleBn: `${bn} খুব সুন্দর।`,
    }),
    (en, bn) => ({
      exampleEn: `I love the ${en}.`,
      exampleBn: `আমি ${bn} ভালোবাসি।`,
    }),
    (en, bn) => ({
      exampleEn: `Look at the ${en}!`,
      exampleBn: `${bn}টা দেখো!`,
    }),
  ],
  transport: [
    (en, bn) => ({
      exampleEn: `Look at the ${en}!`,
      exampleBn: `${bn}টা দেখো!`,
    }),
    (en, bn) => ({
      exampleEn: `The ${en} is fast.`,
      exampleBn: `${bn}টা দ্রুত।`,
    }),
    (en, bn) => ({
      exampleEn: `We go by ${en}.`,
      exampleBn: `আমরা ${bn} করে যাই।`,
    }),
    (en, bn) => ({
      exampleEn: `I see ${withArticle(en)}.`,
      exampleBn: `আমি একটি ${bn} দেখছি।`,
    }),
  ],
  feelings: [
    (en, bn) => ({
      exampleEn: `I feel ${en}.`,
      exampleBn: `আমি ${bn} বোধ করছি।`,
    }),
    (en, bn) => ({
      exampleEn: `I am ${en} today.`,
      exampleBn: `আজ আমি ${bn}।`,
    }),
    (en, bn) => ({
      exampleEn: `Sometimes I feel ${en}.`,
      exampleBn: `মাঝে মাঝে আমি ${bn} হই।`,
    }),
    (en, bn) => ({
      exampleEn: `You look ${en}.`,
      exampleBn: `তুমি ${bn} দেখাচ্ছো।`,
    }),
  ],
  actions: [
    (en, bn) => ({
      exampleEn: `I want to ${en}.`,
      exampleBn: `আমি ${bn} চাই।`,
    }),
    (en, bn) => ({
      exampleEn: `Let's ${en} now.`,
      exampleBn: `চলো এখন ${bn}।`,
    }),
    (en, bn) => ({
      exampleEn: `I like to ${en}.`,
      exampleBn: `আমার ${bn} ভালো লাগে।`,
    }),
    (en, bn) => ({
      exampleEn: `Can you ${en}?`,
      exampleBn: `তুমি কি ${bn} পারো?`,
    }),
  ],
  mathematics: [
    (en, bn) => ({
      exampleEn: `This is ${en}.`,
      exampleBn: `এটা ${bn}।`,
    }),
    (en, bn) => ({
      exampleEn: `I can say ${en}.`,
      exampleBn: `আমি ${bn} বলতে পারি।`,
    }),
    (en, bn) => ({
      exampleEn: `Show me ${en}.`,
      exampleBn: `আমাকে ${bn} দেখাও।`,
    }),
    (en, bn) => ({
      exampleEn: `We learned about ${en}.`,
      exampleBn: `আমরা ${bn} শিখেছি।`,
    }),
  ],
}

const DEFAULT_TEMPLATES = [
  (en, bn) => ({
    exampleEn: `I know the word ${en}.`,
    exampleBn: `আমি ${bn} শব্দটা জানি।`,
  }),
  (en, bn) => ({
    exampleEn: `This is ${en}.`,
    exampleBn: `এটা ${bn}।`,
  }),
  (en, bn) => ({
    exampleEn: `Say ${en} with me.`,
    exampleBn: `আমার সাথে ${bn} বলো।`,
  }),
]

/** Hand-tuned overrides keyed by word id */
const OVERRIDES = {
  'animals-cat': { exampleEn: 'The cat is sleeping.', exampleBn: 'বিড়ালটা ঘুমাচ্ছে।' },
  'animals-dog': { exampleEn: 'The dog is running.', exampleBn: 'কুকুরটা দৌড়াচ্ছে।' },
  'food-rice': { exampleEn: 'I want some rice.', exampleBn: 'আমি একটু ভাত চাই।' },
  'food-milk': { exampleEn: 'Please give me milk.', exampleBn: 'দয়া করে আমাকে দুধ দাও।' },
  'colors-red': { exampleEn: 'The apple is red.', exampleBn: 'আপেলটা লাল।' },
  'colors-blue': { exampleEn: 'The sky is blue.', exampleBn: 'আকাশটা নীল।' },
  'family-mother': { exampleEn: 'I love my mother.', exampleBn: 'আমি আমার মাকে ভালোবাসি।' },
  'family-father': { exampleEn: 'I love my father.', exampleBn: 'আমি আমার বাবাকে ভালোবাসি।' },
  'actions-eat': { exampleEn: 'I want to eat now.', exampleBn: 'আমি এখন খেতে চাই।' },
  'actions-drink': { exampleEn: 'I want to drink water.', exampleBn: 'আমি পানি পান করতে চাই।' },
  'actions-sleep': { exampleEn: 'I want to sleep now.', exampleBn: 'আমি এখন ঘুমাতে চাই।' },
  'feelings-happy': { exampleEn: 'I feel happy today.', exampleBn: 'আজ আমি খুশি।' },
  'feelings-sad': { exampleEn: 'I feel a little sad.', exampleBn: 'আমি একটু দুঃখিত।' },
  'mathematics-one': { exampleEn: 'I have one toy.', exampleBn: 'আমার একটি খেলনা আছে।' },
  'mathematics-two': { exampleEn: 'I have two hands.', exampleBn: 'আমার দুইটি হাত আছে।' },
  'nature-sun': { exampleEn: 'The sun is bright.', exampleBn: 'সূর্যটা উজ্জ্বল।' },
  'nature-moon': { exampleEn: 'The moon is beautiful.', exampleBn: 'চাঁদটা সুন্দর।' },
  'transport-car': { exampleEn: 'We go by car.', exampleBn: 'আমরা গাড়ি করে যাই।' },
  'body-hand': { exampleEn: 'Please wash your hands.', exampleBn: 'দয়া করে হাত ধুয়ে নাও।' },
  'home-door': { exampleEn: 'Please open the door.', exampleBn: 'দয়া করে দরজা খোলো।' },
  'clothes-shirt': { exampleEn: 'I wear a shirt.', exampleBn: 'আমি শার্ট পরি।' },
}

function lemmaInExample(en, exampleEn) {
  const lemma = en.trim().toLowerCase()
  const hay = exampleEn.toLowerCase()
  if (hay.includes(lemma)) return true
  // Soft match: first token for multi-word lemmas
  const first = lemma.split(/\s+/)[0]
  if (first.length >= 3 && hay.includes(first)) return true
  // Verb-ish: eating from eat, running from run (naive)
  if (lemma.length >= 3 && hay.includes(`${lemma}ing`)) return true
  if (lemma.length >= 3 && hay.includes(`${lemma}s`)) return true
  return false
}

function makeExample(categoryId, word, index) {
  if (OVERRIDES[word.id]) {
    return { ...OVERRIDES[word.id] }
  }

  const templates = CATEGORY_TEMPLATES[categoryId] ?? DEFAULT_TEMPLATES
  const build = pick(templates, index)
  const raw = build(word.en.trim(), word.bn.trim())
  return {
    exampleEn: capitalize(raw.exampleEn.trim()),
    exampleBn: raw.exampleBn.trim(),
  }
}

function validateWord(categoryId, word) {
  const issues = []
  const exampleEn = word.exampleEn?.trim() ?? ''
  const exampleBn = word.exampleBn?.trim() ?? ''

  if (!exampleEn) issues.push('missing exampleEn')
  if (!exampleBn) issues.push('missing exampleBn')
  if (exampleBn.length > MAX_BN) issues.push(`exampleBn too long (${exampleBn.length})`)
  if (exampleEn && !lemmaInExample(word.en, exampleEn)) {
    issues.push('exampleEn may not include lemma')
  }
  return issues
}

function processFile(filePath, { write }) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const categoryId = data.categoryId
  const seen = new Map()
  let filled = 0
  let skipped = 0
  const warnings = []

  data.words = data.words.map((word, index) => {
    const hasBoth = Boolean(word.exampleEn?.trim() && word.exampleBn?.trim())
    if (hasBoth && !force) {
      skipped += 1
    } else {
      const next = makeExample(categoryId, word, index)
      word = { ...word, ...next }
      filled += 1
    }

    const key = `${word.exampleEn}|${word.exampleBn}`
    if (seen.has(key)) {
      // Mild de-dupe: rotate to next template
      const alt = makeExample(categoryId, word, index + 7)
      if (`${alt.exampleEn}|${alt.exampleBn}` !== key) {
        word = { ...word, ...alt }
      }
    }
    seen.set(`${word.exampleEn}|${word.exampleBn}`, word.id)

    for (const issue of validateWord(categoryId, word)) {
      warnings.push(`${word.id}: ${issue}`)
    }
    return word
  })

  if (write) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  }

  return { categoryId, total: data.words.length, filled, skipped, warnings }
}

function main() {
  const files = fs
    .readdirSync(categoriesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(categoriesDir, f))

  let totalFilled = 0
  let totalSkipped = 0
  let allWarnings = []

  for (const file of files) {
    const result = processFile(file, { write: !checkOnly })
    totalFilled += result.filled
    totalSkipped += result.skipped
    allWarnings = allWarnings.concat(result.warnings)
    console.log(
      `${result.categoryId}: ${result.total} words` +
        (checkOnly
          ? ` · ${result.warnings.length} warnings`
          : ` · filled ${result.filled}, kept ${result.skipped}`),
    )
  }

  const soft = allWarnings.filter((w) => w.includes('may not include lemma'))
  const hard = allWarnings.filter((w) => !w.includes('may not include lemma'))

  if (hard.length) {
    console.error(`\nHard validation issues (${hard.length}):`)
    for (const w of hard.slice(0, 40)) console.error(`  - ${w}`)
    if (hard.length > 40) console.error(`  … and ${hard.length - 40} more`)
    process.exitCode = 1
  }

  if (soft.length) {
    console.warn(`\nSoft lemma warnings (${soft.length}) — templates still usable.`)
  }

  console.log(
    `\nDone. ${checkOnly ? 'Checked' : 'Updated'} ${files.length} categories` +
      (checkOnly ? '' : ` · wrote ${totalFilled}, preserved ${totalSkipped}`),
  )
}

main()
