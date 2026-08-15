import { parseSourceDiscovery } from '../../src/lib/source-classification-archive'
import { parseValidationSelection, parseValidationCatalog, type ValidationSelection } from './validation-state'

export interface ValidationInputConsistency {
  generatedAt: string
  discoveryRepositories: number
  validationCatalogRepositories: number
  selectedRepositories: number
}

export function assertValidationInputConsistency(
  rawDiscovery: unknown,
  rawValidationCatalog: unknown,
  rawSelection?: unknown,
): ValidationInputConsistency {
  const discovery = parseSourceDiscovery(rawDiscovery)
  const validationCatalog = parseValidationCatalog(rawValidationCatalog)
  if (discovery.generatedAt !== validationCatalog.generatedAt) {
    throw new Error(`Validation input snapshots are mismatched: discovery=${discovery.generatedAt}, catalog=${validationCatalog.generatedAt}`)
  }

  const discoveryById = new Map(discovery.repositories.map((repository) => [repository.repositoryId, repository]))
  for (const repository of validationCatalog.repositories) {
    const discovered = discoveryById.get(repository.repositoryId)
    if (!discovered) throw new Error(`Validation catalog repository ${repository.repositoryId} is absent from discovery snapshot`)
    if (discovered.pushedAt !== repository.pushedAt) {
      throw new Error(`Validation catalog repository ${repository.repositoryId} pushedAt does not match discovery snapshot`)
    }
  }

  let selection: ValidationSelection | undefined
  if (rawSelection !== undefined) {
    selection = parseValidationSelection(rawSelection)
    if (selection.catalogGeneratedAt !== validationCatalog.generatedAt) {
      throw new Error(`Validation selection catalog is stale: selection=${selection.catalogGeneratedAt}, catalog=${validationCatalog.generatedAt}`)
    }
    const catalogIds = new Set(validationCatalog.repositories.map(({ repositoryId }) => repositoryId))
    for (const repositoryId of selection.repositoryIds) {
      if (!catalogIds.has(repositoryId)) throw new Error(`Validation selection repository ${repositoryId} is absent from validation catalog`)
      if (!discoveryById.has(repositoryId)) throw new Error(`Validation selection repository ${repositoryId} is absent from discovery snapshot`)
    }
    if (selection.shardPlan !== undefined) {
      const plannedIds = new Set(selection.shardPlan.map(({ repositoryId }) => repositoryId))
      if (plannedIds.size !== selection.repositoryIds.length
        || selection.repositoryIds.some((repositoryId) => !plannedIds.has(repositoryId))) {
        throw new Error('Validation selection shard plan is incomplete')
      }
    }
  }

  return {
    generatedAt: validationCatalog.generatedAt,
    discoveryRepositories: discovery.repositories.length,
    validationCatalogRepositories: validationCatalog.repositories.length,
    selectedRepositories: selection?.repositoryIds.length ?? 0,
  }
}
