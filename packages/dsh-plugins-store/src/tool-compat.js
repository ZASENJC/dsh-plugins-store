export function registerCompatibleStoreTools(registry, definitions) {
  const registered = []

  for (const definition of definitions) {
    if (registry.get(definition.name) !== undefined) continue
    registry.register(definition)
    registered.push(definition)
  }

  return registered
}
