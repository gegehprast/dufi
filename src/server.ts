import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'vite'

export default async function server() {
    const app = express()
    
    if (process.env.NODE_ENV === 'development') {
        const viteDevServer = await createServer({
            configFile: 'src/web/vite.config.ts',
            server: {
                middlewareMode: true,
            },
            root: 'src/web',
            base: '/',
        })
        app.use(viteDevServer.middlewares)
    } else {
        app.use(express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'web')))
    }

    return new Promise<void>((resolve) => {
        app.listen(1234, () => {
            console.log('Server is running on port 1234')
            resolve()
        })
    })
}
