import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.PORT || '3000'),
  },
  // pdfmake VFS (virtual file system z fontami) jest ogromnym base64 blobem
  // który Vite czasem mis-bundluje przy lazy-loaded chunkach. Wymuszamy
  // pre-bundling żeby fonty zawsze były dostępne pod pdfMake.vfs.
  optimizeDeps: {
    include: ['pdfmake/build/pdfmake', 'pdfmake/build/vfs_fonts'],
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
          if (id.includes('node_modules/pdfmake'))       return 'pdfmake'
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
