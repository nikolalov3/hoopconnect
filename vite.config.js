import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // __BUILD_ID__ jest unikalny dla każdego deployu. Klient porównuje go z
    // tym co ma w localStorage; jeśli się różni — przeładowuje stronę.
    // Cache-bust dla iOS Safari które agresywnie trzyma stare bundle.
    __BUILD_ID__: JSON.stringify(String(Date.now())),
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
    // Inline small assets as base64 — reduces extra HTTP requests
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/framer-motion')) return 'motion'
          if (id.includes('node_modules/@supabase'))     return 'supabase'
          if (id.includes('node_modules/leaflet'))       return 'leaflet'
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')
          ) return 'react-vendor'
        },
      },
    },
  },
})
