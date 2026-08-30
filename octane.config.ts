import {
  defineConfig,
  RenderRoute,
  ServerRoute,
  type Context
} from '@octanejs/rsbuild-plugin'
import { cloudflare } from '@octanejs/adapter-cloudflare'

async function handleFiles(context: Context) {
  const routes = await import('./src/server/routes')
  return routes.handleFiles(context)
}

async function handleFileById(context: Context) {
  const routes = await import('./src/server/routes')
  return routes.handleFileById(context)
}

export default defineConfig({
  adapter: cloudflare(),
  compiler: {
    strong: true
  },
  router: {
    routes: [
      new RenderRoute({ path: '/', entry: '/src/App.btsx' }),
      new ServerRoute({
        path: '/api/files',
        methods: ['GET', 'POST'],
        handler: handleFiles
      }),
      new ServerRoute({
        path: '/api/files/:id',
        methods: ['GET', 'DELETE'],
        handler: handleFileById
      })
    ]
  }
})
