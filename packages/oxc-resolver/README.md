# @uncompat/oxc-resolver

A thin compatibility layer over [`oxc-resolver`](https://www.npmjs.com/package/oxc-resolver).

> Unofficial. Not affiliated with oxc-project.

It keeps `oxc-resolver`'s API and behaviour, and restores two Node.js / CommonJS
resolution details that upstream trades for speed:

- `LOAD_AS_FILE(DIR/X)` is tried before `LOAD_AS_DIRECTORY(DIR/X)` for a bare
  package name, so a sibling `node_modules/X.js` wins over `node_modules/X/`
  (unless the package declares `exports`, which takes precedence over both).
- the entry path is canonicalized before resolution, like Node does when
  symlinks are enabled.

Everything else — including upstream bug fixes — comes from `oxc-resolver`.

Requires Node.js 14.18 or later (the effective floor of `oxc-resolver`'s loader plus `node:`-prefixed `require`).

## TOC <!-- omit in toc -->

- [Usage](#usage)
  - [Install](#install)
  - [API](#api)
- [Limitations](#limitations)
- [Sponsors and Backers](#sponsors-and-backers)
  - [Sponsors](#sponsors)
  - [Backers](#backers)
- [Changelog](#changelog)
- [License](#license)

## Usage

### Install

```sh
# npm
npm i @uncompat/oxc-resolver

# yarn
yarn add @uncompat/oxc-resolver

# pnpm
pnpm add @uncompat/oxc-resolver

# bun
bun add @uncompat/oxc-resolver
```

### API

```js
import resolve, { ResolverFactory } from '@uncompat/oxc-resolver'

resolve.sync(process.cwd(), 'some-package')

const resolver = new ResolverFactory({ extensions: ['.js', '.ts'] })
resolver.sync(process.cwd(), 'some-package')
```

## Limitations

- The sibling-file ordering only applies to the legacy `node_modules/X.js` layout; packages
  reached through `NODE_PATH` are not shimmed.
- When the sibling file wins, `moduleType` and `packageJsonPath` describe the discarded
  directory resolution, so they are cleared instead of recomputed for the file.
- `"exports": null` is treated as absent, but `oxc-resolver` itself currently fails to resolve
  such a package, so the shim cannot recover that case.

## Sponsors and Backers

[![Sponsors](https://raw.githubusercontent.com/1stG/static/master/sponsors.svg)](https://github.com/sponsors/JounQin)

### Sponsors

| 1stG                                                                                                                   | RxTS                                                                                                                   | UnTS                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective sponsors](https://opencollective.com/1stG/organizations.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective sponsors](https://opencollective.com/rxts/organizations.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective sponsors](https://opencollective.com/unts/organizations.svg)](https://opencollective.com/unts) |

### Backers

| 1stG                                                                                                                | RxTS                                                                                                                | UnTS                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective backers](https://opencollective.com/1stG/individuals.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective backers](https://opencollective.com/rxts/individuals.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective backers](https://opencollective.com/unts/individuals.svg)](https://opencollective.com/unts) |

## Changelog

Detailed changes for each release are documented in [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT][] © [JounQin][]@[1stG.me][]

[1stG.me]: https://www.1stG.me
[JounQin]: https://GitHub.com/JounQin
[MIT]: http://opensource.org/licenses/MIT
