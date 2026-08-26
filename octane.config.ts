import { defineConfig, RenderRoute, ServerRoute } from '@octanejs/rsbuild-plugin'
import { handleFileById, handleFiles } from './src/server/routes'

export default defineConfig({
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
