import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import EventEmitter from 'events'
import { fileURLToPath } from 'url'

const CACHE_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.cache')

export type Duplicate = { hash: string; files: string[] }

export interface Options {
    folders: string[]
    extensions?: string[]
    bytes?: number
}

export interface DuplicateFinder {
    on(event: 'scan', listener: (folder: string) => void): this
    on(event: 'scan-result', listener: (folder: string, files: string[]) => void): this
    on(event: 'files', listener: (files: string[]) => void): this
    on(event: 'progress', listener: (iteration: number, total: number, file: string, hash: string) => void): this
}

export class DuplicateFinder extends EventEmitter {
    private folders: string[]
    private extensions: string[]
    private bytes: number
    private cachedHashes: { [key: string]: string } = {}

    constructor(options: Options) {
        super()

        this.folders = options.folders
        this.extensions = options.extensions || []
        this.bytes = options.bytes || 1024 * 16
    }

    public async run() {
        const files = await this.getFiles()

        this.emit('files', files)

        // make sure cache file exists
        if (!fs.existsSync(CACHE_FILE)) {
            fs.writeFileSync(CACHE_FILE, '')
        }

        // resurrect cached hashes
        const cache = fs.readFileSync(CACHE_FILE, 'utf8')
        const lines = cache.split('\n')

        for (const line of lines) {
            const split = line.split(' ')
            const hash = split[split.length - 1]
            const file = split.slice(0, split.length - 1).join(' ')

            if (file && hash) {
                this.cachedHashes[file] = hash
            }
        }

        const duplicates = await this.findDuplicates(files)

        return duplicates
    }

    public static async purgeCache() {
        fs.writeFileSync(CACHE_FILE, '')
    }

    private async findDuplicates(files: string[]) {
        const grouped: Duplicate[] = []

        for (let i = 0; i < files.length; i++) {
            const file = files[i]

            try {
                const hash = await this.getFileHash(file)
                const existingHash = grouped.find((h) => h.hash === hash)

                if (existingHash) {
                    existingHash.files.push(file)
                } else {
                    grouped.push({ hash, files: [file] })
                }

                this.emit('progress', i + 1, files.length, file, hash)
            } catch (error) {
                console.error(`Error hashing file: ${file}`, error)
            }
        }

        return grouped.filter((h) => h.files.length > 1)
    }

    private async getFileHash(file: string) {
        // check if file hash is cached
        if (this.cachedHashes[file]) {
            return this.cachedHashes[file]
        }

        const fileSize = fs.statSync(file).size
        const firstNHash = crypto.createHash('sha256')
        const lastNHash = crypto.createHash('sha256')
        const firstNStream = fs.createReadStream(file, { start: 0, end: this.bytes < fileSize ? this.bytes : fileSize })
        const lastNStream = fs.createReadStream(file, { start: fileSize - this.bytes > 0 ? fileSize - this.bytes : 0 })

        const hash = await Promise.all([
            new Promise((resolve, reject) => {
                firstNStream.on('data', (chunk) => {
                    firstNHash.update(chunk)
                })
                firstNStream.on('end', () => {
                    firstNStream.close()
                    resolve(firstNHash.digest('hex'))
                })
                firstNStream.on('error', reject)
            }),
            new Promise((resolve, reject) => {
                lastNStream.on('data', (chunk) => {
                    lastNHash.update(chunk)
                })
                lastNStream.on('end', () => {
                    lastNStream.close()
                    resolve(lastNHash.digest('hex'))
                })
                lastNStream.on('error', reject)
            }),
        ]).then(([first16KbHash, last16KbHash]) => {
            return `${first16KbHash}-${last16KbHash}`
        })

        // cache file hash
        fs.appendFileSync(CACHE_FILE, `${file} ${hash}\n`)
        this.cachedHashes[file] = hash

        return hash
    }

    private async getFiles() {
        const files: string[] = []

        for (const folder of this.folders) {
            const folderFiles = await this.getFilesInFolder(folder)
            files.push(...folderFiles)
        }

        return files
    }

    private async getFilesInFolder(folder: string) {
        const files: string[] = []
        let absoluteFolder = folder

        if (path.isAbsolute(folder)) {
            absoluteFolder = path.resolve(folder)
        } else {
            absoluteFolder = path.resolve(process.cwd(), folder)
        }

        this.emit('scan', absoluteFolder)

        const entries = await fs.promises.readdir(absoluteFolder, { withFileTypes: true })

        for (const entry of entries) {
            const fullPath = `${absoluteFolder}/${entry.name}`

            if (entry.isDirectory()) {
                const subFolderFiles = await this.getFilesInFolder(fullPath)
                files.push(...subFolderFiles)
            } else {
                if (this.extensions.length > 0 && !this.extensions.includes(path.extname(fullPath).toLowerCase())) {
                    continue
                }

                files.push(fullPath.replace(/\\/g, '/'))
            }
        }

        this.emit('scan-result', absoluteFolder, files)

        return files
    }
}

export default DuplicateFinder
