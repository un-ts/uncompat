/**
 * Compatibility shims applied on top of `oxc-resolver`.
 *
 * These exist because `oxc-resolver` deliberately trades some Node.js/CommonJS
 * behaviour for speed. Each shim documents the upstream change it restores.
 */

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';

/** Minimal shape of the options we need for the shims. */
export interface ShimOptions {
  extensions?: string[];
  modules?: string | string[];
  symlinks?: boolean;
  fullySpecified?: boolean;
}

const DEFAULT_EXTENSIONS = ['.js', '.json', '.node'];

/**
 * oxc-resolver > #848 stopped canonicalizing the entry path for speed; Node
 * (and this compatibility layer) resolves the real path of the directory the
 * request starts from when symlinks are enabled.
 */
export function canonicalizeEntry(directory: string, options: ShimOptions): string {
  if (options.symlinks === false) {
    return directory;
  }
  try {
    return realpathSync(directory);
  } catch {
    return directory;
  }
}

/** Whether `request` names a package root (`pkg` or `@scope/pkg`). */
export function isPackageRoot(request: string): boolean {
  if (!request || request.startsWith('.') || request.startsWith('/') || request.startsWith('#')) {
    return false;
  }
  if (/^[a-zA-Z]:[\\/]/.test(request) || request.startsWith('\\')) {
    return false;
  }
  if (request.includes('\\')) {
    return false;
  }
  const segments = request.split('/');
  const expected = request.startsWith('@') ? 2 : 1;
  return segments.length === expected && segments.every(Boolean);
}

/**
 * oxc-resolver > #839 tries `node_modules/X/` before `node_modules/X.js` for a
 * bare package name. The CommonJS spec tries `LOAD_AS_FILE(DIR/X)` first, so a
 * sibling `X.js` must win over `X/index.js` — unless the package declares
 * `exports`, which takes precedence over both.
 */
export function preferSiblingFile<T extends { path?: string; packageJsonPath?: string }>(
  result: T,
  importerDirectory: string,
  request: string,
  options: ShimOptions,
): T {
  if (!result.path || !isPackageRoot(request)) {
    return result;
  }

  const modules = options.modules
    ? Array.isArray(options.modules)
      ? options.modules
      : [options.modules]
    : ['node_modules'];
  const extensions = options.fullySpecified ? [] : (options.extensions ?? DEFAULT_EXTENSIONS);

  for (const moduleDirectory of collectModuleDirectories(importerDirectory, modules)) {
    const packageDirectory = join(moduleDirectory, request);
    if (!result.path.startsWith(packageDirectory + sep)) {
      continue;
    }

    // `exports` beats `LOAD_AS_FILE`, so leave the resolved target alone.
    if (packageDeclaresExports(packageDirectory)) {
      return result;
    }

    for (const extension of extensions) {
      const candidate = join(moduleDirectory, request + extension);
      if (isFile(candidate)) {
        return { ...result, path: candidate, packageJsonPath: undefined };
      }
    }
    // A bare exact file (`node_modules/X`) cannot coexist with a directory of
    // the same name, so there is nothing else to try.
    return result;
  }

  return result;
}

function collectModuleDirectories(start: string, modules: string[]): string[] {
  const directories: string[] = [];
  let current = resolve(start);
  for (;;) {
    for (const module of modules) {
      directories.push(isAbsolute(module) ? module : join(current, module));
    }
    const parent = dirname(current);
    if (parent === current) {
      return directories;
    }
    current = parent;
  }
}

function packageDeclaresExports(packageDirectory: string): boolean {
  const packageJsonPath = join(packageDirectory, 'package.json');
  if (!isFile(packageJsonPath)) {
    return false;
  }
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      exports?: unknown;
    };
    return packageJson.exports !== undefined;
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export { existsSync };
