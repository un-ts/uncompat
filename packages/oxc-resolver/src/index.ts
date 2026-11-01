/**
 * `@uncompat/oxc-resolver` — a thin compatibility layer over `oxc-resolver`.
 *
 * It keeps `oxc-resolver`'s API and behaviour, and restores two Node.js / CommonJS resolution
 * details that upstream trades for speed:
 *
 * - `LOAD_AS_FILE(DIR/X)` before `LOAD_AS_DIRECTORY(DIR/X)` for a bare package name (oxc-resolver >
 *   #839), so a sibling `node_modules/X.js` wins over `node_modules/X/`.
 * - The entry directory is canonicalized before resolution, like Node does when symlinks are enabled
 *   (oxc-resolver > #848).
 *
 * Anything else — including upstream bug fixes — is delegated to `oxc-resolver`.
 */

import { dirname } from 'node:path'

import { ResolverFactory as OxcResolverFactory, sync as oxcSync } from 'oxc-resolver'
import type { NapiResolveOptions, ResolveResult } from 'oxc-resolver'

import { canonicalizeEntry, preferSiblingFile } from './shims.js'

export type * from 'oxc-resolver'
export { EnforceExtension, ModuleType } from 'oxc-resolver'

const DEFAULT_OPTIONS: NapiResolveOptions = {}

/**
 * Drop-in replacement for `oxc-resolver`'s `ResolverFactory`, with the compatibility shims applied
 * to every resolve call.
 */
export class ResolverFactory {
  readonly #inner: OxcResolverFactory
  readonly #options: NapiResolveOptions

  constructor(options?: NapiResolveOptions | null, inner?: OxcResolverFactory) {
    this.#options = options ?? DEFAULT_OPTIONS
    this.#inner = inner ?? new OxcResolverFactory(this.#options)
  }

  static default(): ResolverFactory {
    return new ResolverFactory()
  }

  cloneWithOptions(options: NapiResolveOptions): ResolverFactory {
    // Reuse the inner factory (and its cache) like the original API does.
    return new ResolverFactory(
      { ...this.#options, ...options },
      this.#inner.cloneWithOptions(options),
    )
  }

  clearCache(): void {
    this.#inner.clearCache()
  }

  sync(directory: string, request: string): ResolveResult {
    const importer = canonicalizeEntry(directory, this.#options)
    return preferSiblingFile(this.#inner.sync(importer, request), importer, request, this.#options)
  }

  async async(directory: string, request: string): Promise<ResolveResult> {
    const importer = canonicalizeEntry(directory, this.#options)
    return preferSiblingFile(
      await this.#inner.async(importer, request),
      importer,
      request,
      this.#options,
    )
  }

  resolveFileSync(file: string, request: string): ResolveResult {
    const importer = dirname(file)
    return preferSiblingFile(
      this.#inner.resolveFileSync(file, request),
      importer,
      request,
      this.#options,
    )
  }

  async resolveFileAsync(file: string, request: string): Promise<ResolveResult> {
    const importer = dirname(file)
    return preferSiblingFile(
      await this.#inner.resolveFileAsync(file, request),
      importer,
      request,
      this.#options,
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
  const importer = canonicalizeEntry(directory, DEFAULT_OPTIONS)
  return preferSiblingFile(oxcSync(importer, request), importer, request, DEFAULT_OPTIONS)
}

const resolve = { sync }

export default resolve
