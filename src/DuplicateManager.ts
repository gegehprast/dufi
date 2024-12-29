import EventEmitter from 'events'
import { Duplicate } from './DuplicateFinder.js'
import fs from 'fs'
import Database from 'better-sqlite3'
import sharp from 'sharp'
import { DB_FILE } from './const.js'
import { exec } from 'child_process'

const IMAGE_EXTENSIONS = [
    '.apng',
    '.png',
    '.avif',
    '.gif',
    '.jpg',
    '.jpeg',
    '.jfif',
    '.pjpeg',
    '.pjp',
    '.png',
    '.svg',
    '.webp',
]

export interface DuplicateModel {
    id: number
    hash: string
    file: string
    preview: string | null
    deleted: number
}

export type GroupedDuplicate = {
    hash: string
    files: (Omit<DuplicateModel, 'hash' | 'deleted'> & { deleted: boolean })[]
}

interface DuplicateManagerEvents {
    'db-trans-start': []
    'db-trans-end': []
    'preview-start': []
    'preview-end': []
}

export class DuplicateManager extends EventEmitter<DuplicateManagerEvents> {
    private db = new Database(DB_FILE)

    constructor() {
        super()

        this.db.pragma('journal_mode = WAL')
    }

    public async init(duplicates: Duplicate[]) {
        // drop table if exists
        this.db.prepare('DROP TABLE IF EXISTS duplicates').run()

        // create table
        this.db
            .prepare(
                'CREATE TABLE duplicates (id INTEGER PRIMARY KEY, hash TEXT, file TEXT, preview TEXT, deleted INTEGER)'
            )
            .run()

        // create unique index of hash and file
        this.db.prepare('CREATE UNIQUE INDEX hash_file ON duplicates (hash, file)').run()

        this.emit('db-trans-start')

        const insert = this.db.prepare(
            'INSERT INTO duplicates (hash, file, preview, deleted) VALUES (@hash, @file, @preview, @deleted)'
        )
        const insertMany = this.db.transaction((duplicates) => {
            for (const duplicate of duplicates) {
                insert.run(duplicate)
            }
        })

        const data: Omit<DuplicateModel, 'id'>[] = []

        for (const duplicate of duplicates) {
            for (const file of duplicate.files) {
                data.push({
                    hash: duplicate.hash,
                    file: file,
                    preview: null,
                    deleted: 0,
                })
            }
        }

        this.emit('preview-start')

        const previews: (string | null)[] = []
        const sizePerChunk = 50
        const dataChunks = Array.from({ length: Math.ceil(data.length / sizePerChunk) }, (_, index) =>
            data.slice(index * sizePerChunk, (index + 1) * sizePerChunk)
        )

        for (const [index, chunk] of dataChunks.entries()) {
            const previewsChunk = await Promise.all(chunk.map((d) => this.generatePreview(d.file)))

            previews.push(...previewsChunk)
        }

        data.forEach((d, index) => {
            d.preview = previews[index]!
        })

        this.emit('preview-end')

        insertMany(data)

        this.emit('db-trans-end')
    }

    public async get() {
        return new Promise<GroupedDuplicate[]>((resolve, reject) => {
            const rows = this.db.prepare('SELECT * FROM duplicates').all() as DuplicateModel[]

            const duplicates: GroupedDuplicate[] = []

            for (const row of rows) {
                const duplicate = duplicates.find((d) => d.hash === row.hash)

                if (duplicate) {
                    duplicate.files.push({
                        id: row.id,
                        file: row.file,
                        preview: row.preview,
                        deleted: row.deleted === 1,
                    })
                } else {
                    duplicates.push({
                        hash: row.hash,
                        files: [
                            {
                                id: row.id,
                                file: row.file,
                                preview: row.preview,
                                deleted: row.deleted === 1,
                            },
                        ],
                    })
                }
            }

            resolve(duplicates)
        })
    }

    public keep(id: number) {
        const duplicate = this.db.prepare('SELECT hash, file FROM duplicates WHERE id = ?').get(id) as Pick<
            DuplicateModel,
            'hash' | 'file'
        >
        const others = this.db
            .prepare('SELECT id FROM duplicates WHERE hash = ? AND id != ?')
            .all(duplicate.hash, id) as Pick<DuplicateModel, 'id'>[]

        for (const other of others) {
            this.delete(other.id)
        }

        return others.map((o) => o.id)
    }

    public delete(id: number) {
        const duplicate = this.db.prepare('SELECT file FROM duplicates WHERE id = ?').get(id) as DuplicateModel

        if (duplicate) {
            try {
                fs.unlinkSync(duplicate.file)
            } catch (error: any) {
                // check if error is file not found and ignore it
                if (error.code === 'ENOENT') {
                    return
                }

                throw error
            }
        }

        this.db.prepare('UPDATE duplicates SET deleted = 1 WHERE id = ?').run(id)
    }

    public async open(id: number) {
        const file = this.db.prepare('SELECT file FROM duplicates WHERE id = ?').get(id) as DuplicateModel

        if (file) {
            const isWindows = process.platform === 'win32'

            if (isWindows) {
                exec(`start "" "${file.file}"`)
            }

            return
        }
    }

    private async generatePreview(file: string) {
        // check if file is an image
        const ext = file.split('.').pop()?.toLowerCase()

        if (ext && IMAGE_EXTENSIONS.includes(`.${ext}`)) {
            const data = fs.readFileSync(file)

            try {
                const buffer = await sharp(data).resize(180).toBuffer()

                return `data:image/png;base64,${buffer.toString('base64')}`
            } catch (error) {
                // ignore errors
            }
        }

        return null
    }
}

export default DuplicateManager
