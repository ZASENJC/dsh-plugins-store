import rawCatalogData from '../data/catalog.json'
import rawValidationData from '../data/validation.json'
import { hydrateCatalogValidation, type Catalog } from './catalog'
import { parseValidationFeed } from './validation'

export const catalogData = hydrateCatalogValidation(
  rawCatalogData as Catalog,
  parseValidationFeed(rawValidationData),
)
