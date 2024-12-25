import EventEmitter from 'events'
import { Duplicate } from './DuplicateFinder.js'
import fs from 'fs'
import Database from 'better-sqlite3'
import sharp from 'sharp'
import { DB_FILE } from './const.js'

const db = new Database(DB_FILE)
db.pragma('journal_mode = WAL')

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

export interface DuplicateManager {}

export class DuplicateManager extends EventEmitter {
    constructor() {
        super()
    }

    public async init(duplicates: Duplicate[]) {
        // drop table if exists
        db.prepare('DROP TABLE IF EXISTS duplicates').run()

        // create table
        db.prepare(
            'CREATE TABLE duplicates (id INTEGER PRIMARY KEY, hash TEXT, file TEXT, preview TEXT, deleted INTEGER)'
        ).run()

        // create unique index of hash and file
        db.prepare('CREATE UNIQUE INDEX hash_file ON duplicates (hash, file)').run()

        const insert = db.prepare(
            'INSERT INTO duplicates (hash, file, preview, deleted) VALUES (@hash, @file, @preview, @deleted)'
        )
        const insertMany = db.transaction((duplicates) => {
            for (const duplicate of duplicates) insert.run(duplicate)
        })

        const data: Omit<DuplicateModel, 'id'>[] = []

        for (const duplicate of duplicates) {
            for (const file of duplicate.files) {
                data.push({
                    hash: duplicate.hash,
                    file: file,
                    preview: await this.generatePreview(file),
                    deleted: 0,
                })
            }
        }

        insertMany(data)
    }

    public async get() {
        return new Promise<GroupedDuplicate[]>((resolve, reject) => {
            const rows = db.prepare('SELECT * FROM duplicates').all() as DuplicateModel[]

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

    public async delete(id: number) {
        db.prepare('UPDATE duplicates SET deleted = 1 WHERE id = ?').run(id)
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
