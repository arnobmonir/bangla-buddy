#!/usr/bin/env node
/**
 * Convert a CSV of words into category JSON chunks + refresh index.json word counts.
 *
 * CSV columns (header required):
 *   categoryId,categoryNameEn,categoryNameBn,color,icon,en,bn,emoji,exampleEn,exampleBn
 *
 * Usage:
 *   node scripts/csv-to-json.mjs words.csv
 *   node scripts/csv-to-json.mjs words.csv --out src/data
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++
      row.push(cell.trim())
      if (row.some((c) => c.length)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell.length || row.length) {
    row.push(cell.trim())
    if (row.some((c) => c.length)) rows.push(row)
  }
  return rows
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function main() {
  const args = process.argv.slice(2)
  const csvPath = args.find((a) => !a.startsWith('--'))
  const outIdx = args.indexOf('--out')
  const outDir = path.resolve(
    root,
    outIdx >= 0 ? args[outIdx + 1] : 'src/data',
  )

  if (!csvPath) {
    console.error('Usage: node scripts/csv-to-json.mjs <file.csv> [--out src/data]')
    process.exit(1)
  }

  const absoluteCsv = path.resolve(process.cwd(), csvPath)
  const text = fs.readFileSync(absoluteCsv, 'utf8')
  const rows = parseCsv(text)
  if (rows.length < 2) {
    console.error('CSV needs a header row and at least one data row.')
    process.exit(1)
  }

  const header = rows[0].map((h) => h.toLowerCase())
  const col = (name) => header.indexOf(name)

  const required = [
    'categoryid',
    'categorynameen',
    'categorynamebn',
    'color',
    'icon',
    'en',
    'bn',
  ]
  for (const r of required) {
    if (col(r) < 0) {
      console.error(`Missing required column: ${r}`)
      process.exit(1)
    }
  }

  /** @type {Map<string, { meta: object, words: object[] }>} */
  const byCategory = new Map()

  for (const line of rows.slice(1)) {
    const categoryId = line[col('categoryid')]
    const en = line[col('en')]
    const bn = line[col('bn')]
    if (!categoryId || !en || !bn) continue

    if (!byCategory.has(categoryId)) {
      byCategory.set(categoryId, {
        meta: {
          id: categoryId,
          nameEn: line[col('categorynameen')],
          nameBn: line[col('categorynamebn')],
          color: line[col('color')] || '#3db88a',
          icon: line[col('icon')] || '📚',
          wordCount: 0,
          file: `${categoryId}.json`,
        },
        words: [],
      })
    }

    const bucket = byCategory.get(categoryId)
    const emoji = col('emoji') >= 0 ? line[col('emoji')] : ''
    const exampleEn = col('exampleen') >= 0 ? line[col('exampleen')] : ''
    const exampleBn = col('examplebn') >= 0 ? line[col('examplebn')] : ''
    const word = {
      id: `${categoryId}-${slug(en)}`,
      en,
      bn,
    }
    if (emoji) word.emoji = emoji
    if (exampleEn) word.exampleEn = exampleEn
    if (exampleBn) word.exampleBn = exampleBn
    bucket.words.push(word)
  }

  const categoriesDir = path.join(outDir, 'categories')
  fs.mkdirSync(categoriesDir, { recursive: true })

  const index = []
  for (const [id, bucket] of byCategory) {
    bucket.meta.wordCount = bucket.words.length
    index.push(bucket.meta)
    const payload = {
      categoryId: id,
      words: bucket.words,
    }
    fs.writeFileSync(
      path.join(categoriesDir, `${id}.json`),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8',
    )
    console.log(`Wrote ${id}.json (${bucket.words.length} words)`)
  }

  fs.writeFileSync(
    path.join(outDir, 'index.json'),
    `${JSON.stringify(index, null, 2)}\n`,
    'utf8',
  )
  console.log(`Wrote index.json (${index.length} categories)`)
}

main()
