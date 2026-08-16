import { readFileSync } from 'node:fs'

const SKILL_URL = new URL('../skills/search-dsh-store/SKILL.md', import.meta.url)
const FRONTMATTER_BOUNDARY = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/

function frontmatterValue(frontmatter, key) {
  const prefix = `${key}:`
  const line = frontmatter.split(/\r?\n/).find((entry) => entry.startsWith(prefix))
  if (line === undefined) throw new Error(`Bundled store skill is missing ${key}`)
  const value = line.slice(prefix.length).trim()
  if (value.length === 0) throw new Error(`Bundled store skill has an empty ${key}`)
  return value
}

export function parseBundledStoreSkill(markdown) {
  const match = FRONTMATTER_BOUNDARY.exec(markdown)
  if (match === null) throw new Error('Bundled store skill has invalid frontmatter')

  return {
    name: frontmatterValue(match[1], 'name'),
    description: frontmatterValue(match[1], 'description'),
    source: 'bundled',
    content: match[2].trim(),
  }
}

export function loadBundledStoreSkill() {
  return parseBundledStoreSkill(readFileSync(SKILL_URL, 'utf8'))
}
