import type { Word } from '../types/word'

export type QuizChoice = {
  bn: string
  wordId: string
  correct: boolean
}

export type QuizQuestion = {
  word: Word
  choices: QuizChoice[]
}

export const QUIZ_ROUND_SIZE = 10

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

function sampleDistinct<T>(items: T[], count: number): T[] {
  if (items.length <= count) return shuffleInPlace([...items])
  return shuffleInPlace([...items]).slice(0, count)
}

/**
 * Build a short quiz round: English lemma prompt + 4 Bangla choices.
 * Distractors come from the same category; duplicate Bangla strings are skipped.
 */
export function buildQuizRound(
  words: Word[],
  count = QUIZ_ROUND_SIZE,
): QuizQuestion[] {
  const usable = words.filter((w) => w.en?.trim() && w.bn?.trim())
  if (usable.length < 2) return []

  const questionCount = Math.min(count, usable.length)
  const prompts = sampleDistinct(usable, questionCount)

  return prompts.map((word) => {
    const correctBn = word.bn.trim()
    const distractorPool = usable.filter(
      (w) => w.id !== word.id && w.bn.trim() !== correctBn,
    )
    // Prefer unique Bangla strings
    const byBn = new Map<string, Word>()
    for (const w of distractorPool) {
      const key = w.bn.trim()
      if (!byBn.has(key)) byBn.set(key, w)
    }
    const distractors = sampleDistinct([...byBn.values()], 3)

    const choices: QuizChoice[] = [
      { bn: correctBn, wordId: word.id, correct: true },
      ...distractors.map((w) => ({
        bn: w.bn.trim(),
        wordId: w.id,
        correct: false,
      })),
    ]

    // If category is tiny, pad with whatever remains (still unique when possible)
    while (choices.length < 4 && distractorPool.length > choices.length - 1) {
      const leftover = distractorPool.find(
        (w) => !choices.some((c) => c.wordId === w.id || c.bn === w.bn.trim()),
      )
      if (!leftover) break
      choices.push({ bn: leftover.bn.trim(), wordId: leftover.id, correct: false })
    }

    return {
      word,
      choices: shuffleInPlace(choices),
    }
  })
}

export function starCount(score: number, total: number): number {
  if (total <= 0) return 0
  const ratio = score / total
  if (ratio >= 0.9) return 3
  if (ratio >= 0.6) return 2
  if (ratio >= 0.3) return 1
  return 0
}
