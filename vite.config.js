import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Mount the memory API inside the dev server so `npm run dev` runs the whole
// app — frontend + /api/memory/* — with no second process and no proxy.
// The same handler also runs standalone via `node server/index.js`.
function memoryApi() {
  return {
    name: 'memory-api',
    async configureServer(server) {
      const { handleApi } = await import('./server/handler.js')
      const { modeBanner } = await import('./server/config.js')
      const { getStore } = await import('./server/store.js')
      await getStore() // warm + seed
      server.config.logger.info(`  \x1b[36m➜\x1b[0m  ${modeBanner()}`)
      server.middlewares.use(async (req, res, next) => {
        try {
          const handled = await handleApi(req, res)
          if (!handled) next()
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), memoryApi()],
})
