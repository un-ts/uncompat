---
"@uncompat/oxc-resolver": minor
---

Initial release: Node-compatible resolution shims over `oxc-resolver`.

- `node_modules/X.js` is preferred over `node_modules/X/` for bare package
  names (unless the package declares `exports`).
- the entry directory is canonicalized before resolution when symlinks are
  enabled.
