import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ResolverFactory as UncompatResolverFactory } from '@uncompat/oxc-resolver'
import { ResolverFactory as OxcResolverFactory } from 'oxc-resolver'
import { ResolverFactory as UnrsResolverFactory } from 'unrs-resolver'
import { expect, test } from 'vitest'

const fixtures = fileURLToPath(new URL('../test/fixtures/file-over-dir', import.meta.url))

const cases = [
  ['file-over-dir', 'bar', 'bar.js'],
  ['scoped', '@scope/pkg', '@scope/pkg.js'],
  ['directory', 'dir-only', 'dir-only/index.js'],
  ['exports', 'with-exports', 'with-exports/index.js'],
] as const

for (const [name, request, expected] of cases) {
  // oxlint-disable-next-line vitest/valid-title -- titles come from the table above
  test(name, async ({ bench }) => {
    const uncompat = new UncompatResolverFactory()
    const oxc = new OxcResolverFactory()
    const unrs = new UnrsResolverFactory()
    const expectedPath = join(fixtures, 'node_modules', expected)

    // Guard the fixture tree so a missing sibling cannot silently reduce the benchmark to a no-op.
    // Upstream oxc-resolver intentionally resolves directory-first, so only assert the shim here.
    expect(uncompat.sync(fixtures, request).path).toBe(expectedPath)

    await bench.compare(
      bench('@uncompat/oxc-resolver', () => {
        uncompat.sync(fixtures, request)
      }),
      bench('oxc-resolver', () => {
        oxc.sync(fixtures, request)
      }),
      bench('unrs-resolver', () => {
        unrs.sync(fixtures, request)
      }),
    )
  })
}

test('cold (cache cleared per iteration)', async ({ bench }) => {
  const uncompat = new UncompatResolverFactory()
  const oxc = new OxcResolverFactory()
  const unrs = new UnrsResolverFactory()
  const request = 'bar'

  expect(uncompat.sync(fixtures, request).path).toBe(join(fixtures, 'node_modules', 'bar.js'))

  await bench.compare(
    bench('@uncompat/oxc-resolver', { beforeEach: () => uncompat.clearCache() }, () => {
      uncompat.sync(fixtures, request)
    }),
    bench('oxc-resolver', { beforeEach: () => oxc.clearCache() }, () => {
      oxc.sync(fixtures, request)
    }),
    bench('unrs-resolver', { beforeEach: () => unrs.clearCache() }, () => {
      unrs.sync(fixtures, request)
    }),
  )
})
