import { join } from 'node:path'

import resolve, { ResolverFactory, sync } from '@uncompat/oxc-resolver'
import { expect, test } from 'vitest'

import { canonicalizeEntry, isPackageRoot, preferSiblingFile } from '../src/shims.js'

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

test('directory without a sibling file still resolves as a directory', () => {
  const factory = new ResolverFactory()
  expect(factory.sync(fileOverDir, 'dir-only').path).toBe(
    `${fileOverDir}/node_modules/dir-only/index.js`,
  )
})

test('a package resolved from a parent node_modules keeps its result', () => {
  const factory = new ResolverFactory()
  expect(factory.sync(`${fileOverDir}/nested`, 'bar').path).toBe(
    `${fileOverDir}/node_modules/bar.js`,
  )
})

test('resolveFileSync applies the same file-over-directory ordering', () => {
  const factory = new ResolverFactory()
  expect(factory.resolveFileSync(`${fileOverDir}/app.js`, 'bar').path).toBe(
    `${fileOverDir}/node_modules/bar.js`,
  )
})

test('async and resolveFileAsync apply the same shims', async () => {
  const factory = new ResolverFactory()
  expect((await factory.async(fileOverDir, 'bar')).path).toBe(`${fileOverDir}/node_modules/bar.js`)
  expect((await factory.resolveFileAsync(`${fileOverDir}/app.js`, 'bar')).path).toBe(
    `${fileOverDir}/node_modules/bar.js`,
  )
})

test('factory helpers keep working', () => {
  const factory = ResolverFactory.default()
  const clone = factory.cloneWithOptions({ extensions: ['.js'] })
  clone.clearCache()
  expect(clone.sync(fileOverDir, 'bar').path).toBe(`${fileOverDir}/node_modules/bar.js`)
})

test('delegated dts resolution still runs', async () => {
  const factory = new ResolverFactory()
  expect(factory.resolveDtsSync(`${fileOverDir}/app.js`, 'bar')).toBeDefined()
  expect(await factory.resolveDtsAsync(`${fileOverDir}/app.js`, 'bar')).toBeDefined()
})

test('top-level sync applies the shims', () => {
  expect(sync(fileOverDir, 'bar').path).toBe(`${fileOverDir}/node_modules/bar.js`)
})

test('default export keeps the resolve.sync shape', () => {
  expect(resolve.sync(fileOverDir, 'bar').path).toBe(`${fileOverDir}/node_modules/bar.js`)
})

test('canonicalizeEntry respects symlinks: false and survives missing dirs', () => {
  expect(canonicalizeEntry('/definitely/missing', {})).toBe('/definitely/missing')
  expect(canonicalizeEntry('/definitely/missing', { symlinks: false })).toBe('/definitely/missing')
  const factory = new ResolverFactory({ symlinks: false })
  expect(factory.sync(`${fixtures}/symlink/link`, './index.js').path).toContain('symlink')
})

test('isPackageRoot only accepts package roots', () => {
  expect(isPackageRoot('bar')).toBe(true)
  expect(isPackageRoot('@scope/pkg')).toBe(true)
  expect(isPackageRoot('@scope')).toBe(false)
  expect(isPackageRoot('pkg/sub')).toBe(false)
  expect(isPackageRoot('')).toBe(false)
  expect(isPackageRoot('./rel')).toBe(false)
  expect(isPackageRoot('/abs')).toBe(false)
  expect(isPackageRoot('#imports')).toBe(false)
  expect(isPackageRoot('C:\\pkg')).toBe(false)
  expect(isPackageRoot('a\\b')).toBe(false)
})

test('preferSiblingFile leaves unrelated results alone', () => {
  const result = { path: join(fileOverDir, 'app.js') }
  expect(preferSiblingFile(result, fileOverDir, 'bar', {})).toBe(result)
  const missing = preferSiblingFile({} as { path?: string }, fileOverDir, 'bar', {})
  expect(missing.path).toBeUndefined()
})

test('preferSiblingFile tolerates an unreadable package.json and absolute modules', () => {
  const result = { path: join(fileOverDir, 'node_modules/broken-json/index.js') }
  expect(preferSiblingFile(result, fileOverDir, 'broken-json', {})).toBe(result)
  expect(preferSiblingFile(result, fileOverDir, 'broken-json', { modules: ['/abs'] })).toBe(result)
  expect(preferSiblingFile(result, fileOverDir, './local', {})).toBe(result)
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
