import { defineConfig } from '@rsbuild/core'
import { pluginOctane } from '@octanejs/rsbuild-plugin'
import { beast } from 'beast-tsrx/rspack'

export default defineConfig({
  html: {
    title: 'DropZone — Local-first file organizer'
  },
  server: {
    // Rsbuild's automatic copy treats a Web Worker server as browser output
    // and would duplicate every public asset into dist/server.
    publicDir: {
      name: 'public',
      copyOnBuild: false
    }
  },
  splitChunks: {
    // Keep large dependencies in independently cacheable chunks. OCR and PDF
    // modules also use dynamic imports, so they remain off the initial path.
    preset: 'per-package',
    chunks: 'all'
  },
  environments: {
    web: {
      output: {
        copy: [{ from: './public', to: '.' }]
      },
      tools: {
        rspack(config) {
          config.plugins.push(beast({
            octane: { environment: 'client', strong: true }
          }))
        }
      }
    },
    node: {
      tools: {
        // Cloudflare's Web Worker target otherwise looks like a browser target
        // to Beast's automatic environment detection.
        rspack(config) {
          config.plugins.push(beast({
            octane: { environment: 'server', strong: true }
          }))
        }
      }
    }
  },
  source: {
    // Keep the global stylesheet in the eager client entry. Route entries are
    // loaded asynchronously by Octane, so importing global CSS only from a
    // route can leave the initial document unstyled in development.
    preEntry: ['./src/style.css']
  },
  plugins: [pluginOctane({ strong: true })]
})
