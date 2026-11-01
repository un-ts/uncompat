import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import resolve, { ResolverFactory, sync } from '@uncompat/oxc-resolver'
import { expect, test } from 'vitest'

import { canonicalizePath, isPackageRoot, preferSiblingFile } from '../src/shims.ts'

const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url))
const fileOverDir = join(fixtures, 'file-over-dir')
const inFileOverDir = (...segments: string[]) => join(fileOverDir, ...segments)

test('bare package: node_modules/X.js wins over node_modules/X/', () => {
  const factory = new ResolverFactory()
  expect(factory.sync(fileOverDir, 'bar').path).toBe(inFileOverDir('node_modules', 'bar.js'))
})

test('scoped package: node_modules/@scope/X.js wins over node_modules/@scope/X/', () => {
  const factory = new ResolverFactory()
  expect(factory.sync(fileOverDir, '@scope/pkg').path).toBe(
    inFileOverDir('node_modules', '@scope', 'pkg.js'),
  )
})

test('exports takes precedence over a sibling file', () => {
  const factory = new ResolverFactory()
  expect(factory.sync(fileOverDir, 'with-exports').path).toBe(
    inFileOverDir('node_modules', 'with-exports', 'index.js'),
  )
})

test('directory without a sibling file still resolves as a directory', () => {
  const factory = new ResolverFactory()
  expect(factory.sync(fileOverDir, 'dir-only').path).toBe(
    inFileOverDir('node_modules', 'dir-only', 'index.js'),
  )
})

test('a package resolved from a parent node_modules keeps its result', () => {
  const factory = new ResolverFactory()
  expect(factory.sync(join(fileOverDir, 'nested'), 'bar').path).toBe(
    inFileOverDir('node_modules', 'bar.js'),
  )
})

test('a symlinked package directory still wins over its sibling file', () => {
  const project = join(fixtures, 'symlink-pkg', 'project')
  expect(new ResolverFactory().sync(project, 'bar').path).toBe(
    join(project, 'node_modules', 'bar.js'),
  )
})

test('resolveFileSync applies the same file-over-directory ordering', () => {
  const factory = new ResolverFactory()
  expect(factory.resolveFileSync(join(fileOverDir, 'app.js'), 'bar').path).toBe(
    inFileOverDir('node_modules', 'bar.js'),
  )
})

test('async and resolveFileAsync apply the same shims', async () => {
  const factory = new ResolverFactory()
  expect((await factory.async(fileOverDir, 'bar')).path).toBe(
    inFileOverDir('node_modules', 'bar.js'),
  )
  expect((await factory.resolveFileAsync(join(fileOverDir, 'app.js'), 'bar')).path).toBe(
    inFileOverDir('node_modules', 'bar.js'),
  )
})

test('factory helpers keep working', () => {
  const factory = ResolverFactory.default()
  const clone = factory.cloneWithOptions({ extensions: ['.js'] })
  clone.clearCache()
  expect(clone.sync(fileOverDir, 'bar').path).toBe(inFileOverDir('node_modules', 'bar.js'))
})

test.skipIf(process.platform === 'win32')(
  'cloneWithOptions applies the new options to the shims',
  () => {
    const factory = new ResolverFactory()
    const clone = factory.cloneWithOptions({ symlinks: false })
    const link = join(fixtures, 'symlink', 'link')
    expect(factory.sync(link, './index.js').path).toBe(
      join(fixtures, 'symlink', 'real', 'index.js'),
    )
    expect(clone.sync(link, './index.js').path).toBe(join(fixtures, 'symlink', 'link', 'index.js'))
  },
)

test('delegated dts resolution still runs', async () => {
  const factory = new ResolverFactory()
  expect(factory.resolveDtsSync(join(fileOverDir, 'app.js'), 'bar')).toBeDefined()
  expect(await factory.resolveDtsAsync(join(fileOverDir, 'app.js'), 'bar')).toBeDefined()
})

test('top-level sync applies the shims', () => {
  expect(sync(fileOverDir, 'bar').path).toBe(inFileOverDir('node_modules', 'bar.js'))
})

test('replaced results do not keep directory metadata', () => {
  const result = new ResolverFactory({ moduleType: true }).sync(fileOverDir, 'bar')
  expect(result.path).toBe(inFileOverDir('node_modules', 'bar.js'))
  expect(result.moduleType).toBeUndefined()
  expect(result.packageJsonPath).toBeUndefined()
})

test('modules as a single directory name', () => {
  expect(new ResolverFactory({ modules: 'node_modules' }).sync(fileOverDir, 'bar').path).toBe(
    inFileOverDir('node_modules', 'bar.js'),
  )
})

test('fullySpecified disables the sibling-file scan', () => {
  expect(new ResolverFactory({ fullySpecified: true }).sync(fileOverDir, 'bar').path).toBe(
    inFileOverDir('node_modules', 'bar', 'index.js'),
  )
})

test.skipIf(process.platform === 'win32')(
  'preferSiblingFile survives a looping symlink package directory',
  () => {
    const result = { path: '/definitely/not/here/x.js' }
    expect(preferSiblingFile(result, join(fixtures, 'loop'), 'link', {})).toBe(result)
  },
)

test('default export exposes the shimmed sync and ResolverFactory', () => {
  expect(resolve.sync(fileOverDir, 'bar').path).toBe(inFileOverDir('node_modules', 'bar.js'))
  expect(resolve.ResolverFactory).toBe(ResolverFactory)
  expect(resolve).not.toHaveProperty('default')
})

test('canonicalizePath respects symlinks: false and survives missing paths', () => {
  expect(canonicalizePath('/definitely/missing', {})).toBe('/definitely/missing')
  expect(canonicalizePath('/definitely/missing', { symlinks: false })).toBe('/definitely/missing')
  expect(canonicalizePath('/definitely/missing.js', {})).toBe('/definitely/missing.js')
  expect(canonicalizePath('/definitely/missing.js', { symlinks: false })).toBe(
    '/definitely/missing.js',
  )
  const factory = new ResolverFactory({ symlinks: false })
  expect(factory.sync(join(fixtures, 'symlink', 'link'), './index.js').path).toBe(
    join(fixtures, 'symlink', 'link', 'index.js'),
  )
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
  const result = { path: inFileOverDir('app.js') }
  expect(preferSiblingFile(result, fileOverDir, 'bar', {})).toBe(result)
  const missing = preferSiblingFile({} as { path?: string }, fileOverDir, 'bar', {})
  expect(missing.path).toBeUndefined()
})

test('preferSiblingFile tolerates an unreadable package.json and absolute modules', () => {
  const result = { path: inFileOverDir('node_modules', 'broken-json', 'index.js') }
  expect(preferSiblingFile(result, fileOverDir, 'broken-json', {}).path).toBe(
    inFileOverDir('node_modules', 'broken-json.js'),
  )
  expect(preferSiblingFile(result, fileOverDir, 'broken-json', { modules: ['/abs'] })).toBe(result)
  expect(preferSiblingFile(result, fileOverDir, './local', {})).toBe(result)
})

test.skipIf(process.platform === 'win32')(
  'resolveFile* uses the canonical importer tree',
  async () => {
    const root = join(fixtures, 'symlink-file-pkg')
    const file = join(root, 'project', 'node_modules', 'pkg', 'app.js')
    const expected = join(root, 'store', 'node_modules', 'bar', 'index.js')
    const factory = new ResolverFactory()
    expect(factory.resolveFileSync(file, 'bar').path).toBe(expected)
    expect((await factory.resolveFileAsync(file, 'bar')).path).toBe(expected)
  },
)

test.skipIf(process.platform === 'win32')(
  'resolveFile* canonicalizes a symlinked file importer',
  async () => {
    const root = join(fixtures, 'symlink-file')
    const file = join(root, 'project', 'app.js')
    const expected = join(root, 'store', 'node_modules', 'bar', 'index.js')
    const factory = new ResolverFactory()
    expect(factory.resolveFileSync(file, 'bar').path).toBe(expected)
    expect((await factory.resolveFileAsync(file, 'bar')).path).toBe(expected)
  },
)

test.skipIf(process.platform === 'win32')(
  'entry path is canonicalized when symlinks are enabled',
  () => {
    const factory = new ResolverFactory()
    expect(factory.sync(join(fixtures, 'symlink', 'link'), './index.js').path).toBe(
      join(fixtures, 'symlink', 'real', 'index.js'),
    )
  },
)
