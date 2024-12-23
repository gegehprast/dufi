import express from 'express'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'vite'
import { Server } from 'socket.io'
import DuplicateManager from './DuplicateManager.js'

export default async function server(manager: DuplicateManager) {
    const app = express()
    const server = http.createServer(app)
    const io = new Server(server, {
        cors: {
            origin: '*',
        },
    })
    
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

    io.on('connection', (socket) => {
        console.log('a user connected')
        socket.emit('duplicates', manager.duplicates)
    })

    return new Promise<void>((resolve) => {
        server.listen(1234, () => {
            console.log('Server is running on port 1234')
            resolve()
        })
    })
}
