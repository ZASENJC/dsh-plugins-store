import { catalogData } from '../lib/catalog-data'

export const prerender = true

export function GET(): Response {
  return new Response(JSON.stringify(catalogData), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
