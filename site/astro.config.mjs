// @ts-check
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'

// Statyczna strona marketingowa hoopconnect.pl. Apka gracza żyje na app.hoopconnect.pl
// (osobny projekt Vercel z tego samego repo). `site` steruje sitemap/OG i kanonikami.
export default defineConfig({
  site: 'https://hoopconnect.pl',
  integrations: [mdx(), sitemap()],
  build: { format: 'directory' },
})
