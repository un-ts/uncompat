import resolve, { ResolverFactory, sync } from '@uncompat/oxc-resolver'
import { expect, test } from 'vitest'

const fixtures = new URL('./fixtures', import.meta.url).pathname
const fileOverDir = `${fixtures}/file-over-dir`

test('bare package: node_modules/X.js wins over node_modules/X/', () => {
  const factory = new ResolverFactory()
  expect(factory.sync(fileOverDir, 'bar').path).toBe(`${fileOverDir}/node_modules/bar.js`)
})

test('scoped package: node_modules/@scope/X.js wins over node_modules/@scope/X/', () => {
  const factory = new ResolverFactory()
  expect(factory.sync(fileOverDir, '@scope/pkg').path).toBe(
    `${fileOverDir}/node_modules/@scope/pkg.js`,
  )
})

test('exports takes precedence over a sibling file', () => {
  const factory = new ResolverFactory()
  expect(factory.sync(fileOverDir, 'with-exports').path).toBe(
    `${fileOverDir}/node_modules/with-exports/index.js`,
  )
})

test('resolveFileSync applies the same file-over-directory ordering', () => {
  const factory = new ResolverFactory()
  expect(factory.resolveFileSync(`${fileOverDir}/app.js`, 'bar').path).toBe(
    `${fileOverDir}/node_modules/bar.js`,
  )
})

test('top-level sync applies the shims', () => {
  expect(sync(fileOverDir, 'bar').path).toBe(`${fileOverDir}/node_modules/bar.js`)
})

test('default export keeps the resolve.sync shape', () => {
  expect(resolve.sync(fileOverDir, 'bar').path).toBe(`${fileOverDir}/node_modules/bar.js`)
})

test.skipIf(process.platform === 'win32')(
  'entry directory is canonicalized when symlinks are enabled',
  () => {
    const factory = new ResolverFactory()
    expect(factory.sync(`${fixtures}/symlink/link`, './index.js').path).toBe(
      `${fixtures}/symlink/real/index.js`,
    )
  },
)
