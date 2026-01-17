import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@stroke-stabilizer/core': path.resolve(
        __dirname,
        'packages/core/src/index.ts'
      ),
      '@stroke-stabilizer/react': path.resolve(
        __dirname,
        'packages/react/src/index.ts'
      ),
      '@stroke-stabilizer/vue': path.resolve(
        __dirname,
        'packages/vue/src/index.ts'
      ),
      vue: path.resolve(__dirname, 'node_modules/vue/dist/vue.esm-bundler.js'),
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
  },
})
