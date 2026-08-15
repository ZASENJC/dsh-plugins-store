import rawCatalogData from '../data/catalog.json'
import { hydrateCatalogValidation, type Catalog } from './catalog'

// sync-github.ts has already merged source classification and validation
// conclusions into this generated catalog. The legacy validation feed must not
// be able to overwrite that archive-backed result during the site build.
export const catalogData = hydrateCatalogValidation(rawCatalogData as Catalog)
