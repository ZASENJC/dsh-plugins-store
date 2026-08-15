import {
  normalizeTopic,
  classifyRepository,
} from './classification'
import type { GitHubRepository } from './catalog'

export type SearchRepository = GitHubRepository

export const DISCOVERY_QUERY = 'topic:dsh-plugin topic:deepseek-harness archived:false fork:false'
export const SEARCH_PAGE_SIZE = 100

export function buildSearchQuery(page: number): URLSearchParams {
  return new URLSearchParams({
    q: DISCOVERY_QUERY,
    sort: 'stars',
    order: 'desc',
    per_page: String(SEARCH_PAGE_SIZE),
    page: String(page),
  })
}

export function filterEligibleRepositories(repositories: SearchRepository[]): SearchRepository[] {
  return repositories.filter((repository) => {
    const topics = new Set(repository.topics.map(normalizeTopic))
    if (!topics.has('dsh-plugin') || !topics.has('deepseek-harness')) return false
    if (repository.archived || repository.fork) return false

    const classification = classifyRepository({
      fullName: repository.full_name,
      name: repository.name,
      description: repository.description ?? '',
      topics: repository.topics,
    })
    return classification.projectType !== 'application'
  })
}
