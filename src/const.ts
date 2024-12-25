import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

export const GEN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.gen')

// make sure .gen folder exists
if (!fs.existsSync(GEN_DIR)) {
    fs.mkdirSync(GEN_DIR)
}

export const CACHE_FILE = path.resolve(GEN_DIR, '.cache')
export const DB_FILE = path.resolve(GEN_DIR, '.storage.db')
export const PREVIEW_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'web/previews')
