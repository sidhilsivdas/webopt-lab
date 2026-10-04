import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  // Relative asset paths, so the build works at a site root and under a
  // sub-path such as GitHub Pages' /<repo>/.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    // React strips <Profiler> timings from production builds; the profiling
    // build keeps them so "React commits" still works in `npm run preview`.
    alias: [{ find: /^react-dom\/client$/, replacement: 'react-dom/profiling' }],
  },
  build: {
    rolldownOptions: {
      // Two pages: the React app, and a static, React-free test results page.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        results: resolve(import.meta.dirname, 'results.html'),
      },
    },
  },
})
