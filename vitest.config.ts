import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    benchmark: {
      // Module-runner export getters warn on every benchmark iteration; keep summaries clean.
      suppressExportGetterWarnings: true,
    },
    coverage: {
      enabled: true,
      include: ['packages/*/src/**'],
      provider: 'v8',
      reporter: ['lcov', 'json', 'text'],
    },
  },
})
