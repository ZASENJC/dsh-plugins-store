import type { ExecutionType } from '../../src/lib/validation-report'
import { parseChannelMockContract } from './p3-validators'

type ValidatorName =
  | 'linux-headless'
  | 'web-playwright'
  | 'channel-mock'
  | 'collection'
  | 'skill-static'
  | 'native-platform'
  | 'non-plugin'

interface ValidatorRoute {
  validator: ValidatorName
  disposition: 'queue' | 'inconclusive' | 'not-applicable'
  code?: string
}

interface ValidatorRouteOptions {
  webTarget?: unknown
  channelContract?: unknown
  collectionManifest?: unknown
}

export function routeValidator(
  executionType: ExecutionType,
  options: ValidatorRouteOptions = {},
): ValidatorRoute {
  if (executionType === 'host-tool' || executionType === 'command') {
    return { validator: 'linux-headless', disposition: 'queue' }
  }
  if (executionType === 'web') {
    return options.webTarget
      ? { validator: 'web-playwright', disposition: 'queue' }
      : { validator: 'web-playwright', disposition: 'inconclusive', code: 'WEB_SMOKE_CONTRACT_REQUIRED' }
  }
  if (executionType === 'channel-mcp') {
    if (!options.channelContract) {
      return { validator: 'channel-mock', disposition: 'inconclusive', code: 'CHANNEL_MOCK_REQUIRED' }
    }
    try {
      parseChannelMockContract(options.channelContract)
      return { validator: 'channel-mock', disposition: 'queue' }
    } catch {
      return { validator: 'channel-mock', disposition: 'inconclusive', code: 'CHANNEL_MOCK_INVALID' }
    }
  }
  if (executionType === 'collection') {
    return options.collectionManifest
      ? { validator: 'collection', disposition: 'queue' }
      : { validator: 'collection', disposition: 'inconclusive', code: 'COLLECTION_MANIFEST_REQUIRED' }
  }
  if (executionType === 'skill') return { validator: 'skill-static', disposition: 'queue' }
  if (executionType === 'native') {
    return { validator: 'native-platform', disposition: 'inconclusive', code: 'PLATFORM_RUNNER_REQUIRED' }
  }
  return { validator: 'non-plugin', disposition: 'not-applicable' }
}
