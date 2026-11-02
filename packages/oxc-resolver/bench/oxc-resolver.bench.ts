import { fileURLToPath } from 'node:url'

import { ResolverFactory as UncompatResolverFactory } from '@uncompat/oxc-resolver'
import { ResolverFactory as OxcResolverFactory } from 'oxc-resolver'
import { ResolverFactory as UnrsResolverFactory } from 'unrs-resolver'
import { expect, test } from 'vitest'

const fixtures = fileURLToPath(new URL('./fixtures/bench', import.meta.url))

const cases = [
  ['file-over-dir', 'bar'],
  ['scoped', '@scope/pkg'],
  ['directory', 'dir-only'],
  ['exports', 'with-exports'],
] as const

for (const [name, request] of cases) {
  // oxlint-disable-next-line vitest/valid-title -- titles come from the table above
  test(name, async ({ bench }) => {
    const uncompat = new UncompatResolverFactory()
    const oxc = new OxcResolverFactory()
    const unrs = new UnrsResolverFactory()

    const results = await bench.compare(
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
    expect(results.get('oxc-resolver')).toBeDefined()
  })
}
