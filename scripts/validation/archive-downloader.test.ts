import { describe, expect, it, vi } from 'vitest'

import { buildArchiveExtractionCommand, downloadPinnedArchive } from './archive-downloader'

describe('fixed-SHA archive acquisition', () => {
  it('builds a non-root, networkless extraction container without host runtime access', () => {
    const command = buildArchiveExtractionCommand(
      '/tmp/repository.tar.gz',
      '/tmp/source',
      { uid: 1001, gid: 121 },
    )

    expect(command.file).toBe('docker')
    expect(command.args).toEqual(expect.arrayContaining([
      '--network=none',
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--user=1001:121',
      'alpine:3.22.1',
      'tar',
    ]))
    expect(command.args.join(' ')).not.toContain('/var/run/docker.sock')
    expect(command.args.join(' ')).not.toMatch(/sh -c|bash -c/)
    expect(command.args).toContain('type=bind,src=/tmp/repository.tar.gz,dst=/archive/repository.tar.gz,readonly')
    expect(command.args).toContain('type=bind,src=/tmp/source,dst=/output')
  })

  it('downloads only the numeric repository and exact 40-character SHA endpoint', async () => {
    const sha = 'c'.repeat(40)
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-length': '3' },
    }))
    const writeArchive = vi.fn(async () => undefined)

    await downloadPinnedArchive({
      repositoryId: 42,
      sourceSha: sha,
      destinationPath: '/tmp/repository.tar.gz',
      fetchImpl,
      writeArchive,
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      `https://api.github.com/repositories/42/tarball/${sha}`,
      expect.objectContaining({ redirect: 'follow' }),
    )
    expect(writeArchive).toHaveBeenCalledWith('/tmp/repository.tar.gz', expect.any(Uint8Array))
  })

  it('rejects invalid SHA input before making a network request', async () => {
    const fetchImpl = vi.fn()

    await expect(downloadPinnedArchive({
      repositoryId: 42,
      sourceSha: 'main',
      destinationPath: '/tmp/repository.tar.gz',
      fetchImpl,
    })).rejects.toThrow('SHA')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
