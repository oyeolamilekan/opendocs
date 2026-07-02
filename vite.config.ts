import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      '@tiptap/core',
      '@tiptap/extension-image',
      '@tiptap/react',
      '@tiptap/react/menus',
      '@tiptap/extension-link',
      '@tiptap/extension-placeholder',
      '@tiptap/starter-kit',
      '@tiptap/suggestion',
    ],
  },
  ssr: {
    noExternal: ['@convex-dev/better-auth'],
  },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
