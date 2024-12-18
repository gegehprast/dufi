import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

interface Options {
    folders: string[]
    extensions?: string[]
    bytes?: number
}

export class DuplicateFinder {
    private folders: string[]
    private extensions: string[]
    private bytes: number

    public duplicates: string[] = []

    constructor(options: Options) {
        this.folders = options.folders
        this.extensions = options.extensions || []
        this.bytes = options.bytes || 1024 * 16
    }

    public async run() {
        const files = await this.getFiles()
        const duplicates = await this.findDuplicates(files)
        
        return duplicates
    }

    private async findDuplicates(files: string[]) {
        const grouped: { hash: string; files: string[] }[] = []

        for (const file of files) {
            try {
                const hash = await this.getFileHash(file)
                const existingHash = grouped.find((h) => h.hash === hash)

                if (existingHash) {
                    existingHash.files.push(file)
                } else {
                    grouped.push({ hash, files: [file] })
                }
            } catch (error) {
                console.error(`Error hashing file: ${file}`, error)
            }
        }

        return grouped.filter((h) => h.files.length > 1)
    }

    private async getFileHash(file: string) {
        const fileSize = fs.statSync(file).size
        const firstNHash = crypto.createHash('sha256')
        const lastNHash = crypto.createHash('sha256')
        const firstNStream = fs.createReadStream(file, { start: 0, end: this.bytes < fileSize ? this.bytes : fileSize })
        const lastNStream = fs.createReadStream(file, { start: fileSize - this.bytes > 0 ? fileSize - this.bytes : 0 })

        return Promise.all([
            new Promise((resolve, reject) => {
                firstNStream.on('data', (chunk) => {
                    firstNHash.update(chunk)
                })
                firstNStream.on('end', () => {
                    resolve(firstNHash.digest('hex'))
                })
                firstNStream.on('error', reject)
            }),
            new Promise((resolve, reject) => {
                lastNStream.on('data', (chunk) => {
                    lastNHash.update(chunk)
                })
                lastNStream.on('end', () => {
                    resolve(lastNHash.digest('hex'))
                })
                lastNStream.on('error', reject)
            }),
        ]).then(([first16KbHash, last16KbHash]) => {
            return `${first16KbHash}-${last16KbHash}`
        })
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

        return files
    }
}

export default DuplicateFinder
