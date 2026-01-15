import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'StrokeStabilizerVue',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['vue', '@stroke-stabilizer/core'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
    sourcemap: true,
    minify: false,
  },
  plugins: [
    dts({
      rollupTypes: true,
    }),
  ],
})
