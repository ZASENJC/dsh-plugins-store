import { describe, expect, it } from 'vitest'

import { routeValidator } from './validator-router'

describe('P2/P3 validator routing', () => {
  it.each([
    ['host-tool', {}, { validator: 'linux-headless', disposition: 'queue' }],
    ['command', {}, { validator: 'linux-headless', disposition: 'queue' }],
    ['web', { webTarget: { packageName: 'fixture', expectedSelector: 'body' } }, { validator: 'web-playwright', disposition: 'queue' }],
    ['collection', { collectionManifest: { members: [] } }, { validator: 'collection', disposition: 'queue' }],
    ['skill', {}, { validator: 'skill-static', disposition: 'queue' }],
    ['native', {}, { validator: 'native-platform', disposition: 'inconclusive', code: 'PLATFORM_RUNNER_REQUIRED' }],
    ['non-plugin', {}, { validator: 'non-plugin', disposition: 'not-applicable' }],
  ])('routes %s to its owned validator', (executionType, options, expected) => {
    expect(routeValidator(executionType as never, options)).toMatchObject(expected)
  })

  it('does not queue a channel plugin without an explicit safe mock contract', () => {
    expect(routeValidator('channel-mcp', {})).toEqual({
      validator: 'channel-mock',
      disposition: 'inconclusive',
      code: 'CHANNEL_MOCK_REQUIRED',
    })
    expect(routeValidator('channel-mcp', {
      channelContract: {
        protocol: 'http',
        endpointEnv: 'DSH_CHANNEL_ENDPOINT',
        request: { method: 'POST', path: '/messages' },
        response: { status: 200, body: { ok: true } },
        smokeCommand: ['node', 'validation/channel-smoke.mjs'],
        requiresCredentials: false,
      },
    })).toMatchObject({ validator: 'channel-mock', disposition: 'queue' })
  })
})
