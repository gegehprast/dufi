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
            // @see https://github.com/vitejs/vite/discussions/12305#discussioncomment-5217387
            configFile: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'web/vite.config.js'),
            server: {
                middlewareMode: true,
            },
            // @see https://github.com/vitejs/vite/discussions/12305#discussioncomment-5217387
            root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'web'),
            base: '/',
        })
        app.use(viteDevServer.middlewares)
    } else {
        app.use(express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'web')))
    }

    io.on('connection', async (socket) => {
        function emitDuplicates() {
            manager.get().then((duplicates) => {
                socket.emit('duplicates', duplicates)
            })
        }

        emitDuplicates()

        socket.on('keep', (id: number) => {
            const deleted = manager.keep(id)
            
            for (const id of deleted) {
                io.emit('deleted', id)
            }
        })

        socket.on('delete', (id: number) => {
            manager.delete(id)

            io.emit('deleted', id)
        })

        socket.on('open', (id: number) => {
            manager.open(id)
        })
    })

    return new Promise<void>((resolve) => {
        server.listen(1234, () => {
            resolve()
        })
    })
}
