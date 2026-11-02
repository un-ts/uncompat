/**
 * `@uncompat/oxc-resolver` — a thin compatibility layer over `oxc-resolver`.
 *
 * It keeps `oxc-resolver`'s API and behaviour, and restores two Node.js / CommonJS resolution
 * details that upstream trades for speed:
 *
 * - `LOAD_AS_FILE(DIR/X)` before `LOAD_AS_DIRECTORY(DIR/X)` for a bare package name (oxc-resolver >
 *   #839), so a sibling `node_modules/X.js` wins over `node_modules/X/`.
 * - The entry path (directory or importer file) is canonicalized before resolution, like Node does
 *   when symlinks are enabled (oxc-resolver > #848).
 *
 * Anything else — including upstream bug fixes — is delegated to `oxc-resolver`.
 */

import { dirname } from 'node:path'

import oxcResolver, { ResolverFactory as OxcResolverFactory, sync as oxcSync } from 'oxc-resolver'
import type { NapiResolveOptions, ResolveResult } from 'oxc-resolver'

import { canonicalizePath, createShimCache, preferSiblingFile } from './shims.ts'
import type { ShimCache } from './shims.ts'

export type * from 'oxc-resolver'
export { EnforceExtension, ModuleType } from 'oxc-resolver'

/**
 * Drop-in replacement for `oxc-resolver`'s `ResolverFactory`, with the compatibility shims applied
 * to every resolve call.
 */
export class ResolverFactory {
  readonly #inner: OxcResolverFactory
  readonly #options: NapiResolveOptions
  readonly #cache: ShimCache = createShimCache()

  /**
   * @param options - Upstream resolve options
   * @param inner - **internal**, used by {@link cloneWithOptions} to reuse the upstream cache and
   *   must not be passed by callers
   */
  constructor(options?: NapiResolveOptions | null, inner?: OxcResolverFactory) {
    this.#options = options ?? {}
    this.#inner = inner ?? new OxcResolverFactory(this.#options)
  }

  static default(): ResolverFactory {
    return new ResolverFactory()
  }

  cloneWithOptions(options: NapiResolveOptions): ResolverFactory {
    // `oxc-resolver` replaces the options (only the cache is shared), so the shims must see the
    // same options object the cloned inner resolver uses.
    return new ResolverFactory(options, this.#inner.cloneWithOptions(options))
  }

  clearCache(): void {
    this.#inner.clearCache()
    this.#cache.realpaths.clear()
    this.#cache.overrides.clear()
  }

  sync(directory: string, request: string): ResolveResult {
    const importer = canonicalizePath(directory, this.#options, this.#cache)
    return preferSiblingFile(
      this.#inner.sync(importer, request),
      importer,
      request,
      this.#options,
      this.#cache,
    )
  }

  async async(directory: string, request: string): Promise<ResolveResult> {
    const importer = canonicalizePath(directory, this.#options, this.#cache)
    return preferSiblingFile(
      await this.#inner.async(importer, request),
      importer,
      request,
      this.#options,
      this.#cache,
    )
  }

  resolveFileSync(file: string, request: string): ResolveResult {
    const canonicalFile = canonicalizePath(file, this.#options, this.#cache)
    const importer = dirname(canonicalFile)
    return preferSiblingFile(
      this.#inner.resolveFileSync(canonicalFile, request),
      importer,
      request,
      this.#options,
      this.#cache,
    )
  }

  async resolveFileAsync(file: string, request: string): Promise<ResolveResult> {
    const canonicalFile = canonicalizePath(file, this.#options, this.#cache)
    const importer = dirname(canonicalFile)
    return preferSiblingFile(
      await this.#inner.resolveFileAsync(canonicalFile, request),
      importer,
      request,
      this.#options,
      this.#cache,
    )
  }

  resolveDtsSync(file: string, request: string): ResolveResult {
    return this.#inner.resolveDtsSync(file, request)
  }

  async resolveDtsAsync(file: string, request: string): Promise<ResolveResult> {
    return this.#inner.resolveDtsAsync(file, request)
  }
}

/** Resolve `request` from `directory`, with the compatibility shims applied. */
export function sync(directory: string, request: string): ResolveResult {
  const cache = createShimCache()
  const importer = canonicalizePath(directory, {}, cache)
  return preferSiblingFile(oxcSync(importer, request), importer, request, {}, cache)
}

/** Default export with the shimmed `sync` and `ResolverFactory` overriding upstream. */
export default { ...oxcResolver, ResolverFactory, sync }
