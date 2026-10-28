import { defineConfig } from '@rsbuild/core'
import { pluginOctane } from '@octanejs/rsbuild-plugin'
import { beast } from 'beast-tsrx/rspack'
import { beastDevtools } from '@beastjs/devtools/rsbuild'
import { existsSync, readdirSync, statSync } from 'node:fs'

// Dev-only fixtures for the landing footer's file preview button. Read once at startup,
// so restart the dev server after adding files to public/files. Production gets [].
const devPreviewFiles = process.env.NODE_ENV === 'production' || !existsSync('public/files')
  ? []
  : readdirSync('public/files')
    .filter((name) => !name.startsWith('.'))
    .map((name) => ({ name, size: statSync(`public/files/${name}`).size }))

export default defineConfig({
  html: {
    title: 'DropZone — Your files, already organized'
  },
  source: {
    define: { __DEV_PREVIEW_FILES__: JSON.stringify(devPreviewFiles) }
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
        rspack(config, { rspack }) {
          // Emotion 11.9 (via @octanejs/select) switches builds only through the
          // browser field, which this target follows into DOM-only code.
          config.plugins.push(new rspack.NormalModuleReplacementPlugin(
            /@emotion[\\/]cache[\\/]dist[\\/]emotion-cache\.browser\.(esm|cjs)\.js$/,
            (resource) => {
              if (resource.createData?.resource) resource.createData.resource = resource.createData.resource.replace('.browser.', '.')
              else resource.request = resource.request.replace('.browser.', '.')
            }
          ))
          config.plugins.push(beast({
            octane: { environment: 'server', strong: true }
          }))
        }
      }
    }
  },
  plugins: [pluginOctane({ strong: true }), beastDevtools()]
})
