import { defineConfig } from '@rsbuild/core'
import { pluginOctane } from '@octanejs/rsbuild-plugin'
import { beast } from 'beast-tsrx/rspack'
import { beastDevtools } from '@beastjs/devtools/rsbuild'

export default defineConfig({
  html: {
    title: 'DropZone — Your files, already organized'
  },
  server: {
    // Rsbuild's automatic copy treats a Web Worker server as browser output
    // and would duplicate every public asset into dist/server.
    publicDir: [
      { name: 'node_modules/pdfjs-dist/legacy/build', copyOnBuild: false },
      { name: 'public', copyOnBuild: false }
    ]
  },
  splitChunks: {
    // Octane early hydration needs a self-contained entry. Split only async
    // imports, keeping OCR and PDF dependencies off the initial path.
    preset: 'per-package',
    chunks: 'async'
  },
  environments: {
    web: {
      output: {
        copy: [
          { from: './public', to: '.', globOptions: { ignore: ['**/pdf.worker.mjs', '**/.DS_Store'] } },
          { from: './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', to: 'pdf.worker.mjs' }
        ]
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
  plugins: [pluginOctane({ strong: true }), beastDevtools()]
})
