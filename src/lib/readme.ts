export interface ReadmeLocation {
  fullName: string
  defaultBranch: string
  readmePath: string
}

export function getReadmeApiUrl(fullName: string): string {
  const repositoryPath = fullName.split('/').map(encodeURIComponent).join('/')
  return `https://api.github.com/repos/${repositoryPath}/readme`
}

export function resolveReadmeReference(
  reference: string,
  repository: ReadmeLocation,
  kind: 'link' | 'media',
): string {
  if (reference.startsWith('#')) return reference
  const root = kind === 'media'
    ? `https://raw.githubusercontent.com/${repository.fullName}/${repository.defaultBranch}/`
    : `https://github.com/${repository.fullName}/blob/${repository.defaultBranch}/`
  return new URL(reference, new URL(repository.readmePath, root)).href
}
