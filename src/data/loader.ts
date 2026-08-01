import type { Category, CategoryWords } from '../types/word'
import indexData from './index.json'

const categoryModules = import.meta.glob<{ default: CategoryWords }>(
  './categories/*.json',
)

export function getCategories(): Category[] {
  return indexData as Category[]
}

export function getCategoryById(id: string): Category | undefined {
  return getCategories().find((c) => c.id === id)
}

export async function loadCategoryWords(
  category: Category,
): Promise<CategoryWords> {
  const key = `./categories/${category.file}`
  const loader = categoryModules[key]
  if (!loader) {
    throw new Error(`Category file not found: ${category.file}`)
  }
  const mod = await loader()
  return mod.default
}

export function prefetchCategories(categories: Category[]): void {
  for (const category of categories) {
    const key = `./categories/${category.file}`
    const loader = categoryModules[key]
    if (loader) void loader()
  }
}
