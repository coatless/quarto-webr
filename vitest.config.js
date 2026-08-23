import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/_unit/**/*.test.js', 'tests/_render/**/*.test.js'],
    testTimeout: 180000,
    hookTimeout: 180000,
  },
})
