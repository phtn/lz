import { defineConfig } from '@rsbuild/core'
import { beastOctane } from 'beast-tsrx/rsbuild'

export default defineConfig({
  html: {
    title: 'DropZone — Local-first file organizer'
  },
  source: {
    // Keep the global stylesheet in the eager client entry. Route entries are
    // loaded asynchronously by Octane, so importing global CSS only from a
    // route can leave the initial document unstyled in development.
    preEntry: ['./src/style.css']
  },
  plugins: beastOctane({
    octane: { strong: true }
  })
})
