import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { visualizer } from 'rollup-plugin-visualizer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo'

  return {
    base: isDemo ? '/file-manager/' : '/',
    plugins: [
      visualizer({ open: false }),
      vue(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
        '/ws': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      outDir: isDemo ? '../gh-pages-dist' : '../backend/dist',
      emptyOutDir: true,
      rollupOptions: {
        external: ['three'],
        output: {
          globals: {
            three: 'THREE',
          },
          manualChunks: {
            vue: ['vue'],
            'element-plus': ['element-plus'],
          },
        },
        treeshake: true,
      },
    },
  }
})
