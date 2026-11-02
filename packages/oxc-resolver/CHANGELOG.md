# Change Log

## 0.1.0

### Minor Changes

- [#2](https://github.com/un-ts/uncompat/pull/2) [`c03cd69`](https://github.com/un-ts/uncompat/commit/c03cd690a574895664a53750686deb5e38a50a93) Thanks [@JounQin](https://github.com/JounQin)! - Initial release: Node-compatible resolution shims over `oxc-resolver`.
  
  - `node_modules/X.js` is preferred over `node_modules/X/` for bare package
    names (unless the package declares `exports`).
  - the entry directory is canonicalized before resolution when symlinks are
    enabled.
