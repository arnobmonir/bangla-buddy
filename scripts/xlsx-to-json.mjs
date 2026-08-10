#!/usr/bin/env node
/**
 * Import english_bangla_1000_practical_words_for_kids.xlsx into category JSON.
 *
 * - Parses xlsx via zip/XML (no extra dependency)
 * - Replaces all category files under src/data/categories/
 * - Rebuilds src/data/index.json
 * - Assigns emojis from existing data + curated map (UI falls back to category icon)
 *
 * Usage:
 *   node scripts/xlsx-to-json.mjs
 *   node scripts/xlsx-to-json.mjs path/to/file.xlsx [--out src/data]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

/** @type {Record<string, { id: string, nameEn: string, nameBn: string, color: string, icon: string }>} */
const CATEGORY_META = {
  Action: {
    id: 'actions',
    nameEn: 'Actions',
    nameBn: 'ক্রিয়া',
    color: '#118ab2',
    icon: '🏃',
  },
  Animal: {
    id: 'animals',
    nameEn: 'Animals',
    nameBn: 'প্রাণী',
    color: '#3db88a',
    icon: '🐾',
  },
  'Food and Drink': {
    id: 'food',
    nameEn: 'Food and Drink',
    nameBn: 'খাবার',
    color: '#e07a2f',
    icon: '🍎',
  },
  Colour: {
    id: 'colors',
    nameEn: 'Colors',
    nameBn: 'রং',
    color: '#e85d4c',
    icon: '🎨',
  },
  'Family and People': {
    id: 'family',
    nameEn: 'Family and People',
    nameBn: 'পরিবার',
    color: '#f0a202',
    icon: '👨‍👩‍👧',
  },
  'Feeling and Manners': {
    id: 'feelings',
    nameEn: 'Feelings and Manners',
    nameBn: 'অনুভূতি',
    color: '#e63946',
    icon: '😊',
  },
  'Nature and Weather': {
    id: 'nature',
    nameEn: 'Nature and Weather',
    nameBn: 'প্রকৃতি',
    color: '#2f9e6b',
    icon: '🌿',
  },
  Clothing: {
    id: 'clothes',
    nameEn: 'Clothes',
    nameBn: 'পোশাক',
    color: '#2a9d8f',
    icon: '👕',
  },
  Home: {
    id: 'home',
    nameEn: 'Home',
    nameBn: 'বাড়ি',
    color: '#d46b9c',
    icon: '🏠',
  },
  Body: {
    id: 'body',
    nameEn: 'Body',
    nameBn: 'শরীর',
    color: '#5b8def',
    icon: '🧍',
  },
  Transport: {
    id: 'transport',
    nameEn: 'Transport',
    nameBn: 'যানবাহন',
    color: '#457b9d',
    icon: '🚗',
  },
  Number: {
    id: 'numbers',
    nameEn: 'Numbers',
    nameBn: 'সংখ্যা',
    color: '#7c6cf0',
    icon: '🔢',
  },
  School: {
    id: 'school',
    nameEn: 'School',
    nameBn: 'স্কুল',
    color: '#264653',
    icon: '📚',
  },
  Place: {
    id: 'places',
    nameEn: 'Places',
    nameBn: 'স্থান',
    color: '#6a994e',
    icon: '📍',
  },
  'Sports and Play': {
    id: 'sports',
    nameEn: 'Sports and Play',
    nameBn: 'খেলা',
    color: '#f77f00',
    icon: '⚽',
  },
  'Health and Safety': {
    id: 'health',
    nameEn: 'Health and Safety',
    nameBn: 'স্বাস্থ্য',
    color: '#e76f51',
    icon: '🩺',
  },
  'Technology and Daily Object': {
    id: 'technology',
    nameEn: 'Technology',
    nameBn: 'প্রযুক্তি',
    color: '#4a5568',
    icon: '📱',
  },
  'Music and Art': {
    id: 'arts',
    nameEn: 'Music and Art',
    nameBn: 'শিল্প',
    color: '#9b5de5',
    icon: '🎨',
  },
  'Month and Day': {
    id: 'calendar',
    nameEn: 'Month and Day',
    nameBn: 'দিন মাস',
    color: '#00bbf9',
    icon: '📅',
  },
  'Pronoun and Basic Grammar': {
    id: 'grammar',
    nameEn: 'Grammar',
    nameBn: 'ব্যাকরণ',
    color: '#8338ec',
    icon: '🔤',
  },
  Adjective: {
    id: 'adjectives',
    nameEn: 'Adjectives',
    nameBn: 'বিশেষণ',
    color: '#fb5607',
    icon: '✨',
  },
  'Position and Question': {
    id: 'positions',
    nameEn: 'Positions',
    nameBn: 'অবস্থান',
    color: '#3a86ff',
    icon: '🧭',
  },
  'Community and World': {
    id: 'community',
    nameEn: 'Community',
    nameBn: 'সমাজ',
    color: '#2ec4b6',
    icon: '🌍',
  },
  'Common Word': {
    id: 'common',
    nameEn: 'Common Words',
    nameBn: 'সাধারণ শব্দ',
    color: '#8d99ae',
    icon: '💬',
  },
  'Additional Practical Word': {
    id: 'practical',
    nameEn: 'Practical Words',
    nameBn: 'প্রায়োগিক শব্দ',
    color: '#6d597a',
    icon: '🧰',
  },
  'Extra Practical Noun': {
    id: 'extra-nouns',
    nameEn: 'Extra Nouns',
    nameBn: 'অতিরিক্ত বিশেষ্য',
    color: '#b56576',
    icon: '📦',
  },
}

/** Extra emojis for words unlikely to exist in the old dataset. */
const CURATED_EMOJI = {
  ask: '❓',
  break: '💔',
  bring: '🚚',
  build: '🏗️',
  buy: '🛒',
  carry: '📦',
  catch: '⚾',
  choose: '👆',
  clean: '🧹',
  climb: '🧗',
  close: '🚪',
  cook: '👨‍🍳',
  count: '🔢',
  cry: '😢',
  cut: '✂️',
  dance: '💃',
  draw: '✏️',
  drink: '🥤',
  drive: '🚗',
  eat: '🍽️',
  fall: '⬇️',
  find: '🔍',
  fly: '✈️',
  give: '🎁',
  go: '🚶',
  help: '🤝',
  hide: '🙈',
  hold: '🤲',
  hop: '🐰',
  hug: '🤗',
  jump: '🦘',
  kick: '🦵',
  laugh: '😂',
  learn: '📖',
  listen: '👂',
  look: '👀',
  open: '📂',
  play: '🎮',
  pull: '🪢',
  push: '🫸',
  read: '📖',
  run: '🏃',
  say: '🗣️',
  see: '👁️',
  sing: '🎤',
  sit: '🪑',
  sleep: '😴',
  smile: '😄',
  stand: '🧍',
  stop: '🛑',
  swim: '🏊',
  talk: '💬',
  teach: '👨‍🏫',
  throw: '🤾',
  touch: '👆',
  walk: '🚶',
  wash: '🧼',
  watch: '⌚',
  write: '✍️',
  angry: '😠',
  bad: '👎',
  beautiful: '🌸',
  big: '🐘',
  brave: '🦸',
  bright: '💡',
  careful: '⚠️',
  cold: '🥶',
  dark: '🌑',
  dirty: '🦠',
  dry: '🏜️',
  early: '🌅',
  easy: '👌',
  empty: '🫙',
  fast: '⚡',
  fat: '🍩',
  full: '🥣',
  funny: '🤣',
  good: '👍',
  happy: '😊',
  hard: '🪨',
  heavy: '🏋️',
  high: '⬆️',
  hot: '🔥',
  hungry: '😋',
  kind: '💛',
  late: '⏰',
  light: '💡',
  little: '🐭',
  long: '📏',
  loud: '🔊',
  low: '⬇️',
  new: '🆕',
  nice: '🥰',
  old: '🧓',
  quiet: '🤫',
  rich: '💰',
  sad: '😢',
  short: '📌',
  sick: '🤒',
  slow: '🐢',
  small: '🐜',
  soft: '🧸',
  strong: '💪',
  tall: '🦒',
  thin: '📏',
  thirsty: '💧',
  tired: '😩',
  warm: '☀️',
  weak: '🫠',
  wet: '💦',
  young: '👶',
  hello: '👋',
  goodbye: '👋',
  please: '🙏',
  thanks: '🙏',
  'thank you': '🙏',
  'excuse me': '🙇',
  sorry: '😔',
  yes: '✅',
  no: '❌',
  monday: '📅',
  tuesday: '📅',
  wednesday: '📅',
  thursday: '📅',
  friday: '📅',
  saturday: '📅',
  sunday: '📅',
  january: '❄️',
  february: '💝',
  march: '🌱',
  april: '☔',
  may: '🌸',
  june: '☀️',
  july: '🌞',
  august: '🏖️',
  september: '🍂',
  october: '🎃',
  november: '🍁',
  december: '🎄',
  birthday: '🎂',
  holiday: '🎉',
  today: '📅',
  tomorrow: '⏭️',
  yesterday: '⏮️',
  week: '📆',
  month: '🗓️',
  year: '📅',
  school: '🏫',
  teacher: '👩‍🏫',
  student: '👨‍🎓',
  book: '📖',
  pen: '🖊️',
  pencil: '✏️',
  eraser: '🧽',
  bag: '🎒',
  backpack: '🎒',
  board: '📋',
  chalk: '🖍️',
  desk: '🪑',
  chair: '🪑',
  class: '🏫',
  homework: '📝',
  exam: '📋',
  test: '📝',
  answer: '💡',
  question: '❓',
  circle: '⭕',
  square: '⬜',
  triangle: '🔺',
  line: '➖',
  zero: '0️⃣',
  one: '1️⃣',
  two: '2️⃣',
  three: '3️⃣',
  four: '4️⃣',
  five: '5️⃣',
  six: '6️⃣',
  seven: '7️⃣',
  eight: '8️⃣',
  nine: '9️⃣',
  ten: '🔟',
  eleven: '1️⃣1️⃣',
  twelve: '1️⃣2️⃣',
  thirteen: '1️⃣3️⃣',
  fourteen: '1️⃣4️⃣',
  fifteen: '1️⃣5️⃣',
  sixteen: '1️⃣6️⃣',
  seventeen: '1️⃣7️⃣',
  eighteen: '1️⃣8️⃣',
  nineteen: '1️⃣9️⃣',
  twenty: '2️⃣0️⃣',
  thirty: '3️⃣0️⃣',
  forty: '4️⃣0️⃣',
  fifty: '5️⃣0️⃣',
  sixty: '6️⃣0️⃣',
  seventy: '7️⃣0️⃣',
  eighty: '8️⃣0️⃣',
  ninety: '9️⃣0️⃣',
  hundred: '💯',
  first: '🥇',
  second: '🥈',
  third: '🥉',
  cricket: '🏏',
  football: '⚽',
  soccer: '⚽',
  basketball: '🏀',
  baseball: '⚾',
  hockey: '🏒',
  tennis: '🎾',
  cycling: '🚴',
  swimming: '🏊',
  'hide and seek': '🙈',
  'board game': '🎲',
  blocks: '🧱',
  toy: '🧸',
  doll: '🪆',
  ball: '⚽',
  hospital: '🏥',
  doctor: '👨‍⚕️',
  nurse: '👩‍⚕️',
  medicine: '💊',
  bandage: '🩹',
  cough: '😷',
  fever: '🤒',
  burn: '🔥',
  crosswalk: '🚸',
  ambulance: '🚑',
  phone: '📱',
  camera: '📷',
  computer: '💻',
  laptop: '💻',
  internet: '🌐',
  email: '📧',
  call: '📞',
  calendar: '📅',
  clock: '🕐',
  fan: '🌀',
  'air conditioner': '❄️',
  broom: '🧹',
  bin: '🗑️',
  dryer: '💨',
  washer: '🧺',
  television: '📺',
  tv: '📺',
  radio: '📻',
  music: '🎵',
  song: '🎶',
  drum: '🥁',
  flute: '🪈',
  guitar: '🎸',
  piano: '🎹',
  drawing: '✏️',
  craft: '🎨',
  coloring: '🖍️',
  clay: '🏺',
  bead: '📿',
  'glue stick': '🧴',
  paint: '🎨',
  bangladesh: '🇧🇩',
  bangla: '🇧🇩',
  english: '🔤',
  canada: '🇨🇦',
  eid: '🌙',
  coin: '🪙',
  dollar: '💵',
  age: '🎂',
  city: '🏙️',
  village: '🏡',
  beach: '🏖️',
  park: '🏞️',
  market: '🛒',
  shop: '🏪',
  bakery: '🥐',
  bank: '🏦',
  church: '⛪',
  mosque: '🕌',
  temple: '🛕',
  clinic: '🏥',
  library: '📚',
  airport: '✈️',
  station: '🚉',
  'bus stop': '🚏',
  bedroom: '🛏️',
  bathroom: '🚿',
  kitchen: '🍳',
  garden: '🌱',
  after: '➡️',
  before: '⬅️',
  again: '🔁',
  all: '🌐',
  down: '⬇️',
  up: '⬆️',
  far: '🔭',
  near: '📍',
  few: '🤏',
  front: '➡️',
  back: '⬅️',
  left: '⬅️',
  right: '➡️',
  inside: '📥',
  outside: '📤',
  under: '⬇️',
  over: '⬆️',
  between: '↔️',
  beside: '↔️',
  who: '👤',
  what: '❓',
  when: '⏰',
  where: '📍',
  why: '🤔',
  how: '❔',
  i: '👤',
  you: '👆',
  he: '👨',
  she: '👩',
  we: '👥',
  they: '👥',
  it: '📦',
  am: '🔤',
  is: '🔤',
  are: '🔤',
  and: '➕',
  but: '➖',
  because: '💭',
  can: '💪',
  do: '✅',
  have: '🙌',
  rain: '🌧️',
  sun: '☀️',
  cloud: '☁️',
  wind: '💨',
  snow: '❄️',
  storm: '⛈️',
  morning: '🌅',
  afternoon: '🌤️',
  evening: '🌆',
  night: '🌙',
  day: '☀️',
  earth: '🌍',
  moon: '🌕',
  star: '⭐',
  tree: '🌳',
  flower: '🌸',
  leaf: '🍃',
  branch: '🌿',
  river: '🏞️',
  sea: '🌊',
  mountain: '⛰️',
  sky: '🌌',
  air: '💨',
  autumn: '🍂',
  spring: '🌱',
  summer: '☀️',
  winter: '❄️',
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function normalizeKey(s) {
  return String(s).trim().toLowerCase()
}

/** Minimal ZIP reader using the central directory (handles data descriptors). */
function readZipEntries(buffer) {
  // Find End of Central Directory (EOCD)
  let eocd = -1
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Invalid ZIP: EOCD not found')

  const cdOffset = buffer.readUInt32LE(eocd + 16)
  const cdCount = buffer.readUInt16LE(eocd + 10)

  const entries = new Map()
  let offset = cdOffset
  for (let n = 0; n < cdCount; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid ZIP: bad central directory signature')
    }
    const compression = buffer.readUInt16LE(offset + 10)
    const compSize = buffer.readUInt32LE(offset + 20)
    const nameLen = buffer.readUInt16LE(offset + 28)
    const extraLen = buffer.readUInt16LE(offset + 30)
    const commentLen = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLen)
      .toString('utf8')

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid ZIP: bad local header for ${name}`)
    }
    const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26)
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
    const compressed = buffer.subarray(dataStart, dataStart + compSize)

    let data
    if (compression === 0) {
      data = compressed
    } else if (compression === 8) {
      data = inflateRawSync(compressed)
    } else {
      throw new Error(`Unsupported ZIP compression ${compression} for ${name}`)
    }

    entries.set(name, data)
    offset += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function parseXmlLocalNames(xml) {
  // Strip namespaces for simpler matching: <a:b> → <b>
  return xml.replace(/<\/?[a-z0-9]+:/gi, (m) => m.replace(/[a-z0-9]+:/i, ''))
}

function parseSharedStrings(xml) {
  const cleaned = parseXmlLocalNames(xml)
  const strings = []
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi
  let m
  while ((m = siRe.exec(cleaned))) {
    const texts = []
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/gi
    let tm
    while ((tm = tRe.exec(m[1]))) {
      texts.push(decodeXml(tm[1]))
    }
    strings.push(texts.join(''))
  }
  return strings
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function colLettersToIndex(letters) {
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function parseSheetRows(xml, sharedStrings) {
  const cleaned = parseXmlLocalNames(xml)
  const rows = []
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi
  let rm
  while ((rm = rowRe.exec(cleaned))) {
    const cells = []
    const cRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/gi
    let cm
    while ((cm = cRe.exec(rm[1]))) {
      const attrs = cm[1] || cm[3] || ''
      const body = cm[2] || ''
      const refM = /\br="([A-Z]+)(\d+)"/i.exec(attrs)
      if (!refM) continue
      const colIdx = colLettersToIndex(refM[1].toUpperCase())
      const typeM = /\bt="([^"]+)"/.exec(attrs)
      const type = typeM ? typeM[1] : ''
      const vM = /<v>([\s\S]*?)<\/v>/.exec(body)
      const isM = /<is>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>/.exec(body)
      let val = ''
      if (type === 'inlineStr' && isM) {
        val = decodeXml(isM[1])
      } else if (vM) {
        val = decodeXml(vM[1])
        if (type === 's') val = sharedStrings[Number(val)] ?? ''
      }
      cells[colIdx] = val
    }
    rows.push(cells)
  }
  return rows
}

function loadExistingEmojiMap(categoriesDir) {
  /** @type {Map<string, string>} */
  const map = new Map()
  if (!fs.existsSync(categoriesDir)) return map

  for (const file of fs.readdirSync(categoriesDir)) {
    if (!file.endsWith('.json')) continue
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(categoriesDir, file), 'utf8'),
      )
      for (const word of data.words ?? []) {
        if (word?.en && word?.emoji) {
          const key = normalizeKey(word.en)
          if (!map.has(key)) map.set(key, word.emoji)
        }
      }
    } catch {
      // ignore corrupt files
    }
  }
  return map
}

function resolveEmoji(en, emojiMap) {
  const key = normalizeKey(en)
  return emojiMap.get(key) || CURATED_EMOJI[key] || ''
}

function parseXlsx(filePath) {
  const buffer = fs.readFileSync(filePath)
  const entries = readZipEntries(buffer)

  const ssXml = entries.get('xl/sharedStrings.xml')
  const sharedStrings = ssXml
    ? parseSharedStrings(ssXml.toString('utf8'))
    : []

  const sheetName =
    [...entries.keys()].find((k) => k === 'xl/worksheets/sheet1.xml') ||
    [...entries.keys()].find((k) => k.startsWith('xl/worksheets/sheet'))

  if (!sheetName) throw new Error('No worksheet found in xlsx')

  const sheetXml = entries.get(sheetName).toString('utf8')
  return parseSheetRows(sheetXml, sharedStrings)
}

function main() {
  const args = process.argv.slice(2)
  const fileArg = args.find((a) => !a.startsWith('--'))
  const outIdx = args.indexOf('--out')
  const outDir = path.resolve(
    root,
    outIdx >= 0 ? args[outIdx + 1] : 'src/data',
  )
  const xlsxPath = path.resolve(
    root,
    fileArg || 'english_bangla_1000_practical_words_for_kids.xlsx',
  )

  if (!fs.existsSync(xlsxPath)) {
    console.error(`File not found: ${xlsxPath}`)
    process.exit(1)
  }

  const categoriesDir = path.join(outDir, 'categories')
  const emojiMap = loadExistingEmojiMap(categoriesDir)
  for (const [k, v] of Object.entries(CURATED_EMOJI)) {
    if (!emojiMap.has(k)) emojiMap.set(k, v)
  }

  const rows = parseXlsx(xlsxPath)
  if (rows.length < 2) {
    console.error('XLSX needs a header row and at least one data row.')
    process.exit(1)
  }

  const header = rows[0].map((h) => normalizeKey(h || ''))
  const col = (name) => header.indexOf(name)

  const idxCategory = col('category')
  const idxEn = col('english word')
  const idxBn = col('bangla word')
  const idxExampleBn = col('bangla sentence')
  const idxExampleEn = col('english sentence')

  for (const [label, idx] of [
    ['Category', idxCategory],
    ['English Word', idxEn],
    ['Bangla Word', idxBn],
  ]) {
    if (idx < 0) {
      console.error(`Missing required column: ${label}`)
      process.exit(1)
    }
  }

  /** @type {Map<string, { meta: object, words: object[], seen: Set<string> }>} */
  const byCategory = new Map()
  const unknownCategories = new Set()
  let imported = 0
  let withEmoji = 0

  for (const line of rows.slice(1)) {
    const categoryLabel = (line[idxCategory] || '').trim()
    const en = (line[idxEn] || '').trim()
    const bn = (line[idxBn] || '').trim()
    if (!categoryLabel || !en || !bn) continue

    const meta = CATEGORY_META[categoryLabel]
    if (!meta) {
      unknownCategories.add(categoryLabel)
      continue
    }

    if (!byCategory.has(meta.id)) {
      byCategory.set(meta.id, {
        meta: {
          id: meta.id,
          nameEn: meta.nameEn,
          nameBn: meta.nameBn,
          color: meta.color,
          icon: meta.icon,
          wordCount: 0,
          file: `${meta.id}.json`,
        },
        words: [],
        seen: new Set(),
      })
    }

    const bucket = byCategory.get(meta.id)
    const wordId = `${meta.id}-${slug(en)}`
    if (bucket.seen.has(wordId)) {
      // keep first occurrence
      continue
    }
    bucket.seen.add(wordId)

    const exampleEn =
      idxExampleEn >= 0 ? String(line[idxExampleEn] || '').trim() : ''
    const exampleBn =
      idxExampleBn >= 0 ? String(line[idxExampleBn] || '').trim() : ''
    const emoji = resolveEmoji(en, emojiMap)

    const word = { id: wordId, en, bn }
    if (emoji) {
      word.emoji = emoji
      withEmoji++
    }
    if (exampleEn) word.exampleEn = exampleEn
    if (exampleBn) word.exampleBn = exampleBn

    bucket.words.push(word)
    imported++
  }

  if (unknownCategories.size) {
    console.error(
      'Unknown categories in Excel (add to CATEGORY_META):',
      [...unknownCategories].join(', '),
    )
    process.exit(1)
  }

  fs.mkdirSync(categoriesDir, { recursive: true })

  // Remove old category JSON files not in the new set
  const keep = new Set([...byCategory.keys()].map((id) => `${id}.json`))
  for (const file of fs.readdirSync(categoriesDir)) {
    if (!file.endsWith('.json')) continue
    if (!keep.has(file)) {
      fs.unlinkSync(path.join(categoriesDir, file))
      console.log(`Deleted obsolete ${file}`)
    }
  }

  const index = []
  for (const [id, bucket] of byCategory) {
    bucket.meta.wordCount = bucket.words.length
    index.push(bucket.meta)
    const payload = { categoryId: id, words: bucket.words }
    fs.writeFileSync(
      path.join(categoriesDir, `${id}.json`),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8',
    )
    console.log(`Wrote ${id}.json (${bucket.words.length} words)`)
  }

  // Stable order: follow CATEGORY_META declaration order
  const order = Object.values(CATEGORY_META).map((m) => m.id)
  index.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))

  fs.writeFileSync(
    path.join(outDir, 'index.json'),
    `${JSON.stringify(index, null, 2)}\n`,
    'utf8',
  )

  console.log(`Wrote index.json (${index.length} categories)`)
  console.log(
    `Imported ${imported} words; ${withEmoji} with emoji; ${imported - withEmoji} use category icon fallback`,
  )
}

main()
