import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import EventEmitter from 'events'
import { CACHE_FILE } from './const.js'

export type Duplicate = { hash: string; files: string[] }

export interface Options {
    folders: string[]
    extensions?: string[]
    bytes?: number
}

interface DuplicateFinderEvents {
    scan: [folder: string]
    'scan-result': [folder: string, files: string[]]
    files: [files: string[]]
    progress: [iteration: number, total: number, file: string, hash: string]
}

export class DuplicateFinder extends EventEmitter<DuplicateFinderEvents> {
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
        const chunkSize = 100
        const chunckedFiles = Array.from({ length: Math.ceil(files.length / chunkSize) }, (_, index) =>
            files.slice(index * chunkSize, (index + 1) * chunkSize)
        )
        const fileHashes: { [key: string]: string } = {}

        for (const [index, chunk] of chunckedFiles.entries()) {
            const hashes = await Promise.all(chunk.map((file) => this.getFileHash(file)))
            const shouldBeCached: { file: string; hash: string }[] = []

            for (const [i, hash] of hashes.entries()) {
                const file = chunk[i]!

                fileHashes[file] = hash.hash

                if (!hash.cached) {
                    shouldBeCached.push({ file, hash: hash.hash })
                }

                this.emit('progress', index * chunkSize + i + 1, files.length, file, hash.hash)
            }

            // cache hashes
            let cacheLines: string = ''

            for (const { file, hash } of shouldBeCached) {
                cacheLines += `${file} ${hash}\n`
                this.cachedHashes[file] = hash
            }

            fs.appendFileSync(CACHE_FILE, cacheLines)
        }

        for (const [file, hash] of Object.entries(fileHashes)) {
            const found = grouped.find((h) => h.hash === hash)

            if (found) {
                found.files.push(file)
            } else {
                grouped.push({ hash, files: [file] })
            }
        }

        return grouped.filter((h) => h.files.length > 1)
    }

    private async getFileHash(file: string) {
        // check if file hash is cached
        if (this.cachedHashes[file]) {
            return {
                hash: this.cachedHashes[file],
                cached: true,
            }
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

        return {
            hash,
            cached: false,
        }
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
