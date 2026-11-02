/**
 * Compatibility shims applied on top of `oxc-resolver`.
 *
 * These exist because `oxc-resolver` deliberately trades some Node.js/CommonJS behaviour for speed.
 * Each shim documents the upstream change it restores.
 */

import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'

/** Minimal shape of the options we need for the shims. */
export interface ShimOptions {
  extensions?: string[]
  modules?: string | string[]
  symlinks?: boolean
  fullySpecified?: boolean
  exportsFields?: (string | string[])[]
}

const DEFAULT_EXTENSIONS = ['.js', '.json', '.node']

/**
 * Oxc-resolver > #848 stopped canonicalizing the entry path for speed; Node (and this compatibility
 * layer) resolves the real path of the entry (directory or importer file) when symlinks are
 * enabled.
 */
export function canonicalizePath(path: string, options: ShimOptions): string {
  if (options.symlinks === false) {
    return path
  }
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/** Whether `request` names a package root (`pkg` or `@scope/pkg`). */
export function isPackageRoot(request: string): boolean {
  if (!request || request.startsWith('.') || request.startsWith('/') || request.startsWith('#')) {
    return false
  }
  if (/^[a-zA-Z]:[\\/]/.test(request) || request.startsWith('\\')) {
    return false
  }
  if (request.includes('\\')) {
    return false
  }
  const segments = request.split('/')
  const expected = request.startsWith('@') ? 2 : 1
  return segments.length === expected && segments.every(Boolean)
}

/**
 * Oxc-resolver > #839 tries `node_modules/X/` before `node_modules/X.js` for a bare package name.
 * The CommonJS spec tries `LOAD_AS_FILE(DIR/X)` first, so a sibling `X.js` must win over
 * `X/index.js` — unless the package declares one of the configured `exportsFields` (default
 * `exports`), which takes precedence over both.
 *
 * `moduleType`/`packageJsonPath` describe the discarded directory resolution, so they are cleared
 * when the sibling file wins; computing them for the file is left to `oxc-resolver`, which this
 * layer does not reimplement.
 */
export function preferSiblingFile<T extends { path?: string; packageJsonPath?: string }>(
  result: T,
  importerDirectory: string,
  request: string,
  options: ShimOptions,
): T {
  if (!result.path || !isPackageRoot(request)) {
    return result
  }

  const modules = options.modules
    ? Array.isArray(options.modules)
      ? options.modules
      : [options.modules]
    : ['node_modules']
  const extensions = options.fullySpecified ? [] : (options.extensions ?? DEFAULT_EXTENSIONS)
  const exportsFields = (options.exportsFields ?? ['exports']).map(field =>
    Array.isArray(field) ? field : [field],
  )

  let current = resolve(importerDirectory)
  for (;;) {
    for (const module of modules) {
      const moduleDirectory = isAbsolute(module) ? module : join(current, module)
      const packageDirectory = join(moduleDirectory, request)
      if (!matchesPackage(result.path, packageDirectory)) {
        continue
      }

      // Check the sibling file first: the common case must not pay for a `package.json` read.
      for (const extension of extensions) {
        const candidate = packageDirectory + extension
        if (!isFile(candidate)) {
          continue
        }
        // `exports` beats `LOAD_AS_FILE`; read it once, after a candidate actually exists.
        if (packageDeclaresExports(packageDirectory, exportsFields)) {
          return result
        }
        return { ...result, path: candidate, packageJsonPath: undefined, moduleType: undefined }
      }
      // A bare exact file (`node_modules/X`) cannot coexist with a directory of
      // the same name, so there is nothing else to try.
      return result
    }

    const parent = dirname(current)
    if (parent === current) {
      return result
    }
    current = parent
  }
}

/**
 * Whether the resolved path belongs to `packageDirectory`.
 *
 * The package directory can itself be a symlink (`pnpm`, `npm link`), in which case upstream
 * returns the real path. Only pay for `realpathSync` when the lexical comparison fails.
 */
function matchesPackage(resolvedPath: string, packageDirectory: string): boolean {
  if (resolvedPath.startsWith(packageDirectory + sep)) {
    return true
  }
  // Avoid a thrown ENOENT for every ancestor without such a package; only an existing
  // (possibly symlinked) package directory is worth canonicalizing.
  if (!lstatSync(packageDirectory, { throwIfNoEntry: false })) {
    return false
  }
  try {
    const realPackageDirectory = realpathSync(packageDirectory)
    return (
      realPackageDirectory !== packageDirectory &&
      resolvedPath.startsWith(realPackageDirectory + sep)
    )
  } catch {
    return false
  }
}

function packageDeclaresExports(packageDirectory: string, exportsFields: string[][]): boolean {
  const packageJsonPath = join(packageDirectory, 'package.json')
  if (!isFile(packageJsonPath)) {
    return false
  }
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<string, unknown>
    return exportsFields.some(fieldPath => {
      let value: unknown = packageJson
      for (const key of fieldPath) {
        if (typeof value !== 'object' || value === null) {
          return false
        }
        value = (value as Record<string, unknown>)[key]
      }
      // `null` is not a condition map; Node falls back to file/directory lookup.
      return value !== undefined && value !== null
    })
  } catch {
    return false
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}
